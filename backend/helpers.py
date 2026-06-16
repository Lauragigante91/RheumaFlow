"""
Shared helpers used by multiple domain routers.
"""
import logging
from datetime import date, timedelta
from typing import Dict, List, Optional

from fastapi import HTTPException
from database import db

logger = logging.getLogger(__name__)


async def verify_patient_in_org(patient_id: str, organization_id: str) -> None:
    """Raise 404 if patient_id does not belong to organization_id."""
    p = await db.patients.find_one(
        {"id": patient_id, "organization_id": organization_id},
        {"_id": 0, "id": 1},
    )
    if not p:
        raise HTTPException(status_code=404, detail="Paziente non trovato")


# ── Point-in-time therapy reconstruction (shared across routers) ──────────────

def _non_voided_events(episode: dict) -> List[dict]:
    """Episode events without voided ones, sorted by (date, created_at) for determinism."""
    evs = [e for e in episode.get("events", []) if not e.get("voided")]
    return sorted(evs, key=lambda e: ((e.get("date") or "")[:10], e.get("created_at") or ""))


def _founding_event_type(episode: dict) -> Optional[str]:
    """Type of the episode's founding event: started | noted | historical_exposure | None."""
    for ev in _non_voided_events(episode):
        t = ev.get("type")
        if t in ("started", "noted", "historical_exposure"):
            return t
    return None


def _last_lifecycle_event(episode: dict) -> Optional[str]:
    """Type of the most recent discontinued / paused / resumed_within event, if any."""
    last: Optional[str] = None
    for ev in _non_voided_events(episode):
        if ev.get("type") in ("discontinued", "paused", "resumed_within"):
            last = ev.get("type")
    return last


def _effective_end(episode: dict) -> Optional[str]:
    """
    Closure date used for point-in-time eligibility.

    Starts from the episode-level end_date; a dated 'discontinued'/'paused' event
    moves the closure, a later 'resumed_within' clears it (episode reopened). An
    undated closure event leaves the prior value intact. Returns None for an open
    episode or one with no determinable closure.
    """
    pending = (episode.get("end_date") or "")[:10] or None
    for ev in _non_voided_events(episode):
        t = ev.get("type")
        if t in ("discontinued", "paused"):
            d = (ev.get("date") or "")[:10]
            if d:
                pending = d
        elif t == "resumed_within":
            pending = None
    return pending


def _episode_state_at(episode: dict, target_date: str) -> Optional[dict]:
    """
    Reconstruct a single therapy episode's clinical state at target_date.

    Eligibility:
      - No start_date ("noted" with unknown start): include at all dates until end_date.
      - start_date > target_date → not yet started → None.
      - end_date < target_date  → already ended   → None.

    Walk events[] chronologically:
      1. Bootstrap dose/frequency/route from the founding event
         ("started" / "noted" / "historical_exposure").
      2. Apply each change event (dose_increased, dose_reduced, regimen_changed)
         up to and including target_date.
      Fields without event history fall back to the episode-level value
      (= latest value, accurate for fields that never changed).
    """
    start = (episode.get("start_date") or "")[:10]
    end   = _effective_end(episode)

    # Pregresse / discontinued episodes with no determinable closure cannot be
    # asserted active in any current regimen: a historical exposure from anamnesis,
    # or an episode flagged discontinued without a closure date, is never "in corso"
    # (unless a later resumed_within reopened it).
    if (
        end is None
        and _last_lifecycle_event(episode) != "resumed_within"
        and (
            episode.get("status") == "discontinued"
            or _founding_event_type(episode) == "historical_exposure"
        )
    ):
        return None

    if not start:
        # "noted" without known start — conservative: active until end_date
        if end and end < target_date:
            return None
        status_label = "active_noted"
    else:
        if start > target_date:
            return None
        if end and end < target_date:
            return None
        status_label = "active_approximate" if episode.get("date_approximate") else "active"

    events = _non_voided_events(episode)

    # Episode-level values as fallback for fields that predate the extended model
    current_dose      = episode.get("dose")
    current_frequency = episode.get("frequency")
    current_route     = episode.get("route")

    # Step 1 — establish initial regimen from founding event
    for ev in events:
        if ev.get("type") in ("started", "noted", "historical_exposure"):
            if ev.get("dose"):           current_dose      = ev["dose"]
            if ev.get("frequency_after"): current_frequency = ev["frequency_after"]
            if ev.get("route_after"):    current_route     = ev["route_after"]
            break

    # Step 2 — apply forward changes up to target_date
    for ev in events:
        ev_date = (ev.get("date") or "")[:10]
        if ev_date > target_date:
            break
        ev_type = ev.get("type", "")
        if ev_type in ("dose_increased", "dose_reduced"):
            if ev.get("dose_after"):      current_dose      = ev["dose_after"]
            if ev.get("frequency_after"): current_frequency = ev["frequency_after"]
            if ev.get("route_after"):     current_route     = ev["route_after"]
        elif ev_type == "regimen_changed":
            if ev.get("frequency_after"): current_frequency = ev["frequency_after"]
            if ev.get("route_after"):     current_route     = ev["route_after"]

    return {
        "id":             episode.get("id"),
        "drug_name":      episode.get("drug_name"),
        "drug_canonical": episode.get("drug_canonical"),
        "category":       episode.get("category"),
        "therapy_type":   episode.get("therapy_type"),
        "relevance":      episode.get("relevance"),
        "dose":           current_dose,
        "frequency":      current_frequency,
        "route":          current_route,
        "status_at":      status_label,
        "start_date":     start or None,
        "date_approximate": episode.get("date_approximate", False),
        "indication":     episode.get("indication"),
        "notes":          episode.get("notes"),
    }


