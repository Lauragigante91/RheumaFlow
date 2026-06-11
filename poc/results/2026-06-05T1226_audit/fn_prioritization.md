# Analisi falsi negativi — raccordoParser.js
**Audit:** 15 TC, 91 eventi GT — TP=17, FP=1, FN=74  
**Recall attuale:** 0.187 (18.7%) · **Precision:** 0.944 · **Macro-F1:** 0.272

---

## Tabella prioritizzazione regole mancanti

| # | Categoria di errore | FN spiegati | % sul totale | Recall recuperato | Esempio reale (TC) | Regola parser proposta |
|---|---|---|---|---|---|---|
| **1** | **Start verb senza "dal YEAR"** | **29** | 39.2% | +31.9% | TC04: *"aggiunto Etanercept per scarso controllo"* · TC07: *"Nel 2015 iniziato Certolizumab pegol"* · TC14: *"Bosentan 125 mg bid avviato nel 2018"* · TC15: *"ha assunto vari farmaci: inizialmente Methotrexate"* | Scansione di verbi inizio-terapia (`avviato/a`, `aggiunto/a`, `iniziato/a`, `introdotto/a`, `intrapreso/a`, `potenziato con`, `trattato/a con`, `ha assunto`, `assumeva`, `induzione con`, `mantenimento con`) nel contesto della frase; data estratta dal pattern `nel YEAR` / `del YEAR` se presente nella stessa frase o nella precedente |
| **2** | **Drug before "dal YEAR"** | **12** | 16.2% | +13.2% | TC03: *"Idrossiclorochina 200 mg/die mai sospesa dal 2015"* · TC06: *"MTX 15 mg/sett. dal 2006"* · TC08: *"Micofenolato Mofetil 1.5g/die dal 2018"* · TC14: *"Micofenolato Mofetil 2g/die dal 2016 per ILD"* | Estendere `DAL_YEAR_POS_RE` per cercare il farmaco anche nei 100 char **prima** del token `dal YEAR` (non solo dopo); estendere il pattern a `dal\s+(?:\w+\s+)?YEAR` per catturare `dal luglio 2023`, `dal 01/2010`, `dal 06/2015` |
| **3** | **Verb-first stop ("sospeso DRUG")** | **9** | 12.2% | +9.9% | TC03: *"Nel 2021 sospeso Micofenolato per gravidanza"* · TC05: *"Nel 2012 sospeso MTX per tossicità epatica"* · TC13: *"Nel 2022 sospeso adalimumab per comparsa di psoriasi"* | Estendere `drugsBeforeStop` con un secondo scan: se la lista è vuota, cercare farmaci nei 80 char **dopo** la keyword di stop; assegnare quel farmaco come stopped drug (confidence = medium) |
| **4** | **Anafora implicita per stop** | **7** | 9.5% | +7.7% | TC01: *"Sospeso nel settembre 2022 per intolleranza gastrica severa"* (MTX) · TC06: *"sospeso 12/2009 per ipertransaminasemia"* · TC06: *"sospeso 05/2015 per perdita di risposta"* · TC12: *"sospeso nel 2010 per anticorpi anti-farmaco"* (IFX) | Quando STOP_RE si attiva e `drugsBeforeStop=[]` e nessun farmaco è trovato dopo il keyword, usare `lastDrug` come farmaco sospeso **senza** richiedere il pronome esplicito (`del farmaco/biologico`); impostare `confidence:"low"` e `inferred_by:"implicit_anaphora"` |
| **5** | **Switch verbs (passato a / sostituito con)** | **5** | 6.8% | +5.5% | TC07: *"Nel 2019 switch a Secukinumab"* (→ stop CZP + start SEK) · TC10: *"Nel 2017 perdita di risposta; passato a Golimumab"* (→ stop ADA + start GOL) · TC10: *"sostituito con Ixekizumab 80 mg ogni 4 settimane"* | Riconoscere pattern `passato a DRUG`, `sostituito con DRUG`, `switch a DRUG`, `cambiato a DRUG` come **coppia di eventi**: (a) `therapy_stop` su `lastDrug` con la data della frase, (b) `therapy_start` sul nuovo farmaco; estrarre il motivo con `REASON_RE` se presente |

**Totale FN coperti dalle 5 regole: 62 / 74 (83.8%)**

