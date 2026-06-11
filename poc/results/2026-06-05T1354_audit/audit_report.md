# Audit parser raccordoParser — Risultati live

**Generato:** 05/06/2026, 13:54:02
**Parser:** raccordoParser.js (bundle live)
**Test case:** 15 (TC01–TC15)

---

## Metriche aggregate

| Metrica | Valore |
|---|---|
| Macro-F1 | **0.831** [#################---] |
| Micro-F1 | **0.855** [#################---] |
| Micro-Precisione | 100.0% |
| Micro-Recall | 74.7% |
| Avg Reason Recall | 90.9% |
| Totale TP | 68 |
| Totale FP | 0 |
| Totale FN | 23 |
| Eventi GT totali | 91 |
| Eventi parser totali | 68 |

---

## Risultati per test case

| ID | F1 | Pre | Rec | TP | FP | FN | RR | Descrizione |
|---|---|---|---|---|---|---|---|---|
| TC01 | 🟡 0.57 | 1.00 | 0.40 | 2 | 0 | 3 | – | Stop+ripresa con date esplicite |
| TC02 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | – | Switch biologico con spacing e anafora |
| TC03 | 🟢 0.86 | 1.00 | 0.75 | 3 | 0 | 1 | 1.00 | Negazione sospensione + terapia mai interrotta |
| TC04 | 🟢 0.86 | 1.00 | 0.75 | 3 | 0 | 1 | 1.00 | Narrativo senza date (solo sequenza temporale relativa) |
| TC05 | 🟢 0.91 | 1.00 | 0.83 | 5 | 0 | 1 | 1.00 | Multiple sospensioni con ragioni diverse + switch |
| TC06 | 🟢 1.00 | 1.00 | 1.00 | 9 | 0 | 0 | 1.00 | AR — stile abbreviato da reumatologo esperto (MTX/ADA/RTX) |
| TC07 | 🟢 0.75 | 1.00 | 0.60 | 3 | 0 | 2 | 1.00 | SpA — raccordo con ragionamento clinico esplicitato |
| TC08 | 🟢 0.86 | 1.00 | 0.75 | 6 | 0 | 2 | 1.00 | LES — immunosoppressori, gravidanza, switch in corso |
| TC09 | 🟢 1.00 | 1.00 | 1.00 | 8 | 0 | 0 | 1.00 | AR — formato elenco puntato (stile lettera strutturata) |
| TC10 | 🔴 0.44 | 1.00 | 0.29 | 2 | 0 | 5 | – | SpA — sospensione implicita con verbo 'passato a' e 'sostituito' |
| TC11 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | – | Vasculite ANCA — ciclofosfamide + rituximab + mantenimento |
| TC12 | 🟢 0.83 | 1.00 | 0.71 | 5 | 0 | 2 | 1.00 | AR — storia lunga con 3 biologici, reason sempre presenti |
| TC13 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | 1.00 | AR — biosimilare e switch brand per motivi non clinici |
| TC14 | 🟢 0.92 | 1.00 | 0.86 | 6 | 0 | 1 | 1.00 | SSc — terapia vascolare e immunosoppressiva complessa |
| TC15 | 🟢 0.80 | 1.00 | 0.67 | 4 | 0 | 2 | 0.00 | AR — raccordo vago con farmaci citati senza struttura di inizio/fine |

---

## Frequenza errori

| Categoria errore | Occorrenze |
|---|---|
| `MISSING_START` | 13 |
| `MISSING_STOP` | 8 |
| `DATE_MISMATCH` | 4 |
| `REASON_PARTIAL` | 2 |
| `MISSING_SPACING` | 1 |
| `MISSING_DOSE_CHANGE` | 1 |

---

## Peggiori 5 test case (per F1)

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

### TC07 — F1 0.75 — SpA — raccordo con ragionamento clinico esplicitato

**Input raccordo:**
```
Spondilite anchilosante HLA-B27 positiva, diagnosi 2013. Prima del nostro follow-up riferisce Sulfasalazina 2g assunta dal 2013 al 2015, sospesa per scarsa risposta assiale (BASDAI >4 nonostante compliance). Nel 2015 iniziato Certolizumab pegol 200 mg ogni 2 settimane con buona risposta iniziale. Nel 2018 progressivo peggioramento della rigidità mattutina; incrementato a dose piena ogni 2 settimane senza miglioramento. Nel 2019 switch a Secukinumab 150 mg mensile con risposta eccellente. Dal 2022 in remissione clinica, ASDAS <1.3.
```

**Ground truth (5 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Sulfasalazina | therapy_start | 2013 | – |
| Sulfasalazina | therapy_stop | 2015 | scarsa risposta assiale |
| Certolizumab pegol | therapy_start | 2015 | – |
| Certolizumab pegol | therapy_stop | 2019 | progressivo peggioramento |
| Secukinumab | therapy_start | 2019 | – |

**Parser output (3 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Sulfasalazina | therapy_start | 2013 | – | 0.90 | Prima del nostro follow-up riferisce Sulfasalazina 2g assunta dal 2013 al 2015, … |
| Sulfasalazina | therapy_stop | – | scarsa risposta assiale (BASDAI >4 nonostante compliance) | 0.70 | Prima del nostro follow-up riferisce Sulfasalazina 2g assunta dal 2013 al 2015, … |
| Certolizumab pegol | therapy_start | 2015 | – | 0.90 | Nel 2015 iniziato Certolizumab pegol 200 mg ogni 2 settimane con buona risposta … |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_STOP` | Certolizumab pegol | therapy_stop | 2019 | – | progressivo peggioramento | – |
| FN | `MISSING_START` | Secukinumab | therapy_start | 2019 | – | – | – |

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

### TC12 — F1 0.83 — AR — storia lunga con 3 biologici, reason sempre presenti

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

**Parser output (5 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Methotrexate | therapy_start | 2003 | – | 0.90 | Dal 2003 Methotrexate 15 mg/sett. |
| Infliximab | therapy_start | 2007 | – | 0.90 | Nel 2007 aggiunto Infliximab 3 mg/kg per risposta insufficiente al cDMARD; |
| Etanercept | therapy_start | 2010 | – | 0.90 | Dal 2010 Etanercept 50 mg/sett, sospeso nel 2013 per infezione delle vie urinari… |
| Etanercept | therapy_stop | 2013 | infezione delle vie urinarie recidivante (3 episodi/anno) | 0.90 | Dal 2010 Etanercept 50 mg/sett, sospeso nel 2013 per infezione delle vie urinari… |
| Abatacept | therapy_start | 2013 | – | 0.90 | Dal 2013 Abatacept ev mensile; |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2003 | – | – | – |
| FN | `MISSING_STOP` | Infliximab | therapy_stop | 2010 | – | anticorpi anti-farmaco | – |

---

## Dettaglio completo mismatch

| TC | Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|---|
| TC01 | FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2022 | – | intolleranza gastrica severa | – |
| TC01 | FN | `MISSING_START` | Methotrexate | therapy_start | 2022 | – | – | – |
| TC01 | FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2023 | – | persistente intolleranza GI | – |
| TC02 | FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2018 | – | inefficacia | – |
| TC03 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2017 | – | – | – |
| TC04 | FN | `MISSING_START` | Methotrexate | therapy_start | – | – | – | – |
| TC05 | FN | `MISSING_START` | Methotrexate | therapy_start | 2008 | – | – | – |
| TC06 | TP_WITH_ERROR | `DATE_MISMATCH` | Leflunomide | therapy_stop | 2011 | 2010 | rash cutaneo diffuso | rash cutaneo diffuso |
| TC06 | TP_WITH_ERROR | `DATE_MISMATCH` | Adalimumab | therapy_stop | 2015 | 2011 | perdita di risposta secondaria | perdita di risposta secondaria |
| TC06 | TP_WITH_ERROR | `DATE_MISMATCH` | Rituximab | therapy_stop | 2020 | 2015 | polmonite batterica ricorrente | polmonite batterica ricorrente |
| TC07 | FN | `MISSING_STOP` | Certolizumab pegol | therapy_stop | 2019 | – | progressivo peggioramento | – |
| TC07 | FN | `MISSING_START` | Secukinumab | therapy_start | 2019 | – | – | – |
| TC08 | TP_WITH_ERROR | `DATE_MISMATCH` | Azatioprina | therapy_stop | 2018 | 2015 | leucopenia | leucopenia (GB 2 |
| TC08 | FN | `MISSING_START` | Prednisone | therapy_start | 2014 | – | – | – |
| TC08 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2021 | – | – | – |
| TC10 | FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2017 | – | perdita di risposta | – |
| TC10 | FN | `MISSING_START` | Golimumab | therapy_start | 2017 | – | – | – |
| TC10 | FN | `MISSING_STOP` | Golimumab | therapy_stop | 2020 | – | inefficacia | – |
| TC10 | FN | `MISSING_START` | Ixekizumab | therapy_start | 2020 | – | – | – |
| TC10 | FN | `MISSING_SPACING` | Ixekizumab | dose_spacing | 2024 | – | – | – |
| TC11 | FN | `MISSING_STOP` | Ciclofosfamide | therapy_stop | 2019 | – | – | – |
| TC12 | FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2003 | – | – | – |
| TC12 | FN | `MISSING_STOP` | Infliximab | therapy_stop | 2010 | – | anticorpi anti-farmaco | – |
| TC13 | FN | `MISSING_DOSE_CHANGE` | Tofacitinib | dose_change | – | – | incremento transaminasi | – |
| TC14 | FN | `MISSING_START` | Nifedipina | therapy_start | 2016 | – | – | – |
| TC15 | TP_WITH_ERROR | `REASON_PARTIAL` | Leflunomide | therapy_stop | – | – | intolleranza gastrica | mal di stomaco |
| TC15 | TP_WITH_ERROR | `REASON_PARTIAL` | Infliximab | therapy_stop | – | – | intolleranza | un periodo |
| TC15 | FN | `MISSING_START` | Infliximab | therapy_start | – | – | – | – |
| TC15 | FN | `MISSING_START` | Prednisone | therapy_start | – | – | – | – |