def _therapy_state_at(episodes: List[dict], target_date: str) -> List[dict]:
    """Return the active therapy state for every episode at target_date."""
    return [s for ep in episodes if (s := _episode_state_at(ep, target_date)) is not None]


def _format_therapy_snapshot(states: List[dict]) -> str:
    """
    Format a list of TherapyState dicts as a human-readable multi-line text snapshot.
    Order: high-relevance first, then alphabetical by drug_name.
    Line format: "<drug_name> <dose> <route> <frequency>"
    """
    def _sort_key(t: dict):
        rel = t.get("relevance") or "low"
        order = {"high": 0, "medium": 1, "low": 2}
        return (order.get(rel, 9), (t.get("drug_name") or "").lower())

    lines = []
    for t in sorted(states, key=_sort_key):
        parts = [t.get("drug_name") or "?"]
        if t.get("dose"):      parts.append(t["dose"])
        if t.get("route"):     parts.append(t["route"])
        if t.get("frequency"): parts.append(t["frequency"])
        lines.append(" ".join(parts))
    return "\n".join(lines)


def _day_before(target_date: str) -> str:
    """Return the ISO date (YYYY-MM-DD) immediately preceding target_date."""
    try:
        return (date.fromisoformat(target_date[:10]) - timedelta(days=1)).isoformat()
    except (ValueError, TypeError):
        return target_date


def _episode_active_before(episode: dict, visit_date: str) -> bool:
    """True if the episode belonged to the regimen entering the visit (before visit_date)."""
    start = (episode.get("start_date") or "")[:10] or None
    end   = _effective_end(episode)
    if start and start >= visit_date:
        return False
    if end and end < visit_date:
        return False
    return True


def _episode_active_after(episode: dict, visit_date: str) -> bool:
    """True if the episode belongs to the regimen leaving the visit (after visit_date)."""
    start = (episode.get("start_date") or "")[:10] or None
    end   = _effective_end(episode)
    if start and start > visit_date:
        return False
    if end and end <= visit_date:
        return False
    return True


def _exit_drug_key(episode: dict) -> str:
    return (episode.get("drug_canonical") or episode.get("drug_name") or "").lower().strip()


def _regimen_signature(state: dict) -> tuple:
    def _n(value: Optional[str]) -> str:
        return (value or "").strip()
    return (_n(state.get("dose")), _n(state.get("frequency")), _n(state.get("route")))


