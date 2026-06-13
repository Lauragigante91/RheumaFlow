---
name: Visit-incipit qualifier gate (diagnosi + anamnesi)
description: Why the "in paziente con <X>" motivo-visita incipit must be visit-qualifier-gated in both diagnosis extraction and interval-history stripping, and why diagnosis scope must exclude EO/instrumental.
---

Two coupled rules in visitTextParser.js for the follow-up-letter "incipit" boilerplate
("(visita) di controllo in paziente con <diagnosi>."):

1. Diagnosis extraction must be scoped to clinical sections (MOTIVO/CONCLUSIONI/RACCORDO/
   ANAMNESI_INTERVALLARE/VISITA_ODIERNA/PREAMBLE) and must EXCLUDE ESAME_OBIETTIVO and
   instrumental reports. Demographics (sesso/eta/peso) still use full text.
   **Why:** an ECO line "Ecografia ginocchio dx: minimo versamento..." was captured as the
   diagnosis — the alias "Dx" under flag `i` collided with "dx" (=destro), and the search ran
   over the whole letter. Fix removed the `Dx` alias and restricted scope.

2. The "(in) paziente con/affetto da X" incipit branch (used BOTH to extract the diagnosis and,
   via stripVisitIncipit, to remove the boilerplate from interval_history) must require an
   explicit visit qualifier at the start (visita|controllo|ambulatoriale|rivalutazione|follow-up
   ... in paziente con). A bare "paziente con ..." must never trigger either path.
   **Why (FP=0):** bare "paziente con dolore/artralgie" would be misread as a diagnosis, and a
   real interval anamnesis starting "Paziente con discreto benessere..." would be truncated.
   stripVisitIncipit is also applied ONLY to MOTIVO/VISITA_ODIERNA slots, never to the dedicated
   ANAMNESI_INTERVALLARE slot.

**How to apply:** when touching diagnosis/incipit logic, keep the visit-qualifier gate and the
section scoping. Known residual (accepted): "visita di controllo in paziente con <sintomo>" can
still yield a symptom-as-diagnosis; add a disease-term gate only if real corpus shows it.
