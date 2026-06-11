"""
Shared helpers used by multiple domain routers.
"""
import logging
from typing import List, Optional

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
    end   = (episode.get("end_date")   or "")[:10] or None

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

    events = sorted(episode.get("events", []), key=lambda e: (e.get("date") or ""))

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
