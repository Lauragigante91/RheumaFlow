---
name: Therapy tapering guard + narrative before-window
description: Why a taper/RIDUCE context keeps a drug ACTIVE, and why narrative discontinuation only scans the last 80 chars before a drug.
---

Rule 1 — Tapering keeps a drug ACTIVE. When a drug sits in a reduction/taper context (riduce/ridurre/scala/scalare/scalaggio/taper, or "fino a controllo/sospendere", "prova a sospendere"), extractTherapies does NOT mark it discontinued — it suppresses BOTH the out-of-active-section PAST signal AND the in-active-section narrow-after SOSP override.
**Why:** real letters write "RIDUCE DELTACORTENE 25 mg 3/4 cp ... fino a controllo" — the drug is still being taken; a down-titration is not a stop, and marking it discontinued is a clinical error the user explicitly rejected.
**How to apply:** the guard deliberately suppresses both discontinuation paths. This accepts an FN risk for the rare "scala ... poi sospeso per X" co-occurrence (taper + genuine final stop in the same window). Project invariant is FP=0, not FN=0, so the tradeoff is intentional — do not loosen it without real corpus evidence.

Rule 2 — Narrative discontinuation before-cue = LAST 80 chars only. applyNarrativeDiscontinuations tests the "past" cue (PAST_BEFORE_RE) on the last 80 chars of the before-context, not the full ~250-char lookbehind.
**Why:** "Ha sospeso la Colchicina ... CONCLUSIONI ... TERAPIA - RIDUCE DELTACORTENE" otherwise let a far-away "ha sospeso" (about Colchicina) bleed onto the later Prednisone and wrongly discontinue it (cross-drug bleed).
**How to apply:** the after-drug cue still uses a wide (~400-char) window because a long-range stop after the drug usually belongs to that drug; only the before-cue must stay tight.

Rule 3 — "X cp la mattina e Y cp la sera" ⇒ daily. This morning+evening split (dayParts) sets frequency "die" (visit parser) / "Giornaliera" (quick parser). Weekly and 2-days/week patterns are matched first, so explicit non-daily schedules keep priority over the daily default.
