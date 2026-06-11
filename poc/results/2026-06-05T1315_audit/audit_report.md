# Audit parser raccordoParser — Risultati live

**Generato:** 05/06/2026, 13:15:13
**Parser:** raccordoParser.js (bundle live)
**Test case:** 15 (TC01–TC15)

---

## Metriche aggregate

| Metrica | Valore |
|---|---|
| Macro-F1 | **0.764** [###############-----] |
| Micro-F1 | **0.774** [###############-----] |
| Micro-Precisione | 93.8% |
| Micro-Recall | 65.9% |
| Avg Reason Recall | 90.0% |
| Totale TP | 60 |
| Totale FP | 4 |
| Totale FN | 31 |
| Eventi GT totali | 91 |
| Eventi parser totali | 64 |

---

## Risultati per test case

| ID | F1 | Pre | Rec | TP | FP | FN | RR | Descrizione |
|---|---|---|---|---|---|---|---|---|
| TC01 | 🟡 0.57 | 1.00 | 0.40 | 2 | 0 | 3 | – | Stop+ripresa con date esplicite |
| TC02 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | – | Switch biologico con spacing e anafora |
| TC03 | 🟢 0.86 | 1.00 | 0.75 | 3 | 0 | 1 | 1.00 | Negazione sospensione + terapia mai interrotta |
| TC04 | 🟢 0.86 | 1.00 | 0.75 | 3 | 0 | 1 | 1.00 | Narrativo senza date (solo sequenza temporale relativa) |
| TC05 | 🟢 0.83 | 0.83 | 0.83 | 5 | 1 | 1 | 1.00 | Multiple sospensioni con ragioni diverse + switch |
| TC06 | 🟢 0.82 | 0.88 | 0.78 | 7 | 1 | 2 | 1.00 | AR — stile abbreviato da reumatologo esperto (MTX/ADA/RTX) |
| TC07 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | 1.00 | SpA — raccordo con ragionamento clinico esplicitato |
| TC08 | 🟢 0.86 | 1.00 | 0.75 | 6 | 0 | 2 | 1.00 | LES — immunosoppressori, gravidanza, switch in corso |
| TC09 | 🔴 0.22 | 1.00 | 0.13 | 1 | 0 | 7 | 1.00 | AR — formato elenco puntato (stile lettera strutturata) |
| TC10 | 🔴 0.44 | 1.00 | 0.29 | 2 | 0 | 5 | – | SpA — sospensione implicita con verbo 'passato a' e 'sostituito' |
| TC11 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | – | Vasculite ANCA — ciclofosfamide + rituximab + mantenimento |
| TC12 | 🟢 0.92 | 1.00 | 0.86 | 6 | 0 | 1 | 1.00 | AR — storia lunga con 3 biologici, reason sempre presenti |
| TC13 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | 1.00 | AR — biosimilare e switch brand per motivi non clinici |
| TC14 | 🟡 0.71 | 0.71 | 0.71 | 5 | 2 | 2 | – | SSc — terapia vascolare e immunosoppressiva complessa |
| TC15 | 🟢 0.80 | 1.00 | 0.67 | 4 | 0 | 2 | 0.00 | AR — raccordo vago con farmaci citati senza struttura di inizio/fine |

---

## Frequenza errori

| Categoria errore | Occorrenze |
|---|---|
| `MISSING_START` | 16 |
| `MISSING_STOP` | 13 |
| `DATE_MISMATCH` | 8 |
| `EXTRA_EVENT` | 4 |
| `REASON_PARTIAL` | 2 |
| `MISSING_SPACING` | 1 |
| `MISSING_DOSE_CHANGE` | 1 |

---

## Peggiori 5 test case (per F1)

### TC09 — F1 0.22 — AR — formato elenco puntato (stile lettera strutturata)

**Input raccordo:**
```
STORIA TERAPEUTICA:
- 2010-2012: Metotressato 10 mg/settimana (sospeso per citopenia)
- 2012-2016: Leflunomide 20 mg/die + Idrossiclorochina 200 mg/die
- 2016: sospensione Leflunomide per epatotossicità, proseguita HCQ
- 2016-2019: Etanercept 50 mg/settimana (sospeso per infezione cutanea grave)
- 2019-oggi: Upadacitinib 15 mg/die, buon controllo
```

**Ground truth (8 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Methotrexate | therapy_start | 2010 | – |
| Methotrexate | therapy_stop | 2012 | citopenia |
| Leflunomide | therapy_start | 2012 | – |
| Idrossiclorochina | therapy_start | 2012 | – |
| Leflunomide | therapy_stop | 2016 | epatotossicità |
| Etanercept | therapy_start | 2016 | – |
| Etanercept | therapy_stop | 2019 | infezione cutanea grave |
| Upadacitinib | therapy_start | 2019 | – |

**Parser output (1 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Methotrexate | therapy_stop | – | citopenia) | 0.70 | STORIA TERAPEUTICA: - 2010-2012: Metotressato 10 mg/settimana (sospeso per citop… |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_START` | Methotrexate | therapy_start | 2010 | – | – | – |
| FN | `MISSING_START` | Leflunomide | therapy_start | 2012 | – | – | – |
| FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2012 | – | – | – |
| FN | `MISSING_STOP` | Leflunomide | therapy_stop | 2016 | – | epatotossicità | – |
| FN | `MISSING_START` | Etanercept | therapy_start | 2016 | – | – | – |
| FN | `MISSING_STOP` | Etanercept | therapy_stop | 2019 | – | infezione cutanea grave | – |
| FN | `MISSING_START` | Upadacitinib | therapy_start | 2019 | – | – | – |

### TC10 — F1 0.44 — SpA — sospensione implicita con verbo 'passato a' e 'sostituito'

**Input raccordo:**
```
Artrite psoriasica con interessamento poliarticolare e assiale, diagnosi 2012. Methotrexate 15 mg/settimana dal 2012, senza beneficio sulla componente assiale. Nel 2014 iniziato Adalimumab 40 mg ogni 2 settimane; risposta inizialmente buona. Nel 2017 perdita di risposta; passato a Golimumab 50 mg mensile. Nel 2020 inefficacia Golimumab; sostituito con Ixekizumab 80 mg ogni 4 settimane. Ottima risposta cutanea e articolare. Nel 2024 spacing a ogni 8 settimane per remissione sostenuta.
```

**Ground truth (7 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Methotrexate | therapy_start | 2012 | – |
| Adalimumab | therapy_start | 2014 | – |
| Adalimumab | therapy_stop | 2017 | perdita di risposta |
| Golimumab | therapy_start | 2017 | – |
| Golimumab | therapy_stop | 2020 | inefficacia |
| Ixekizumab | therapy_start | 2020 | – |
| Ixekizumab | dose_spacing | 2024 | – |

**Parser output (2 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Methotrexate | therapy_start | 2012 | – | 0.90 | Methotrexate 15 mg/settimana dal 2012, senza beneficio sulla componente assiale. |
| Adalimumab | therapy_start | 2014 | – | 0.90 | Nel 2014 iniziato Adalimumab 40 mg ogni 2 settimane; |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2017 | – | perdita di risposta | – |
| FN | `MISSING_START` | Golimumab | therapy_start | 2017 | – | – | – |
| FN | `MISSING_STOP` | Golimumab | therapy_stop | 2020 | – | inefficacia | – |
| FN | `MISSING_START` | Ixekizumab | therapy_start | 2020 | – | – | – |
| FN | `MISSING_SPACING` | Ixekizumab | dose_spacing | 2024 | – | – | – |

### TC01 — F1 0.57 — Stop+ripresa con date esplicite

**Input raccordo:**
```
Paziente con artrite reumatoide sieropositiva (FR+, anti-CCP+), esordita nel 2011 con interessamento poliarticolare simmetrico. Dal 2011 in terapia con Methotrexate 15 mg/settimana. Sospeso nel settembre 2022 per intolleranza gastrica severa. Ripreso a dicembre 2022 dopo 3 mesi di wash-out con aggiunta di acido folico. Sospeso definitivamente a luglio 2023 per persistente intolleranza GI. Dal luglio 2023 avviato Baricitinib 4 mg/die con buon controllo di malattia.
```

**Ground truth (5 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Methotrexate | therapy_start | 2011 | – |
| Methotrexate | therapy_stop | 2022 | intolleranza gastrica severa |
| Methotrexate | therapy_start | 2022 | – |
| Methotrexate | therapy_stop | 2023 | persistente intolleranza GI |
| Baricitinib | therapy_start | 2023 | – |

**Parser output (2 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Methotrexate | therapy_start | 2011 | – | 0.90 | Dal 2011 in terapia con Methotrexate 15 mg/settimana. |
| Baricitinib | therapy_start | 2023 | – | 0.90 | Dal luglio 2023 avviato Baricitinib 4 mg/die con buon controllo di malattia. |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2022 | – | intolleranza gastrica severa | – |
| FN | `MISSING_START` | Methotrexate | therapy_start | 2022 | – | – | – |
| FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2023 | – | persistente intolleranza GI | – |

### TC14 — F1 0.71 — SSc — terapia vascolare e immunosoppressiva complessa

**Input raccordo:**
```
Sclerosi sistemica diffusa (SSc-dcSSc), diagnosi 2016, anticorpi anti-Scl70+. Coinvolgimento: ILD con FVC 65%, ipertensione polmonare borderline, Raynaud grave con ulcere digitali. Dalla diagnosi: Nifedipina 30 mg/die per Raynaud, Sildenafil 25 mg tid aggiunto nel 2017 per ulcere digitali refrattarie. Bosentan 125 mg bid avviato nel 2018 per progressione PAP. Micofenolato Mofetil 2g/die dal 2016 per ILD. Nel 2021 progressione ILD (FVC 55%); aggiunto Nintedanib 150 mg bid. Nel 2022 sospeso MMF per intolleranza GI severa; mantenuto Nintedanib. Rituximab 1g x2 avviato nel 2023 per progressione ILD nonostante Nintedanib.
```

**Ground truth (7 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Nifedipina | therapy_start | 2016 | – |
| Micofenolato Mofetil | therapy_start | 2016 | – |
| Sildenafil | therapy_start | 2017 | – |
| Bosentan | therapy_start | 2018 | – |
| Nintedanib | therapy_start | 2021 | – |
| Micofenolato Mofetil | therapy_stop | 2022 | intolleranza GI severa |
| Rituximab | therapy_start | 2023 | – |

**Parser output (7 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Sildenafil | therapy_start | 2017 | – | 0.90 | Dalla diagnosi: Nifedipina 30 mg/die per Raynaud, Sildenafil 25 mg tid aggiunto … |
| Bosentan | therapy_start | 2018 | – | 0.90 | Bosentan 125 mg bid avviato nel 2018 per progressione PAP. |
| Micofenolato Mofetil | therapy_start | 2016 | – | 0.90 | Micofenolato Mofetil 2g/die dal 2016 per ILD. |
| Nintedanib | therapy_start | 2022 | – | 0.90 | aggiunto Nintedanib 150 mg bid. Nel 2022 sospeso MMF per intolleranza GI severa; |
| Micofenolato Mofetil | therapy_start | 2022 | – | 0.90 | aggiunto Nintedanib 150 mg bid. Nel 2022 sospeso MMF per intolleranza GI severa; |
| Nintedanib | therapy_stop | 2022 | intolleranza GI severa | 0.90 | aggiunto Nintedanib 150 mg bid. Nel 2022 sospeso MMF per intolleranza GI severa; |
| Rituximab | therapy_start | 2023 | – | 0.90 | Rituximab 1g x2 avviato nel 2023 per progressione ILD nonostante Nintedanib. |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| TP_WITH_ERROR | `DATE_MISMATCH` | Nintedanib | therapy_start | 2021 | 2022 | – | – |
| FN | `MISSING_START` | Nifedipina | therapy_start | 2016 | – | – | – |
| FN | `MISSING_STOP` | Micofenolato Mofetil | therapy_stop | 2022 | – | intolleranza GI severa | – |
| FP | `EXTRA_EVENT` | Micofenolato Mofetil | therapy_start | – | 2022 | – | – |
| FP | `EXTRA_EVENT` | Nintedanib | therapy_stop | – | 2022 | – | intolleranza GI severa |

### TC15 — F1 0.80 — AR — raccordo vago con farmaci citati senza struttura di inizio/fine

**Input raccordo:**
```
La paziente ci viene riferita per AR FR+/CCP+ di lunga data. Dall'anamnesi emerge che negli ultimi 15 anni ha assunto vari farmaci: inizialmente Methotrexate, poi aggiunta di Leflunomide che ha poi smesso per mal di stomaco. Ha fatto anche la 'flebo' di Infliximab per un periodo, sospesa perché non la tollerava bene. Attualmente riferisce di assumere solo Prednisone 5 mg e di stare aspettando l'appuntamento per una nuova terapia biologica. Non ricorda le date precise.
```

**Ground truth (6 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Methotrexate | therapy_start | – | – |
| Leflunomide | therapy_start | – | – |
| Leflunomide | therapy_stop | – | intolleranza gastrica |
| Infliximab | therapy_start | – | – |
| Infliximab | therapy_stop | – | intolleranza |
| Prednisone | therapy_start | – | – |

**Parser output (4 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Methotrexate | therapy_start | – | – | 0.70 | Dall'anamnesi emerge che negli ultimi 15 anni ha assunto vari farmaci: inizialme… |
| Leflunomide | therapy_start | – | – | 0.70 | Dall'anamnesi emerge che negli ultimi 15 anni ha assunto vari farmaci: inizialme… |
| Leflunomide | therapy_stop | – | mal di stomaco | 0.70 | Dall'anamnesi emerge che negli ultimi 15 anni ha assunto vari farmaci: inizialme… |
| Infliximab | therapy_stop | – | un periodo | 0.70 | Ha fatto anche la 'flebo' di Infliximab per un periodo, sospesa perché non la to… |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| TP_WITH_ERROR | `REASON_PARTIAL` | Leflunomide | therapy_stop | – | – | intolleranza gastrica | mal di stomaco |
| TP_WITH_ERROR | `REASON_PARTIAL` | Infliximab | therapy_stop | – | – | intolleranza | un periodo |
| FN | `MISSING_START` | Infliximab | therapy_start | – | – | – | – |
| FN | `MISSING_START` | Prednisone | therapy_start | – | – | – | – |

---

## Dettaglio completo mismatch

| TC | Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|---|
| TC01 | FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2022 | – | intolleranza gastrica severa | – |
| TC01 | FN | `MISSING_START` | Methotrexate | therapy_start | 2022 | – | – | – |
| TC01 | FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2023 | – | persistente intolleranza GI | – |
| TC02 | TP_WITH_ERROR | `DATE_MISMATCH` | Adalimumab | therapy_start | 2013 | 2009 | – | – |
| TC02 | FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2018 | – | inefficacia | – |
| TC03 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2017 | – | – | – |
| TC04 | FN | `MISSING_START` | Methotrexate | therapy_start | – | – | – | – |
| TC05 | TP_WITH_ERROR | `DATE_MISMATCH` | Methotrexate | therapy_start | 2008 | 2010 | – | – |
| TC05 | TP_WITH_ERROR | `DATE_MISMATCH` | Leflunomide | therapy_start | 2012 | 2014 | – | – |
| TC05 | FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2012 | – | tossicità epatica | – |
| TC05 | FP | `EXTRA_EVENT` | Idrossiclorochina | therapy_stop | – | 2012 | – | tossicità epatica (ALT 3x ULN) |
| TC06 | TP_WITH_ERROR | `DATE_MISMATCH` | Leflunomide | therapy_stop | 2011 | 2010 | rash cutaneo diffuso | rash cutaneo diffuso |
| TC06 | TP_WITH_ERROR | `DATE_MISMATCH` | Adalimumab | therapy_stop | 2015 | 2011 | perdita di risposta secondaria | perdita di risposta secondaria |
| TC06 | FN | `MISSING_START` | Rituximab | therapy_start | 2015 | – | – | – |
| TC06 | FN | `MISSING_STOP` | Rituximab | therapy_stop | 2020 | – | polmonite batterica ricorrente | – |
| TC06 | FP | `EXTRA_EVENT` | Adalimumab | therapy_start | – | 2015 | – | – |
| TC07 | TP_WITH_ERROR | `DATE_MISMATCH` | Secukinumab | therapy_start | 2019 | 2022 | – | – |
| TC07 | FN | `MISSING_STOP` | Certolizumab pegol | therapy_stop | 2019 | – | progressivo peggioramento | – |
| TC08 | TP_WITH_ERROR | `DATE_MISMATCH` | Azatioprina | therapy_stop | 2018 | 2015 | leucopenia | leucopenia (GB 2 |
| TC08 | FN | `MISSING_START` | Prednisone | therapy_start | 2014 | – | – | – |
| TC08 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2021 | – | – | – |
| TC09 | FN | `MISSING_START` | Methotrexate | therapy_start | 2010 | – | – | – |
| TC09 | FN | `MISSING_START` | Leflunomide | therapy_start | 2012 | – | – | – |
| TC09 | FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2012 | – | – | – |
| TC09 | FN | `MISSING_STOP` | Leflunomide | therapy_stop | 2016 | – | epatotossicità | – |
| TC09 | FN | `MISSING_START` | Etanercept | therapy_start | 2016 | – | – | – |
| TC09 | FN | `MISSING_STOP` | Etanercept | therapy_stop | 2019 | – | infezione cutanea grave | – |
| TC09 | FN | `MISSING_START` | Upadacitinib | therapy_start | 2019 | – | – | – |
| TC10 | FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2017 | – | perdita di risposta | – |
| TC10 | FN | `MISSING_START` | Golimumab | therapy_start | 2017 | – | – | – |
| TC10 | FN | `MISSING_STOP` | Golimumab | therapy_stop | 2020 | – | inefficacia | – |
| TC10 | FN | `MISSING_START` | Ixekizumab | therapy_start | 2020 | – | – | – |
| TC10 | FN | `MISSING_SPACING` | Ixekizumab | dose_spacing | 2024 | – | – | – |
| TC11 | FN | `MISSING_STOP` | Ciclofosfamide | therapy_stop | 2019 | – | – | – |
| TC12 | FN | `MISSING_STOP` | Infliximab | therapy_stop | 2010 | – | anticorpi anti-farmaco | – |
| TC13 | FN | `MISSING_DOSE_CHANGE` | Tofacitinib | dose_change | – | – | incremento transaminasi | – |
| TC14 | TP_WITH_ERROR | `DATE_MISMATCH` | Nintedanib | therapy_start | 2021 | 2022 | – | – |
| TC14 | FN | `MISSING_START` | Nifedipina | therapy_start | 2016 | – | – | – |
| TC14 | FN | `MISSING_STOP` | Micofenolato Mofetil | therapy_stop | 2022 | – | intolleranza GI severa | – |
| TC14 | FP | `EXTRA_EVENT` | Micofenolato Mofetil | therapy_start | – | 2022 | – | – |
| TC14 | FP | `EXTRA_EVENT` | Nintedanib | therapy_stop | – | 2022 | – | intolleranza GI severa |
| TC15 | TP_WITH_ERROR | `REASON_PARTIAL` | Leflunomide | therapy_stop | – | – | intolleranza gastrica | mal di stomaco |
| TC15 | TP_WITH_ERROR | `REASON_PARTIAL` | Infliximab | therapy_stop | – | – | intolleranza | un periodo |
| TC15 | FN | `MISSING_START` | Infliximab | therapy_start | – | – | – | – |
| TC15 | FN | `MISSING_START` | Prednisone | therapy_start | – | – | – | – |
