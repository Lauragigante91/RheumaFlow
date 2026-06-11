---
name: Therapy event semantics
description: Distinzione clinica tra started/noted/historical_exposure e campi data nel modello episodio
---

## Tassonomia eventi terapeutici

| Evento | Quando | Status ep. | start_date |
|---|---|---|---|
| `started` | Terapia prescritta/avviata in data identificabile | active | data certa |
| `noted` | Terapia già in corso alla prima osservazione | active | null o fornita dal medico |
| `historical_exposure` | Terapia pregressa riferita anamnosticamente | discontinued | anno/periodo se noto |
| `continued` | Confermata invariata in follow-up | active | — |
| `dose_increased/reduced` | Cambio dose | active | — |
| `discontinued` | Sospensione con motivo | discontinued | — |
| `paused`/`resumed_within` | Pausa temporanea | paused/active | — |

## Campi data distinti

- `start_date`: data reale inizio farmaco (può essere solo anno "2015", può essere null)
- `end_date`: data reale fine
- `first_seen_date`: quando RheumaFlow ha registrato la terapia (sempre valorizzato = oggi)
- `date_approximate: true`: date sono anno-only o "circa" — mai costruire 2015-01-01 da "circa 2015"
- `source`: "anamnesi_prima_visita" | "visita" | "importazione"

## Regola critica: historical_exposure non tocca mai episodi active

Il backend upsert con `event_type_override="historical_exposure"` cerca duplicati solo tra `status:"discontinued"`. Non modifica mai un episodio active, anche se esiste per lo stesso canonical. Crea un episodio discontinued separato.

## Pathway noted: nessun duplicato

Se active episode esiste + stessa dose → skip silenzioso (no evento, nessuna modifica).
Se dose diversa → dose_increased/dose_reduced.
Se nessun active → crea episodio active con event "noted".

**Why:** La prima visita registra la storia del paziente, non avvia terapie. Falsificare la data di inizio (es. mettere 2026-05-31 per una terapia iniziata nel 2019) invalida la storia clinica longitudinale.

## DRUG_ALIAS_MAP — estensione non reumatologica

Circa 160 voci aggiunte in drugs.js con `therapy_type` e `relevance:"low"`:
antiplatelet, ace_inhibitor, arb, ca_channel_blocker, beta_blocker, biguanide,
sulfonylurea, dpp4_inhibitor, sglt2_inhibitor, glp1_agonist, insulin, statin,
other_lipid, urate_lowering, anticoagulant, antiarrhythmic, diuretic, ppi,
thyroid, bisphosphonate, denosumab, antiviral_hbv, antiviral_hcv, analgesic.

## Nuovi file parser (frontend/src/lib/)

- `concomitantDrugParser.js` → parseConcomitantDrugs(text): produce items noted
- `historicalTherapyParser.js` → parseHistoricalTherapies(text): estrae anni/motivi/indicazioni, produce items historical_exposure

## UI review

`ConcomitantTherapyReview.jsx`: mode="noted" (blu) | mode="historical" (viola).
Chip verdi=riconosciuti, ambra=non riconosciuti, blu=duplicati già attivi.
Editing inline: date approssimative, motivo sospensione.
