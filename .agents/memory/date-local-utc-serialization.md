---
name: Date serialization local vs UTC (off-by-one)
description: Mixing local-parse with UTC-serialize slips dates by one day in positive-offset timezones; how to serialize, and how to force TZ in Jest/jsdom.
---

- Regola: se parsi una data in ora locale (`new Date(iso + "T00:00:00")`) DEVI serializzarla in ora locale (`getFullYear`/`getMonth`/`getDate`), MAI con `.toISOString().slice(0,10)` (UTC).
- **Why:** in un fuso a offset positivo (Europe/Rome UTC+1/+2) la mezzanotte locale ricade nel giorno UTC precedente; ogni addDays/addWeeks slitta di un giorno → durate errate (27 invece di 28), overlap e buchi negli schedule. Sotto UTC il bug è invisibile, quindi sfugge in CI.
- **How to apply:** qualunque helper data che fa round-trip parse↔serialize deve usare lo stesso riferimento (locale con locale). Sintomo tipico: schedule con step che si sovrappongono o lasciano buchi solo in produzione (browser in Italia), non nei test UTC.

- Test sotto fuso non-UTC: in jest/jsdom mutare `process.env.TZ` a runtime (in `beforeAll` o a module-top) NON ha effetto — V8 cachea il fuso prima che il modulo di test venga caricato. Verificato con probe diretto.
- **How to apply:** forzare il fuso in `craco.config.js` (gira nel processo padre, prima del fork dei worker Jest), gated su `NODE_ENV === "test"` e rispettando un `TZ` esplicito già impostato; così si propaga ai worker. In alternativa prefisso `TZ=Europe/Rome` sul comando.
- **Why:** un test sulle date è guard di regressione solo se gira in un fuso a offset positivo; sotto UTC il codice buggato passa comunque.
