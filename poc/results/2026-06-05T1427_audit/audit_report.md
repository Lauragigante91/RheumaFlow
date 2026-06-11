# Audit parser raccordoParser — Risultati live

**Generato:** 05/06/2026, 14:27:24
**Parser:** raccordoParser.js (bundle live)
**Test case:** 15 (TC01–TC15)

---

## Metriche aggregate

| Metrica | Valore |
|---|---|
| Macro-F1 | **0.889** [##################--] |
| Micro-F1 | **0.901** [##################--] |
| Micro-Precisione | 96.3% |
| Micro-Recall | 84.6% |
| Avg Reason Recall | 79.2% |
| Totale TP | 77 |
| Totale FP | 3 |
| Totale FN | 14 |
| Eventi GT totali | 91 |
| Eventi parser totali | 80 |

---

## Risultati per test case

| ID | F1 | Pre | Rec | TP | FP | FN | RR | Descrizione |
|---|---|---|---|---|---|---|---|---|
| TC01 | 🟢 0.75 | 1.00 | 0.60 | 3 | 0 | 2 | – | Stop+ripresa con date esplicite |
| TC02 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | – | Switch biologico con spacing e anafora |
| TC03 | 🟢 0.75 | 0.75 | 0.75 | 3 | 1 | 1 | 1.00 | Negazione sospensione + terapia mai interrotta |
| TC04 | 🟢 0.89 | 0.80 | 1.00 | 4 | 1 | 0 | 1.00 | Narrativo senza date (solo sequenza temporale relativa) |
| TC05 | 🟢 1.00 | 1.00 | 1.00 | 6 | 0 | 0 | 1.00 | Multiple sospensioni con ragioni diverse + switch |
| TC06 | 🟢 1.00 | 1.00 | 1.00 | 9 | 0 | 0 | 1.00 | AR — stile abbreviato da reumatologo esperto (MTX/ADA/RTX) |
| TC07 | 🟢 1.00 | 1.00 | 1.00 | 5 | 0 | 0 | 0.50 | SpA — raccordo con ragionamento clinico esplicitato |
| TC08 | 🟢 0.86 | 1.00 | 0.75 | 6 | 0 | 2 | 1.00 | LES — immunosoppressori, gravidanza, switch in corso |
| TC09 | 🟢 1.00 | 1.00 | 1.00 | 8 | 0 | 0 | 1.00 | AR — formato elenco puntato (stile lettera strutturata) |
| TC10 | 🟢 0.92 | 1.00 | 0.86 | 6 | 0 | 1 | 0.00 | SpA — sospensione implicita con verbo 'passato a' e 'sostituito' |
| TC11 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | – | Vasculite ANCA — ciclofosfamide + rituximab + mantenimento |
| TC12 | 🟢 0.77 | 0.83 | 0.71 | 5 | 1 | 2 | 1.00 | AR — storia lunga con 3 biologici, reason sempre presenti |
| TC13 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | 1.00 | AR — biosimilare e switch brand per motivi non clinici |
| TC14 | 🟢 0.92 | 1.00 | 0.86 | 6 | 0 | 1 | 1.00 | SSc — terapia vascolare e immunosoppressiva complessa |
| TC15 | 🟢 0.80 | 1.00 | 0.67 | 4 | 0 | 2 | 0.00 | AR — raccordo vago con farmaci citati senza struttura di inizio/fine |

---

## Frequenza errori

| Categoria errore | Occorrenze |
|---|---|
| `MISSING_START` | 7 |
| `DATE_MISMATCH` | 5 |
| `MISSING_STOP` | 5 |
| `EXTRA_EVENT` | 3 |
| `REASON_MISSING` | 3 |
| `REASON_PARTIAL` | 2 |
| `MISSING_SPACING` | 1 |
| `MISSING_DOSE_CHANGE` | 1 |

---

## Peggiori 5 test case (per F1)

### TC01 — F1 0.75 — Stop+ripresa con date esplicite

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

**Parser output (3 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Methotrexate | therapy_start | – | – | 0.70 | Dal 2011 in terapia con Methotrexate 15 mg/settimana. |
| Methotrexate | therapy_start | 2011 | – | 0.90 | Dal 2011 in terapia con Methotrexate 15 mg/settimana. |
| Baricitinib | therapy_start | 2023 | – | 0.90 | Dal luglio 2023 avviato Baricitinib 4 mg/die con buon controllo di malattia. |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| TP_WITH_ERROR | `DATE_MISMATCH` | Methotrexate | therapy_start | 2022 | 2011 | – | – |
| FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2022 | – | intolleranza gastrica severa | – |
| FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2023 | – | persistente intolleranza GI | – |

### TC03 — F1 0.75 — Negazione sospensione + terapia mai interrotta

**Input raccordo:**
```
LES con nefrite lupica classe III diagnosticato nel 2015. In terapia con Idrossiclorochina 200 mg/die mai sospesa dal 2015. Dal 2015 Prednisone 5 mg/die, ridotto progressivamente. Nel 2017 esordio nefrite, aggiunto Micofenolato Mofetil 2g/die. Nel 2019 remissione renale; tapering del Micofenolato a 1g/die. Nel 2021 sospeso Micofenolato per gravidanza programmata.
```

**Ground truth (4 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Idrossiclorochina | therapy_start | 2015 | – |
| Prednisone | therapy_start | 2015 | – |
| Micofenolato Mofetil | therapy_start | 2017 | – |
| Micofenolato Mofetil | therapy_stop | 2021 | gravidanza programmata |

**Parser output (4 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Idrossiclorochina | therapy_start | – | – | 0.70 | In terapia con Idrossiclorochina 200 mg/die mai sospesa dal 2015. |
| Idrossiclorochina | therapy_start | 2015 | – | 0.90 | In terapia con Idrossiclorochina 200 mg/die mai sospesa dal 2015. |
| Prednisone | therapy_start | 2015 | – | 0.90 | Dal 2015 Prednisone 5 mg/die, ridotto progressivamente. |
| Micofenolato Mofetil | therapy_stop | 2021 | gravidanza programmata | 0.90 | Nel 2021 sospeso Micofenolato per gravidanza programmata. |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2017 | – | – | – |
| FP | `EXTRA_EVENT` | Idrossiclorochina | therapy_start | – | 2015 | – | – |

### TC12 — F1 0.77 — AR — storia lunga con 3 biologici, reason sempre presenti

**Input raccordo:**
```
Artrite reumatoide sieronegativa, esordio 2003 con poliartrite erosiva. Dal 2003 Methotrexate 15 mg/sett. + Idrossiclorochina. Nel 2007 aggiunto Infliximab 3 mg/kg per risposta insufficiente al cDMARD; sospeso nel 2010 per anticorpi anti-farmaco con perdita di efficacia. Dal 2010 Etanercept 50 mg/sett, sospeso nel 2013 per infezione delle vie urinarie recidivante (3 episodi/anno). Dal 2013 Abatacept ev mensile; incrementata la dose nel 2016 per flare persistente. Nel 2020 switch a Abatacept sc per autonomia del paziente. Attualmente in remissione DAS28 1.8.
```

**Ground truth (7 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Methotrexate | therapy_start | 2003 | – |
| Idrossiclorochina | therapy_start | 2003 | – |
| Infliximab | therapy_start | 2007 | – |
| Infliximab | therapy_stop | 2010 | anticorpi anti-farmaco |
| Etanercept | therapy_start | 2010 | – |
| Etanercept | therapy_stop | 2013 | infezione vie urinarie recidivante |
| Abatacept | therapy_start | 2013 | – |

**Parser output (6 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Methotrexate | therapy_start | 2003 | – | 0.90 | Dal 2003 Methotrexate 15 mg/sett. |
| Infliximab | therapy_start | – | – | 0.70 | Nel 2007 aggiunto Infliximab 3 mg/kg per risposta insufficiente al cDMARD; |
| Infliximab | therapy_start | 2007 | – | 0.90 | Nel 2007 aggiunto Infliximab 3 mg/kg per risposta insufficiente al cDMARD; |
| Etanercept | therapy_start | 2010 | – | 0.90 | Dal 2010 Etanercept 50 mg/sett, sospeso nel 2013 per infezione delle vie urinari… |
| Etanercept | therapy_stop | 2013 | infezione delle vie urinarie recidivante (3 episodi/anno) | 0.90 | Dal 2010 Etanercept 50 mg/sett, sospeso nel 2013 per infezione delle vie urinari… |
| Abatacept | therapy_start | 2013 | – | 0.90 | Dal 2013 Abatacept ev mensile; |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2003 | – | – | – |
| FN | `MISSING_STOP` | Infliximab | therapy_stop | 2010 | – | anticorpi anti-farmaco | – |
| FP | `EXTRA_EVENT` | Infliximab | therapy_start | – | 2007 | – | – |

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

### TC08 — F1 0.86 — LES — immunosoppressori, gravidanza, switch in corso

**Input raccordo:**
```
LES con coinvolgimento cutaneo, articolare e renale (nefrite classe II), diagnosi 2014. Idrossiclorochina 200 mg/die in corso dal 2014 senza interruzioni. Prednisone a dosi variabili, attualmente 5 mg/die. Azatioprina 100 mg/die avviata nel 2015, sospesa nel 2018 per leucopenia (GB 2.1x10³). Micofenolato Mofetil 1.5g/die dal 2018. Nel 2020 sospeso MMF per gravidanza programmata; mantenuta solo Idrossiclorochina. Nel 2021 ripreso MMF post-partum 1g/die, progressivamente aumentato a 2g/die. Nel 2023 esordio nefrite classe III; potenziato con Belimumab 200 mg/settimana sottocute.
```

**Ground truth (8 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Idrossiclorochina | therapy_start | 2014 | – |
| Prednisone | therapy_start | 2014 | – |
| Azatioprina | therapy_start | 2015 | – |
| Azatioprina | therapy_stop | 2018 | leucopenia |
| Micofenolato Mofetil | therapy_start | 2018 | – |
| Micofenolato Mofetil | therapy_stop | 2020 | gravidanza programmata |
| Micofenolato Mofetil | therapy_start | 2021 | – |
| Belimumab | therapy_start | 2023 | – |

**Parser output (6 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Idrossiclorochina | therapy_start | 2014 | – | 0.90 | Idrossiclorochina 200 mg/die in corso dal 2014 senza interruzioni. |
| Azatioprina | therapy_start | 2015 | – | 0.90 | Azatioprina 100 mg/die avviata nel 2015, sospesa nel 2018 per leucopenia (GB 2.1… |
| Azatioprina | therapy_stop | 2015 | leucopenia (GB 2 | 0.90 | Azatioprina 100 mg/die avviata nel 2015, sospesa nel 2018 per leucopenia (GB 2.1… |
| Micofenolato Mofetil | therapy_start | 2018 | – | 0.90 | Micofenolato Mofetil 1.5g/die dal 2018. |
| Micofenolato Mofetil | therapy_stop | 2020 | gravidanza programmata | 0.90 | Nel 2020 sospeso MMF per gravidanza programmata; |
| Belimumab | therapy_start | – | – | 0.70 | potenziato con Belimumab 200 mg/settimana sottocute. |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| TP_WITH_ERROR | `DATE_MISMATCH` | Azatioprina | therapy_stop | 2018 | 2015 | leucopenia | leucopenia (GB 2 |
| FN | `MISSING_START` | Prednisone | therapy_start | 2014 | – | – | – |
| FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2021 | – | – | – |

---

## Dettaglio completo mismatch

| TC | Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|---|
| TC01 | TP_WITH_ERROR | `DATE_MISMATCH` | Methotrexate | therapy_start | 2022 | 2011 | – | – |
| TC01 | FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2022 | – | intolleranza gastrica severa | – |
| TC01 | FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2023 | – | persistente intolleranza GI | – |
| TC02 | FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2018 | – | inefficacia | – |
| TC03 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2017 | – | – | – |
| TC03 | FP | `EXTRA_EVENT` | Idrossiclorochina | therapy_start | – | 2015 | – | – |
| TC04 | FP | `EXTRA_EVENT` | FANS | therapy_start | – | – | – | – |
| TC06 | TP_WITH_ERROR | `DATE_MISMATCH` | Leflunomide | therapy_stop | 2011 | 2010 | rash cutaneo diffuso | rash cutaneo diffuso |
| TC06 | TP_WITH_ERROR | `DATE_MISMATCH` | Adalimumab | therapy_stop | 2015 | 2011 | perdita di risposta secondaria | perdita di risposta secondaria |
| TC06 | TP_WITH_ERROR | `DATE_MISMATCH` | Rituximab | therapy_stop | 2020 | 2015 | polmonite batterica ricorrente | polmonite batterica ricorrente |
| TC07 | TP_WITH_ERROR | `REASON_MISSING` | Certolizumab pegol | therapy_stop | 2019 | 2019 | progressivo peggioramento | – |
| TC08 | TP_WITH_ERROR | `DATE_MISMATCH` | Azatioprina | therapy_stop | 2018 | 2015 | leucopenia | leucopenia (GB 2 |
| TC08 | FN | `MISSING_START` | Prednisone | therapy_start | 2014 | – | – | – |
| TC08 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2021 | – | – | – |
| TC10 | TP_WITH_ERROR | `REASON_MISSING` | Adalimumab | therapy_stop | 2017 | 2017 | perdita di risposta | – |
| TC10 | TP_WITH_ERROR | `REASON_MISSING` | Golimumab | therapy_stop | 2020 | 2020 | inefficacia | – |
| TC10 | FN | `MISSING_SPACING` | Ixekizumab | dose_spacing | 2024 | – | – | – |
| TC11 | FN | `MISSING_STOP` | Ciclofosfamide | therapy_stop | 2019 | – | – | – |
| TC12 | FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2003 | – | – | – |
| TC12 | FN | `MISSING_STOP` | Infliximab | therapy_stop | 2010 | – | anticorpi anti-farmaco | – |
| TC12 | FP | `EXTRA_EVENT` | Infliximab | therapy_start | – | 2007 | – | – |
| TC13 | FN | `MISSING_DOSE_CHANGE` | Tofacitinib | dose_change | – | – | incremento transaminasi | – |
| TC14 | FN | `MISSING_START` | Nifedipina | therapy_start | 2016 | – | – | – |
| TC15 | TP_WITH_ERROR | `REASON_PARTIAL` | Leflunomide | therapy_stop | – | – | intolleranza gastrica | mal di stomaco |
| TC15 | TP_WITH_ERROR | `REASON_PARTIAL` | Infliximab | therapy_stop | – | – | intolleranza | un periodo |
| TC15 | FN | `MISSING_START` | Infliximab | therapy_start | – | – | – | – |
| TC15 | FN | `MISSING_START` | Prednisone | therapy_start | – | – | – | – |
