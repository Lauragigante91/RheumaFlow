# Audit parser raccordoParser — Risultati live

**Generato:** 13/06/2026, 03:09:35
**Parser:** raccordoParser.js (bundle live)
**Test case:** 15 (TC01–TC15)

---

## Metriche aggregate

| Metrica | Valore |
|---|---|
| Macro-F1 | **0.942** [###################-] |
| Micro-F1 | **0.948** [###################-] |
| Micro-Precisione | 100.0% |
| Micro-Recall | 90.1% |
| Avg Reason Recall | 80.8% |
| Totale TP | 82 |
| Totale FP | 0 |
| Totale FN | 9 |
| Eventi GT totali | 91 |
| Eventi parser totali | 82 |

---

## Risultati per test case

| ID | F1 | Pre | Rec | TP | FP | FN | RR | Descrizione |
|---|---|---|---|---|---|---|---|---|
| TC01 | 🟢 1.00 | 1.00 | 1.00 | 5 | 0 | 0 | 1.00 | Stop+ripresa con date esplicite |
| TC02 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | – | Switch biologico con spacing e anafora |
| TC03 | 🟢 0.86 | 1.00 | 0.75 | 3 | 0 | 1 | 1.00 | Negazione sospensione + terapia mai interrotta |
| TC04 | 🟢 1.00 | 1.00 | 1.00 | 4 | 0 | 0 | 1.00 | Narrativo senza date (solo sequenza temporale relativa) |
| TC05 | 🟢 1.00 | 1.00 | 1.00 | 6 | 0 | 0 | 1.00 | Multiple sospensioni con ragioni diverse + switch |
| TC06 | 🟢 1.00 | 1.00 | 1.00 | 9 | 0 | 0 | 1.00 | AR — stile abbreviato da reumatologo esperto (MTX/ADA/RTX) |
| TC07 | 🟢 1.00 | 1.00 | 1.00 | 5 | 0 | 0 | 0.50 | SpA — raccordo con ragionamento clinico esplicitato |
| TC08 | 🟢 0.93 | 1.00 | 0.88 | 7 | 0 | 1 | 1.00 | LES — immunosoppressori, gravidanza, switch in corso |
| TC09 | 🟢 1.00 | 1.00 | 1.00 | 8 | 0 | 0 | 1.00 | AR — formato elenco puntato (stile lettera strutturata) |
| TC10 | 🟢 0.92 | 1.00 | 0.86 | 6 | 0 | 1 | 0.00 | SpA — sospensione implicita con verbo 'passato a' e 'sostituito' |
| TC11 | 🟢 1.00 | 1.00 | 1.00 | 5 | 0 | 0 | – | Vasculite ANCA — ciclofosfamide + rituximab + mantenimento |
| TC12 | 🟢 0.92 | 1.00 | 0.86 | 6 | 0 | 1 | 1.00 | AR — storia lunga con 3 biologici, reason sempre presenti |
| TC13 | 🟢 0.89 | 1.00 | 0.80 | 4 | 0 | 1 | 1.00 | AR — biosimilare e switch brand per motivi non clinici |
| TC14 | 🟢 0.92 | 1.00 | 0.86 | 6 | 0 | 1 | 1.00 | SSc — terapia vascolare e immunosoppressiva complessa |
| TC15 | 🟢 0.80 | 1.00 | 0.67 | 4 | 0 | 2 | 0.00 | AR — raccordo vago con farmaci citati senza struttura di inizio/fine |

---

## Frequenza errori

| Categoria errore | Occorrenze |
|---|---|
| `MISSING_START` | 6 |
| `REASON_MISSING` | 4 |
| `MISSING_STOP` | 1 |
| `DATE_MISMATCH` | 1 |
| `MISSING_SPACING` | 1 |
| `MISSING_DOSE_CHANGE` | 1 |
| `REASON_PARTIAL` | 1 |

---

## Peggiori 5 test case (per F1)

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
| Infliximab | therapy_stop | – | – | 0.70 | Ha fatto anche la 'flebo' di Infliximab per un periodo, sospesa perché non la to… |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| TP_WITH_ERROR | `REASON_PARTIAL` | Leflunomide | therapy_stop | – | – | intolleranza gastrica | mal di stomaco |
| TP_WITH_ERROR | `REASON_MISSING` | Infliximab | therapy_stop | – | – | intolleranza | – |
| FN | `MISSING_START` | Infliximab | therapy_start | – | – | – | – |
| FN | `MISSING_START` | Prednisone | therapy_start | – | – | – | – |

### TC03 — F1 0.86 — Negazione sospensione + terapia mai interrotta

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

**Parser output (3 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Idrossiclorochina | therapy_start | 2015 | – | 0.90 | In terapia con Idrossiclorochina 200 mg/die mai sospesa dal 2015. |
| Prednisone | therapy_start | 2015 | – | 0.90 | Dal 2015 Prednisone 5 mg/die, ridotto progressivamente. |
| Micofenolato Mofetil | therapy_stop | 2021 | gravidanza programmata | 0.90 | Nel 2021 sospeso Micofenolato per gravidanza programmata. |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2017 | – | – | – |

### TC02 — F1 0.89 — Switch biologico con spacing e anafora

**Input raccordo:**
```
Spondilite anchilosante accertata nel 2009. Dal 2009 Sulfasalazina 2g/die. Dal 2013 aggiunto Adalimumab 40 mg ogni 2 settimane. Nel 2018 perdita di efficacia primaria; sospeso per inefficacia e avviato Secukinumab 150 mg mensile. Nel 2021 spacing a 10 settimane per remissione prolungata. Nel 2022 riacutizzazione con ripresa della dose standard.
```

**Ground truth (5 eventi):**

| Drug | Tipo | Anno | Motivo |
|---|---|---|---|
| Sulfasalazina | therapy_start | 2009 | – |
| Adalimumab | therapy_start | 2013 | – |
| Adalimumab | therapy_stop | 2018 | inefficacia |
| Secukinumab | therapy_start | 2018 | – |
| Secukinumab | dose_spacing | 2021 | – |

**Parser output (4 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Sulfasalazina | therapy_start | 2009 | – | 0.90 | Dal 2009 Sulfasalazina 2g/die. |
| Adalimumab | therapy_start | 2013 | – | 0.90 | Dal 2013 aggiunto Adalimumab 40 mg ogni 2 settimane. |
| Secukinumab | therapy_start | – | – | 0.70 | sospeso per inefficacia e avviato Secukinumab 150 mg mensile. |
| Secukinumab | dose_spacing | 2021 | – | 0.90 | Nel 2021 spacing a 10 settimane per remissione prolungata. |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2018 | – | inefficacia | – |

### TC13 — F1 0.89 — AR — biosimilare e switch brand per motivi non clinici

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

**Parser output (4 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Methotrexate | therapy_start | 2015 | – | 0.90 | Riferisce terapia pregressa: Methotrexate 10 mg/sett. dal 2015, aumentato a 15 m… |
| Adalimumab | therapy_start | 2017 | – | 0.90 | Nel 2017 introdotto Adalimumab originator 40 mg bisettimanale; |
| Adalimumab | therapy_stop | 2022 | comparsa di psoriasi palmoplantare de novo attribuita al | 0.90 | Nel 2022 sospeso adalimumab per comparsa di psoriasi palmoplantare de novo attri… |
| Tofacitinib | therapy_start | – | – | 0.70 | avviato Tofacitinib 5 mg bid. |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| FN | `MISSING_DOSE_CHANGE` | Tofacitinib | dose_change | – | – | incremento transaminasi | – |

### TC10 — F1 0.92 — SpA — sospensione implicita con verbo 'passato a' e 'sostituito'

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

**Parser output (6 eventi):**

| Drug | Tipo | Anno | Motivo | Confidence | Frammento |
|---|---|---|---|---|---|
| Methotrexate | therapy_start | 2012 | – | 0.90 | Methotrexate 15 mg/settimana dal 2012, senza beneficio sulla componente assiale. |
| Adalimumab | therapy_start | 2014 | – | 0.90 | Nel 2014 iniziato Adalimumab 40 mg ogni 2 settimane; |
| Adalimumab | therapy_stop | 2017 | – | 0.90 | passato a Golimumab 50 mg mensile. |
| Golimumab | therapy_start | 2017 | – | 0.90 | passato a Golimumab 50 mg mensile. |
| Golimumab | therapy_stop | 2020 | – | 0.90 | sostituito con Ixekizumab 80 mg ogni 4 settimane. |
| Ixekizumab | therapy_start | 2020 | – | 0.90 | sostituito con Ixekizumab 80 mg ogni 4 settimane. |

**Mismatch:**

| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|
| TP_WITH_ERROR | `REASON_MISSING` | Adalimumab | therapy_stop | 2017 | 2017 | perdita di risposta | – |
| TP_WITH_ERROR | `REASON_MISSING` | Golimumab | therapy_stop | 2020 | 2020 | inefficacia | – |
| FN | `MISSING_SPACING` | Ixekizumab | dose_spacing | 2024 | – | – | – |

---

## Dettaglio completo mismatch

| TC | Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |
|---|---|---|---|---|---|---|---|---|
| TC02 | FN | `MISSING_STOP` | Adalimumab | therapy_stop | 2018 | – | inefficacia | – |
| TC03 | FN | `MISSING_START` | Micofenolato Mofetil | therapy_start | 2017 | – | – | – |
| TC06 | TP_WITH_ERROR | `DATE_MISMATCH` | Rituximab | therapy_stop | 2020 | 2015 | polmonite batterica ricorrente | polmonite batterica ricorrente |
| TC07 | TP_WITH_ERROR | `REASON_MISSING` | Certolizumab pegol | therapy_stop | 2019 | 2019 | progressivo peggioramento | – |
| TC08 | FN | `MISSING_START` | Prednisone | therapy_start | 2014 | – | – | – |
| TC10 | TP_WITH_ERROR | `REASON_MISSING` | Adalimumab | therapy_stop | 2017 | 2017 | perdita di risposta | – |
| TC10 | TP_WITH_ERROR | `REASON_MISSING` | Golimumab | therapy_stop | 2020 | 2020 | inefficacia | – |
| TC10 | FN | `MISSING_SPACING` | Ixekizumab | dose_spacing | 2024 | – | – | – |
| TC12 | FN | `MISSING_START` | Idrossiclorochina | therapy_start | 2003 | – | – | – |
| TC13 | FN | `MISSING_DOSE_CHANGE` | Tofacitinib | dose_change | – | – | incremento transaminasi | – |
| TC14 | FN | `MISSING_START` | Nifedipina | therapy_start | 2016 | – | – | – |
| TC15 | TP_WITH_ERROR | `REASON_PARTIAL` | Leflunomide | therapy_stop | – | – | intolleranza gastrica | mal di stomaco |
| TC15 | TP_WITH_ERROR | `REASON_MISSING` | Infliximab | therapy_stop | – | – | intolleranza | – |
| TC15 | FN | `MISSING_START` | Infliximab | therapy_start | – | – | – | – |
| TC15 | FN | `MISSING_START` | Prednisone | therapy_start | – | – | – | – |