def compute_exit_therapies_text(episodes: List[dict], visit_date: str) -> str:
    """
    Build the post-visit ("terapia in uscita") regimen text for a single visit.

    Compares the regimen entering the visit (state the day before visit_date) with the
    regimen leaving it (state at visit_date) and annotates every drug:
      - "(invariata)"  unchanged,
      - "(nuovo)"      started at this visit,
      - "(modificata)" posology / frequency / route changed at this visit,
      - "<drug> sospeso" discontinued at this visit.

    Pure and deterministic: derived from the therapy event ledger, never fabricates
    events. Returns "" when there is no therapy data to report.
    """
    vd = (visit_date or "")[:10]
    if not vd:
        return ""
    before = _day_before(vd)

    ordered = sorted(
        episodes,
        key=lambda e: (
            (e.get("start_date") or "")[:10],
            (e.get("end_date") or "")[:10],
            e.get("id") or "",
        ),
    )

    entry: Dict[str, dict] = {}
    exit_: Dict[str, dict] = {}
    for ep in ordered:
        key = _exit_drug_key(ep)
        if not key:
            continue
        if _episode_active_before(ep, vd):
            s = _episode_state_at(ep, before)
            if s is not None:
                entry[key] = s
        if _episode_active_after(ep, vd):
            s = _episode_state_at(ep, vd)
            if s is not None:
                exit_[key] = s

    if not entry and not exit_:
        return ""

    rel_order = {"high": 0, "medium": 1, "low": 2}

    def _sort_key(item):
        s = item[1]
        rel = s.get("relevance") or "low"
        return (rel_order.get(rel, 9), (s.get("drug_name") or "").lower())

    lines: List[str] = []
    for key, s in sorted(exit_.items(), key=_sort_key):
        if key not in entry:
            suffix = "(nuovo)"
        elif _regimen_signature(entry[key]) != _regimen_signature(s):
            suffix = "(modificata)"
        else:
            suffix = "(invariata)"
        parts = [s.get("drug_name") or "?"]
        if s.get("dose"):      parts.append(s["dose"])
        if s.get("route"):     parts.append(s["route"])
        if s.get("frequency"): parts.append(s["frequency"])
        lines.append(f"{' '.join(parts)} {suffix}")

    suspended = [(k, s) for k, s in entry.items() if k not in exit_]
    for key, s in sorted(suspended, key=lambda it: (it[1].get("drug_name") or "").lower()):
        lines.append(f"{s.get('drug_name') or '?'} sospeso")

    return "\n".join(lines)


async def generate_home_therapies_text(
    patient_id: str,
    organization_id: str,
    visit_date: str,
    fallback_text: Optional[str] = None,
) -> str:
    """
    Generate home_therapies_text for a workup visit snapshot.

    Queries db.therapies for patient_id, calls _therapy_state_at(episodes, visit_date),
    formats the result as a multi-line text snapshot.

    Rules:
      - Always derived from db.therapies at visit_date (historical accuracy).
      - If therapy_state_at returns no therapies → fallback to fallback_text.
      - If fallback_text is also empty → returns empty string.
      - Always logs: visit_date, therapies found, generated text, fallback status.
    """
    episodes = await db.therapies.find(
        {"patient_id": patient_id, "organization_id": organization_id},
        {"_id": 0},
    ).to_list(2000)

    states = _therapy_state_at(episodes, visit_date)

    if states:
        text = _format_therapy_snapshot(states)
        logger.info(
            "generate_home_therapies_text: patient=%s visit_date=%s "
            "therapies_found=%d text_lines=%d fallback=no | %s",
            patient_id, visit_date, len(states), len(text.splitlines()),
            "; ".join(
                f"{s.get('drug_name','?')} {s.get('dose','—')} {s.get('frequency','—')}"
                for s in states
            ),
        )
        return text
    else:
        text = fallback_text or ""
        logger.info(
            "generate_home_therapies_text: patient=%s visit_date=%s "
            "therapies_found=0 fallback=%s text=%r",
            patient_id, visit_date, "yes" if fallback_text else "no (empty)", text[:80],
        )
        return text