---

## Regole secondarie (fuori top 5)

| Categoria | FN | Esempi |
|---|---|---|
| Formato lista strutturata `YYYY-YYYY: DRUG` | 7 | TC09: *"- 2010-2012: Metotressato 10 mg/settimana"*, *"- 2016-2019: Etanercept"* |
| Restart / ripresa terapia ("ripreso") | 1 | TC01: *"Ripreso a dicembre 2022 dopo 3 mesi di wash-out"* |
| `continue` dopo onset salta terapia co-occorrente | 1 | TC03: *"Nel 2017 esordio nefrite, aggiunto Micofenolato Mofetil 2g/die"* |
| Solo primo farmaco per contesto "dal YEAR" | 1 | TC12: *"Dal 2003 Methotrexate 15 mg/sett. + Idrossiclorochina"* (HCQ ignorato) |
| Dose change / spacing "ogni N settimane" | 2 | TC10: *"Nel 2024 spacing a ogni 8 settimane"* · TC13: *"ridotta dose a 5 mg/die"* |

---

## Stima impatto sul recall

| Scenario | Regole applicate | TP stimati | Recall | F1 (Prec ≈0.94) |
|---|---|---|---|---|
| Baseline attuale | nessuna | 17/91 | **18.7%** | 0.31 |
| Solo regola #1 (start verbs) | R1 | 46/91 | 50.5% | 0.66 |
| Regole #1 + #2 | R1+R2 | 58/91 | 63.7% | 0.76 |
| Regole #1 + #2 + #3 | R1+R2+R3 | 67/91 | 73.6% | 0.83 |
| Regole #1 + #2 + #3 + #4 | R1+R2+R3+R4 | 74/91 | 81.3% | 0.87 |
| Top 5 complete | R1–R5 | 79/91 | **86.8%** | **0.90** |
| Top 5 + regole secondarie | tutte | ~87/91 | ~95.6% | ~0.95 |

---

## Dettaglio completo FN per regola

### R1 — Start verb (29 FN)

| TC | Farmaco | Tipo evento | Anno | Frase sorgente |
|---|---|---|---|---|
| TC01 | Baricitinib | therapy_start | 2023 | *Dal luglio 2023 avviato Baricitinib 4 mg/die* |
| TC02 | Secukinumab | therapy_start | 2018 | *sospeso per inefficacia e avviato Secukinumab 150 mg mensile* |
| TC04 | Methotrexate | therapy_start | — | *Inizialmente trattata con FANS e Methotrexate a basse dosi* |
| TC04 | Etanercept | therapy_start | — | *aggiunto Etanercept per scarso controllo della componente assiale* |
| TC04 | Ixekizumab | therapy_start | — | *Avviato quindi Ixekizumab, ancora in corso* |
| TC05 | Idrossiclorochina | therapy_start | 2010 | *Nel 2010 aggiunta Idrossiclorochina 200 mg* |
| TC05 | Leflunomide | therapy_start | 2012 | *avviato Leflunomide 20 mg* |
| TC05 | Methotrexate | therapy_start | 2008 | *Trattata inizialmente con Methotrexate 10 mg* |
| TC07 | Certolizumab pegol | therapy_start | 2015 | *Nel 2015 iniziato Certolizumab pegol 200 mg ogni 2 settimane* |
| TC07 | Secukinumab | therapy_start | 2019 | *Nel 2019 switch a Secukinumab 150 mg mensile* |
| TC08 | Azatioprina | therapy_start | 2015 | *Azatioprina 100 mg/die avviata nel 2015* |
| TC08 | Belimumab | therapy_start | 2023 | *potenziato con Belimumab 200 mg/settimana sottocute* |
| TC08 | Prednisone | therapy_start | 2014 | *Prednisone a dosi variabili, attualmente 5 mg/die* |
| TC10 | Adalimumab | therapy_start | 2014 | *Nel 2014 iniziato Adalimumab 40 mg ogni 2 settimane* |
| TC11 | Ciclofosfamide | therapy_start | 2019 | *Induzione con Ciclofosfamide ev 15 mg/kg ogni 3 settimane* |
| TC11 | Prednisone | therapy_start | 2019 | *e Prednisone 1 mg/kg/die in tapering* |
| TC11 | Rituximab | therapy_start | 2019 | *Mantenimento con Rituximab 500 mg ogni 6 mesi* |
| TC11 | Micofenolato Mofetil | therapy_start | 2023 | *aggiunto MMF 1g/die come ancillare alla terapia biologica* |
| TC13 | Adalimumab | therapy_start | 2017 | *Nel 2017 introdotto Adalimumab originator 40 mg bisettimanale* |
| TC13 | Tofacitinib | therapy_start | 2022 | *avviato Tofacitinib 5 mg bid* |
| TC14 | Nifedipina | therapy_start | 2016 | *Dalla diagnosi: Nifedipina 30 mg/die per Raynaud* |
| TC14 | Sildenafil | therapy_start | 2017 | *Sildenafil 25 mg tid aggiunto nel 2017 per ulcere digitali* |
| TC14 | Bosentan | therapy_start | 2018 | *Bosentan 125 mg bid avviato nel 2018 per progressione PAP* |
| TC14 | Nintedanib | therapy_start | 2021 | *aggiunto Nintedanib 150 mg bid* |
| TC14 | Rituximab | therapy_start | 2023 | *Rituximab 1g x2 avviato nel 2023 per progressione ILD* |
| TC15 | Methotrexate | therapy_start | — | *ha assunto vari farmaci: inizialmente Methotrexate* |
| TC15 | Leflunomide | therapy_start | — | *ha assunto vari farmaci: ... Leflunomide* |
| TC15 | Infliximab | therapy_start | — | *Ha fatto anche la 'flebo' di Infliximab per un periodo* |
| TC15 | Prednisone | therapy_start | — | *Attualmente riferisce di assumere solo Prednisone 5 mg* |

