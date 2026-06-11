# Audit parser raccordoParser — Risultati live

**Generato:** 05/06/2026, 12:26:39
**Parser:** raccordoParser.js (bundle live)
**Test case:** 15 (TC01–TC15)

---

## Metriche aggregate

| Metrica | Valore |
|---|---|
| Macro-F1 | **0.272** [#####---------------] |
| Micro-F1 | **0.312** [######--------------] |
| Micro-Precisione | 94.4% |
| Micro-Recall | 18.7% |
| Avg Reason Recall | 83.3% |
| Totale TP | 17 |
| Totale FP | 1 |
| Totale FN | 74 |
| Eventi GT totali | 91 |
| Eventi parser totali | 18 |

---

## Risultati per test case

| ID | F1 | Pre | Rec | TP | FP | FN | RR | Descrizione |
|---|---|---|---|---|---|---|---|---|
| TC01 | 🔴 0.33 | 1.00 | 0.20 | 1 | 0 | 4 | – | Stop+ripresa con date esplicite |
| TC02 | 🟢 0.75 | 1.00 | 0.60 | 3 | 0 | 2 | – | Switch biologico con spacing e anafora |
| TC03 | 🔴 0.40 | 1.00 | 0.25 | 1 | 0 | 3 | – | Negazione sospensione + terapia mai interrotta |
| TC04 | 🔴 0.00 | 0.00 | 0.00 | 0 | 0 | 4 | – | Narrativo senza date (solo sequenza temporale relativa) |
| TC05 | 🔴 0.29 | 1.00 | 0.17 | 1 | 0 | 5 | – | Multiple sospensioni con ragioni diverse + switch |
| TC06 | 🔴 0.36 | 1.00 | 0.22 | 2 | 0 | 7 | 1.00 | AR — stile abbreviato da reumatologo esperto (MTX/ADA/RTX) |
| TC07 | 🔴 0.33 | 1.00 | 0.20 | 1 | 0 | 4 | 1.00 | SpA — raccordo con ragionamento clinico esplicitato |
| TC08 | 🔴 0.22 | 1.00 | 0.13 | 1 | 0 | 7 | 1.00 | LES — immunosoppressori, gravidanza, switch in corso |
| TC09 | 🔴 0.22 | 1.00 | 0.13 | 1 | 0 | 7 | 1.00 | AR — formato elenco puntato (stile lettera strutturata) |
| TC10 | 🔴 0.00 | 0.00 | 0.00 | 0 | 0 | 7 | – | SpA — sospensione implicita con verbo 'passato a' e 'sostituito' |
| TC11 | 🔴 0.00 | 0.00 | 0.00 | 0 | 0 | 5 | – | Vasculite ANCA — ciclofosfamide + rituximab + mantenimento |
| TC12 | 🟡 0.73 | 1.00 | 0.57 | 4 | 0 | 3 | 1.00 | AR — storia lunga con 3 biologici, reason sempre presenti |
| TC13 | 🔴 0.00 | 0.00 | 0.00 | 0 | 0 | 5 | – | AR — biosimilare e switch brand per motivi non clinici |
| TC14 | 🔴 0.00 | 0.00 | 0.00 | 0 | 0 | 7 | – | SSc — terapia vascolare e immunosoppressiva complessa |
| TC15 | 🔴 0.44 | 0.67 | 0.33 | 2 | 1 | 4 | 0.00 | AR — raccordo vago con farmaci citati senza struttura di inizio/fine |

---

## Frequenza errori

| Categoria errore | Occorrenze |
|---|---|
| `MISSING_START` | 52 |
| `MISSING_STOP` | 20 |
| `DATE_MISMATCH` | 2 |
| `REASON_PARTIAL` | 2 |
| `MISSING_SPACING` | 1 |
| `MISSING_DOSE_CHANGE` | 1 |
| `EXTRA_EVENT` | 1 |

---

## Peggiori 5 test case (per F1)

### TC04 — F1 0.00 — Narrativo senza date (solo sequenza temporale relativa)

**Input raccordo:**
```
Artrite psoriasica con interessamento assiale e periferico, diagnosi posta circa tre anni fa. Inizialmente trattata con FANS e Methotrexate a basse dosi. Dopo circa un anno di terapia, aggiunto Etanercept per scarso controllo della componente assiale. Dopo sei mesi di trattamento, sospeso Etanercept per reazione cutanea al sito di iniezione. Avviato quindi Ixekizumab, ancora in corso.
```

**Ground truth (4 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Methotrexate | therapy_start | – | – |
| Etanercept | therapy_start | – | – |
| Etanercept | therapy_stop | – | reazione cutanea al sito di iniezione |
| Ixekizumab | therapy_start | – | – |

**Parser output (0 eventi):**

_Nessun evento estratto._


**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_START` | Methotrexate | therapy_start | – | – | – | – |
| FN | `MISSING_START` | Etanercept | therapy_start | – | – | – | – |
| FN | `MISSING_STOP` | Etanercept | therapy_stop | – | – | reazione cutanea al sito di iniezione | – |
| FN | `MISSING_START` | Ixekizumab | therapy_start | – | – | – | – |

### TC10 — F1 0.00 — SpA — sospensione implicita con verbo 'passato a' e 'sostituito'

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

**Parser output (0 eventi):**

_Nessun evento estratto._


**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_START` | Methotrexate | therapy_start | 2012 | – | – | – |
| FN | `MISSING_START` | Adalimumab | therapy_start | 2014 | – | – | – |
| FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2017 | – | perdita di risposta | – |
| FN | `MISSING_START` | Golimumab | therapy_start | 2017 | – | – | – |
| FN | `MISSING_STOP` | Golimumab | therapy_stop | 2020 | – | inefficacia | – |
| FN | `MISSING_START` | Ixekizumab | therapy_start | 2020 | – | – | – |
| FN | `MISSING_SPACING` | Ixekizumab | dose_spacing | 2024 | – | – | – |

### TC11 — F1 0.00 — Vasculite ANCA — ciclofosfamide + rituximab + mantenimento

**Input raccordo:**
```
Vasculite associata ad ANCA (MPO+) con coinvolgimento renale e polmonare, diagnosi 12/2018. Induzione con Ciclofosfamide ev 15 mg/kg ogni 3 settimane per 6 cicli (01/2019-06/2019) e Prednisone 1 mg/kg/die in tapering. Raggiunta remissione completa nel 06/2019. Mantenimento con Rituximab 500 mg ogni 6 mesi (07/2019 in corso). Prednisone progressivamente scalato a 5 mg/die. Nel 2023 recidiva lieve; aumentata frequenza RTX a ogni 4 mesi, aggiunto MMF 1g/die come ancillare.
```

**Ground truth (5 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Ciclofosfamide | therapy_start | 2019 | – |
| Ciclofosfamide | therapy_stop | 2019 | – |
| Prednisone | therapy_start | 2019 | – |
| Rituximab | therapy_start | 2019 | – |
| Micofenolato Mofetil | therapy_start | 2023 | – |

**Parser output (0 eventi):**

_Nessun evento estratto._


**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_START` | Ciclofosfamide | therapy_start | 2019 | – | – | – |
| FN | `MISSING_STOP` | Ciclofosfamide | therapy_stop | 2019 | – | – | – |
| FN | `MISSING_START` | Prednisone | therapy_start | 2019 | – | – | – |
| FN | `MISSING_START` | Rituximab | therapy_start | 2019 | – | – | – |
| FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2023 | – | – | – |

### TC13 — F1 0.00 — AR — biosimilare e switch brand per motivi non clinici

**Input raccordo:**
```
AR sieropositiva, in cura presso il nostro centro dal 2017. Riferisce terapia pregressa: Methotrexate 10 mg/sett. dal 2015, aumentato a 15 mg nel 2016. Nel 2017 introdotto Adalimumab originator 40 mg bisettimanale; nel 2019 switch obbligatorio a biosimilare per decreto regionale senza variazione di efficacia. Nel 2022 sospeso adalimumab per comparsa di psoriasi palmoplantare de novo attribuita al biologico; avviato Tofacitinib 5 mg bid. A 6 mesi di terapia con Tofacitinib incremento delle transaminasi; ridotta dose a 5 mg/die con monitoraggio.
```

**Ground truth (5 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Methotrexate | therapy_start | 2015 | – |
| Adalimumab | therapy_start | 2017 | – |
| Adalimumab | therapy_stop | 2022 | psoriasi palmoplantare de novo |
| Tofacitinib | therapy_start | 2022 | – |
| Tofacitinib | dose_change | – | incremento transaminasi |

**Parser output (0 eventi):**

_Nessun evento estratto._


**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_START` | Methotrexate | therapy_start | 2015 | – | – | – |
| FN | `MISSING_START` | Adalimumab | therapy_start | 2017 | – | – | – |
| FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2022 | – | psoriasi palmoplantare de novo | – |
| FN | `MISSING_START` | Tofacitinib | therapy_start | 2022 | – | – | – |
| FN | `MISSING_DOSE_CHANGE` | Tofacitinib | dose_change | – | – | incremento transaminasi | – |

### TC14 — F1 0.00 — SSc — terapia vascolare e immunosoppressiva complessa

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

**Parser output (0 eventi):**

_Nessun evento estratto._


**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_START` | Nifedipina | therapy_start | 2016 | – | – | – |
| FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2016 | – | – | – |
| FN | `MISSING_START` | Sildenafil | therapy_start | 2017 | – | – | – |
| FN | `MISSING_START` | Bosentan | therapy_start | 2018 | – | – | – |
| FN | `MISSING_START` | Nintedanib | therapy_start | 2021 | – | – | – |
| FN | `MISSING_STOP` | Micofenolato Mofetil | therapy_stop | 2022 | – | intolleranza GI severa | – |
| FN | `MISSING_START` | Rituximab | therapy_start | 2023 | – | – | – |

---

## Dettaglio completo mismatch

| TC | Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|---|
| TC01 | FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2022 | – | intolleranza gastrica severa | – |
| TC01 | FN | `MISSING_START` | Methotrexate | therapy_start | 2022 | – | – | – |
| TC01 | FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2023 | – | persistente intolleranza GI | – |
| TC01 | FN | `MISSING_START` | Baricitinib | therapy_start | 2023 | – | – | – |
| TC02 | FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2018 | – | inefficacia | – |
| TC02 | FN | `MISSING_START` | Secukinumab | therapy_start | 2018 | – | – | – |
| TC03 | FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2015 | – | – | – |
| TC03 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2017 | – | – | – |
| TC03 | FN | `MISSING_STOP` | Micofenolato Mofetil | therapy_stop | 2021 | – | gravidanza programmata | – |
| TC04 | FN | `MISSING_START` | Methotrexate | therapy_start | – | – | – | – |
| TC04 | FN | `MISSING_START` | Etanercept | therapy_start | – | – | – | – |
| TC04 | FN | `MISSING_STOP` | Etanercept | therapy_stop | – | – | reazione cutanea al sito di iniezione | – |
| TC04 | FN | `MISSING_START` | Ixekizumab | therapy_start | – | – | – | – |
| TC05 | FN | `MISSING_START` | Methotrexate | therapy_start | 2008 | – | – | – |
| TC05 | FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2010 | – | – | – |
| TC05 | FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2012 | – | tossicità epatica | – |
| TC05 | FN | `MISSING_START` | Leflunomide | therapy_start | 2012 | – | – | – |
| TC05 | FN | `MISSING_STOP` | Leflunomide | therapy_stop | 2014 | – | nausea persistente | – |
| TC06 | TP_WITH_ERROR | `DATE_MISMATCH` | Leflunomide | therapy_stop | 2011 | 2010 | rash cutaneo diffuso | rash cutaneo diffuso |
| TC06 | FN | `MISSING_START` | Methotrexate | therapy_start | 2006 | – | – | – |
| TC06 | FN | `MISSING_STOP` | Methotrexate | therapy_stop | 2009 | – | ipertransaminasemia | – |
| TC06 | FN | `MISSING_START` | Leflunomide | therapy_start | 2010 | – | – | – |
| TC06 | FN | `MISSING_START` | Adalimumab | therapy_start | 2011 | – | – | – |
| TC06 | FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2015 | – | perdita di risposta secondaria | – |
| TC06 | FN | `MISSING_START` | Rituximab | therapy_start | 2015 | – | – | – |
| TC06 | FN | `MISSING_STOP` | Rituximab | therapy_stop | 2020 | – | polmonite batterica ricorrente | – |
| TC07 | FN | `MISSING_START` | Sulfasalazina | therapy_start | 2013 | – | – | – |
| TC07 | FN | `MISSING_START` | Certolizumab pegol | therapy_start | 2015 | – | – | – |
| TC07 | FN | `MISSING_STOP` | Certolizumab pegol | therapy_stop | 2019 | – | progressivo peggioramento | – |
| TC07 | FN | `MISSING_START` | Secukinumab | therapy_start | 2019 | – | – | – |
| TC08 | TP_WITH_ERROR | `DATE_MISMATCH` | Azatioprina | therapy_stop | 2018 | 2015 | leucopenia | leucopenia (GB 2 |
| TC08 | FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2014 | – | – | – |
| TC08 | FN | `MISSING_START` | Prednisone | therapy_start | 2014 | – | – | – |
| TC08 | FN | `MISSING_START` | Azatioprina | therapy_start | 2015 | – | – | – |
| TC08 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2018 | – | – | – |
| TC08 | FN | `MISSING_STOP` | Micofenolato Mofetil | therapy_stop | 2020 | – | gravidanza programmata | – |
| TC08 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2021 | – | – | – |
| TC08 | FN | `MISSING_START` | Belimumab | therapy_start | 2023 | – | – | – |
| TC09 | FN | `MISSING_START` | Methotrexate | therapy_start | 2010 | – | – | – |
| TC09 | FN | `MISSING_START` | Leflunomide | therapy_start | 2012 | – | – | – |
| TC09 | FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2012 | – | – | – |
| TC09 | FN | `MISSING_STOP` | Leflunomide | therapy_stop | 2016 | – | epatotossicità | – |
| TC09 | FN | `MISSING_START` | Etanercept | therapy_start | 2016 | – | – | – |
| TC09 | FN | `MISSING_STOP` | Etanercept | therapy_stop | 2019 | – | infezione cutanea grave | – |
| TC09 | FN | `MISSING_START` | Upadacitinib | therapy_start | 2019 | – | – | – |
| TC10 | FN | `MISSING_START` | Methotrexate | therapy_start | 2012 | – | – | – |
| TC10 | FN | `MISSING_START` | Adalimumab | therapy_start | 2014 | – | – | – |
| TC10 | FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2017 | – | perdita di risposta | – |
| TC10 | FN | `MISSING_START` | Golimumab | therapy_start | 2017 | – | – | – |
| TC10 | FN | `MISSING_STOP` | Golimumab | therapy_stop | 2020 | – | inefficacia | – |
| TC10 | FN | `MISSING_START` | Ixekizumab | therapy_start | 2020 | – | – | – |
| TC10 | FN | `MISSING_SPACING` | Ixekizumab | dose_spacing | 2024 | – | – | – |
| TC11 | FN | `MISSING_START` | Ciclofosfamide | therapy_start | 2019 | – | – | – |
| TC11 | FN | `MISSING_STOP` | Ciclofosfamide | therapy_stop | 2019 | – | – | – |
| TC11 | FN | `MISSING_START` | Prednisone | therapy_start | 2019 | – | – | – |
| TC11 | FN | `MISSING_START` | Rituximab | therapy_start | 2019 | – | – | – |
| TC11 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2023 | – | – | – |
| TC12 | FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2003 | – | – | – |
| TC12 | FN | `MISSING_START` | Infliximab | therapy_start | 2007 | – | – | – |
| TC12 | FN | `MISSING_STOP` | Infliximab | therapy_stop | 2010 | – | anticorpi anti-farmaco | – |
| TC13 | FN | `MISSING_START` | Methotrexate | therapy_start | 2015 | – | – | – |
| TC13 | FN | `MISSING_START` | Adalimumab | therapy_start | 2017 | – | – | – |
| TC13 | FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2022 | – | psoriasi palmoplantare de novo | – |
| TC13 | FN | `MISSING_START` | Tofacitinib | therapy_start | 2022 | – | – | – |
| TC13 | FN | `MISSING_DOSE_CHANGE` | Tofacitinib | dose_change | – | – | incremento transaminasi | – |
| TC14 | FN | `MISSING_START` | Nifedipina | therapy_start | 2016 | – | – | – |
| TC14 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2016 | – | – | – |
| TC14 | FN | `MISSING_START` | Sildenafil | therapy_start | 2017 | – | – | – |
| TC14 | FN | `MISSING_START` | Bosentan | therapy_start | 2018 | – | – | – |
| TC14 | FN | `MISSING_START` | Nintedanib | therapy_start | 2021 | – | – | – |
| TC14 | FN | `MISSING_STOP` | Micofenolato Mofetil | therapy_stop | 2022 | – | intolleranza GI severa | – |
| TC14 | FN | `MISSING_START` | Rituximab | therapy_start | 2023 | – | – | – |
| TC15 | TP_WITH_ERROR | `REASON_PARTIAL` | Leflunomide | therapy_stop | – | – | intolleranza gastrica | mal di stomaco |
| TC15 | TP_WITH_ERROR | `REASON_PARTIAL` | Infliximab | therapy_stop | – | – | intolleranza | un periodo |
| TC15 | FN | `MISSING_START` | Methotrexate | therapy_start | – | – | – | – |
| TC15 | FN | `MISSING_START` | Leflunomide | therapy_start | – | – | – | – |
| TC15 | FN | `MISSING_START` | Infliximab | therapy_start | – | – | – | – |
| TC15 | FN | `MISSING_START` | Prednisone | therapy_start | – | – | – | – |
| TC15 | FP | `EXTRA_EVENT` | Methotrexate | therapy_stop | – | – | – | mal di stomaco |