### R2 — Drug before "dal YEAR" (12 FN)

| TC | Farmaco | Tipo evento | Anno | Frase sorgente |
|---|---|---|---|---|
| TC03 | Idrossiclorochina | therapy_start | 2015 | *In terapia con Idrossiclorochina 200 mg/die mai sospesa dal 2015* |
| TC06 | Methotrexate | therapy_start | 2006 | *MTX 15 mg/sett. dal 2006* (split su ".") |
| TC06 | Adalimumab | therapy_start | 2011 | *Adalimumab 40 mg ogni 2 sett. dal 07/2011* (split + mese) |
| TC06 | Leflunomide | therapy_start | 2010 | *Leflunomide 20 mg dal 01/2010* |
| TC06 | Rituximab | therapy_start | 2015 | *RTX 1g x2 infusioni dal 06/2015* |
| TC07 | Sulfasalazina | therapy_start | 2013 | *Sulfasalazina 2g assunta dal 2013 al 2015* |
| TC08 | Idrossiclorochina | therapy_start | 2014 | *Idrossiclorochina 200 mg/die in corso dal 2014* |
| TC08 | Micofenolato Mofetil | therapy_start | 2018 | *Micofenolato Mofetil 1.5g/die dal 2018* |
| TC08 | Micofenolato Mofetil | therapy_start | 2021 | *(ripresa del precedente, stessa frase)* |
| TC10 | Methotrexate | therapy_start | 2012 | *Methotrexate 15 mg/settimana dal 2012* |
| TC13 | Methotrexate | therapy_start | 2015 | *Methotrexate 10 mg/sett. dal 2015* |
| TC14 | Micofenolato Mofetil | therapy_start | 2016 | *Micofenolato Mofetil 2g/die dal 2016 per ILD* |

### R3 — Verb-first stop (9 FN)

| TC | Farmaco | Tipo evento | Anno | Frase sorgente |
|---|---|---|---|---|
| TC03 | Micofenolato Mofetil | therapy_stop | 2021 | *Nel 2021 **sospeso** Micofenolato per gravidanza programmata* |
| TC04 | Etanercept | therapy_stop | — | ***sospeso** Etanercept per reazione cutanea al sito di iniezione* |
| TC05 | Methotrexate | therapy_stop | 2012 | *Nel 2012 **sospeso** MTX per tossicità epatica (ALT 3x ULN)* |
| TC05 | Leflunomide | therapy_stop | 2014 | *Nel 2014 **sospeso** LEF per scarsa tolleranza (nausea persistente)* |
| TC08 | Micofenolato Mofetil | therapy_stop | 2020 | *Nel 2020 **sospeso** MMF per gravidanza programmata* |
| TC09 | Leflunomide | therapy_stop | 2016 | *- 2016: **sospensione** Leflunomide per epatotossicità* |
| TC09 | Etanercept | therapy_stop | 2019 | *- 2016-2019: Etanercept (**sospeso** per infezione cutanea grave)* |
| TC13 | Adalimumab | therapy_stop | 2022 | *Nel 2022 **sospeso** adalimumab per comparsa di psoriasi* |
| TC14 | Micofenolato Mofetil | therapy_stop | 2022 | *Nel 2022 **sospeso** MMF per intolleranza GI severa* |

### R4 — Anafora implicita stop (7 FN)

| TC | Farmaco | Tipo evento | Anno | Frase sorgente | Last drug |
|---|---|---|---|---|---|
| TC01 | Methotrexate | therapy_stop | 2022 | *Sospeso nel settembre 2022 per intolleranza gastrica severa* | MTX |
| TC01 | Methotrexate | therapy_stop | 2023 | *Sospeso definitivamente a luglio 2023 per persistente intolleranza GI* | MTX |
| TC02 | Adalimumab | therapy_stop | 2018 | *sospeso per inefficacia e avviato Secukinumab 150 mg mensile* | ADA |
| TC06 | Methotrexate | therapy_stop | 2009 | *sospeso 12/2009 per ipertransaminasemia (ALT 4xULN)* | MTX |
| TC06 | Adalimumab | therapy_stop | 2015 | *sospeso 05/2015 per perdita di risposta secondaria* | ADA |
| TC06 | Rituximab | therapy_stop | 2020 | *sospeso 2020 per polmonite batterica ricorrente* | RTX |
| TC12 | Infliximab | therapy_stop | 2010 | *sospeso nel 2010 per anticorpi anti-farmaco* (post-split ";") | IFX |

### R5 — Switch verbs (5 FN)

| TC | Farmaco | Tipo evento | Anno | Frase sorgente | Pattern |
|---|---|---|---|---|---|
| TC07 | Certolizumab pegol | therapy_stop | 2019 | *Nel 2019 switch a Secukinumab 150 mg mensile* | `switch a` |
| TC10 | Adalimumab | therapy_stop | 2017 | *Nel 2017 perdita di risposta; passato a Golimumab* | `passato a` |
| TC10 | Golimumab | therapy_start | 2017 | *passato a Golimumab 50 mg mensile* | `passato a` |
| TC10 | Golimumab | therapy_stop | 2020 | *Nel 2020 inefficacia Golimumab; sostituito con Ixekizumab* | `sostituito con` |
| TC10 | Ixekizumab | therapy_start | 2020 | *sostituito con Ixekizumab 80 mg ogni 4 settimane* | `sostituito con` |

---

## Note implementative

**Ordine di implementazione suggerito (impatto/complessità):**

1. **R1 (start verbs)** — impatto massimo, implementazione contenuta: aggiungere `START_VERB_RE` scansione per frase; data da `nel YEAR` o frase precedente. Rischio FP: medio (da mitigare con minimum drug-context check).

2. **R2 (drug before dal)** — modifica a `DAL_YEAR_POS_RE`: aggiungere scan backward (100 chars prima del match); estendere a `dal\s+(?:\w+\s+)?YEAR` per month-name e `dal\s+\d{1,2}\/YEAR` per MM/YYYY. Rischio FP: basso.

3. **R3 (verb-first stop)** — modifica a `drugsBeforeStop`: se lista vuota, cercare drug nei 80 chars dopo la keyword. Alias (`MTX`, `LEF`, `MMF`, `RTX`) devono essere inclusi nel lookup. Rischio FP: basso.

4. **R4 (implicit anaphora)** — modificare la condizione `isAnaphora`: togliere il requisito `hasProNoun`, usare `lastDrug` se `drugsBeforeStop.length === 0 && drugsAfterStop.length === 0`. Rischio FP: medio (lastDrug stale se molte frasi intermedie; mitigare con distanza massima N frasi).

5. **R5 (switch verbs)** — aggiungere `SWITCH_RE` block: emette `therapy_stop` su `lastDrug` + `therapy_start` sul nuovo farmaco. Data da contesto frase. Rischio FP: basso (pattern lessicalmente disambiguati).
