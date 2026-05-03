// Linee guida EULAR/ACR per la gestione delle malattie reumatiche
// Contenuto sintetico per consultazione rapida clinica.

export const GUIDELINES = [
  // ============ ILD (sezione speciale richiesta dall'utente) ============
  {
    id: "ers_acr_eular_2023_ild",
    name: "Interstiziopatia polmonare nelle malattie reumatiche",
    disease: "Interstiziopatia polmonare (ILD)",
    source: "ACR + ACCP 2023 / ERS-EULAR 2023",
    year: 2023,
    url: "https://rheumatology.org/interstitial-lung-disease-guideline",
    urls: [
      { label: "ACR 2023 - Treatment (Wiley)", href: "https://acrjournals.onlinelibrary.wiley.com/doi/10.1002/art.42861" },
      { label: "ACR 2023 - Screening & Monitoring (Wiley)", href: "https://acrjournals.onlinelibrary.wiley.com/doi/10.1002/art.42860" },
      { label: "ACR Summary PDF", href: "https://assets.contentstack.io/v3/assets/bltee37abb6b278ab2c/blt7e2cadfc7bc986fb/interstitial-lung-disease-guideline-summary-screening-monitoring-2023.pdf" },
    ],
    intro: "Approccio congiunto ACR (con CHEST 2023) ed ERS-EULAR alla gestione dell'ILD nelle malattie reumatiche autoimmuni sistemiche (SARDs).",
    sections: [
      {
        title: "Screening (al momento della diagnosi)",
        items: [
          "Eseguire HRCT al torace ad alta risoluzione in tutti i pazienti con SSc, miositi (DM/PM/IMNM/ASS), MCTD; valutare in AR sintomatica/ad alto rischio (anti-CCP+, fumo, anziani, malattia erosiva), Sjögren con sintomi respiratori e LES con sintomi.",
          "Prove di funzionalità respiratoria (PFR) complete: FVC, DLCO, TLC.",
          "Ecocardiogramma transtoracico per screening PAH (in particolare SSc).",
          "Ossimetria a riposo e dopo 6MWT se ILD confermata.",
        ],
      },
      {
        title: "Monitoraggio dell'ILD stabilita",
        items: [
          "PFR ogni 3-6 mesi nella malattia recente o progressiva, ogni 6-12 mesi se stabile.",
          "HRCT di follow-up: 12 mesi nella malattia stabile, 6 mesi se peggioramento clinico/funzionale.",
          "Definizione di ILD progressiva (ERS): ≥1 di calo FVC ≥10% rispetto al baseline, calo FVC 5-10% + peggioramento sintomi/imaging, peggioramento radiologico significativo entro 24 mesi.",
        ],
      },
      {
        title: "SSc-ILD - prima linea",
        items: [
          "Micofenolato mofetil (MMF) 2-3 g/die: prima scelta per la maggior parte dei pazienti (Scleroderma Lung Study II).",
          "Tocilizumab (anti-IL-6) 162 mg/sett s.c.: alternativa di prima linea, raccomandato in SSc precoce con malattia infiammatoria attiva (focuSSced trial).",
          "Ciclofosfamide e.v.: alternativa per malattia rapidamente progressiva, soprattutto se MMF non tollerato.",
        ],
      },
      {
        title: "SSc-ILD - seconda linea / progressiva",
        items: [
          "Rituximab 1 g x 2 ogni 6 mesi: in caso di fallimento o intolleranza a MMF/tocilizumab.",
          "Nintedanib 150 mg x 2/die: per ILD fibrosante progressiva (SENSCIS trial). Può essere combinato con MMF.",
          "Trapianto polmonare: considerare nei casi end-stage refrattari.",
          "Trapianto autologo di cellule staminali ematopoietiche (HSCT): selezionati pazienti SSc con malattia rapidamente progressiva.",
        ],
      },
      {
        title: "RA-ILD",
        items: [
          "MTX NON è controindicato nella RA-ILD (review sistematiche recenti smentiscono il vecchio dogma); valutare caso per caso.",
          "Abatacept e rituximab sono opzioni preferite rispetto a TNFi nei pazienti con RA-ILD attiva.",
          "JAK inibitori: dati emergenti positivi ma cautela.",
          "Nintedanib indicato in RA-ILD progressiva fibrosante (INBUILD trial).",
          "Evitare TNFi monoterapia nei casi con ILD severa o rapidamente progressiva.",
        ],
      },
      {
        title: "Miositi-ILD (DM/PM/ASS/IMNM, anti-MDA5+, anti-Jo-1+)",
        items: [
          "Glucocorticoidi alte dosi (1 mg/kg/die ± boli e.v. 500-1000 mg x 3 gg) come induzione.",
          "MMF, azatioprina o tacrolimus come steroid-sparing di prima linea.",
          "Anti-MDA5 + ILD rapidamente progressiva: terapia combinata aggressiva (GC + tacrolimus + ciclofosfamide o rituximab); alta mortalità.",
          "Rituximab in casi refrattari.",
          "IVIg utile in associazione, soprattutto in DM giovanile e adulta refrattaria.",
        ],
      },
      {
        title: "Sjögren-ILD, LES-ILD, MCTD-ILD",
        items: [
          "Glucocorticoidi + immunosoppressore (MMF o azatioprina) in ILD sintomatica/progressiva.",
          "Rituximab da considerare in Sjögren-ILD refrattaria.",
          "Idrossiclorochina aggiuntiva sempre raccomandata in LES.",
        ],
      },
      {
        title: "Terapia di supporto",
        items: [
          "Riabilitazione respiratoria in tutti i pazienti con ILD sintomatica.",
          "Ossigenoterapia se SatO₂ < 88% a riposo o sotto sforzo.",
          "Vaccinazioni: anti-pneumococcica, anti-influenzale annuale, anti-COVID, anti-RSV.",
          "Profilassi anti-Pneumocystis jirovecii (TMP-SMX) in pazienti con ILD su immunosoppressione intensiva e CD4 ridotti.",
          "Trattamento aggressivo del reflusso gastroesofageo (PPI) in SSc.",
        ],
      },
    ],
    note: "Questo riepilogo non sostituisce la consultazione del documento integrale (ACR Guidelines Task Force on ILD 2023; ERS/EULAR position statement 2023).",
  },

  // ============ AR ============
  {
    id: "eular_2022_ra",
    name: "Artrite Reumatoide",
    disease: "Artrite Reumatoide",
    source: "EULAR 2022 (update)",
    year: 2023,
    url: "https://ard.bmj.com/content/82/1/3",
    intro: "Update EULAR 2022 (pubblicato 2023) per la gestione farmacologica dell'AR.",
    sections: [
      {
        title: "Principi generali",
        items: [
          "Treat-to-target: l'obiettivo è la remissione (preferibile) o bassa attività di malattia.",
          "MTX è il farmaco di ancoraggio iniziale, salvo controindicazioni.",
          "Ridurre i glucocorticoidi al minimo possibile e sospenderli entro 3 mesi se possibile.",
        ],
      },
      {
        title: "Fase 1 (post-diagnosi)",
        items: [
          "MTX + GC a breve termine (≤ 3 mesi). Dose target MTX 25 mg/sett (s.c. se inadeguata risposta orale).",
          "Se MTX controindicato: leflunomide o sulfasalazina.",
        ],
      },
      {
        title: "Fase 2 (mancata risposta a MTX)",
        items: [
          "Se assenza di fattori prognostici sfavorevoli: cambiare/aggiungere altro csDMARD.",
          "Se presenza di fattori prognostici sfavorevoli (ACPA+/FR+, alta attività, danno radiografico precoce, fallimento di 2 csDMARDs): aggiungere bDMARD o tsDMARD.",
          "JAK-i: usare con cautela in pazienti >65 anni, fumatori, storia di MACE/neoplasie/TEV (warning EMA 2022).",
        ],
      },
      {
        title: "Fase 3 (mancata risposta a 1° biologico)",
        items: [
          "Switch ad altro bDMARD (anche dello stesso meccanismo) o tsDMARD.",
          "In caso di multiple insufficienze, considerare rituximab.",
        ],
      },
      {
        title: "Tapering",
        items: [
          "In pazienti in remissione persistente (>6 mesi) considerare graduale riduzione del bDMARD/tsDMARD (allungare intervalli o ridurre dose).",
          "Mantenere il csDMARD come ancora.",
        ],
      },
    ],
  },

  // ============ AP ============
  {
    id: "eular_2023_psa",
    name: "Artrite Psoriasica",
    disease: "Artrite Psoriasica",
    source: "EULAR 2023 / GRAPPA 2021",
    year: 2023,
    url: "https://ard.bmj.com/content/83/6/706",
    intro: "Update EULAR 2023 per la gestione dell'AP.",
    sections: [
      {
        title: "Domini di malattia",
        items: [
          "Valutare separatamente: artrite periferica, dattilite, entesite, malattia assiale, psoriasi cutanea, malattia ungueale, manifestazioni extra-muscoloscheletriche (uveite, IBD).",
        ],
      },
      {
        title: "Artrite periferica",
        items: [
          "MTX di prima linea (leflunomide o sulfasalazina come alternative).",
          "Mancata risposta: TNFi o IL-17i o IL-23i o JAKi.",
          "TNFi preferiti se uveite o IBD coesistente.",
          "IL-17i e IL-23i preferiti se psoriasi cutanea estesa.",
        ],
      },
      {
        title: "Malattia assiale predominante",
        items: [
          "Stesso approccio di axSpA: TNFi o IL-17i; IL-23i NON raccomandati per il dominio assiale (efficacia limitata).",
        ],
      },
      {
        title: "Entesite/dattilite isolate",
        items: [
          "Considerare direttamente bDMARD (TNFi, IL-17i, IL-23i) saltando csDMARD.",
        ],
      },
      {
        title: "Apremilast",
        items: [
          "Considerare in pazienti con malattia lieve, controindicazioni a bDMARD, o psoriasi cutanea limitata.",
        ],
      },
    ],
  },

  // ============ SpA assiale ============
  {
    id: "asas_eular_2022_axspa",
    name: "Spondiloartrite assiale (axSpA)",
    disease: "Spondiloartrite",
    source: "ASAS-EULAR 2022",
    year: 2023,
    intro: "Update ASAS-EULAR 2022 per la gestione di axSpA radiografica e non-radiografica.",
    sections: [
      {
        title: "Prima linea",
        items: [
          "FANS a dosaggio massimo tollerato per 2-4 settimane prima di considerare l'inadeguatezza di risposta.",
          "Esercizio fisico regolare e fisioterapia.",
          "Corticosteroidi locali (entesite, sacroileite); evitare GC sistemici.",
        ],
      },
      {
        title: "Mancata risposta a 2 FANS",
        items: [
          "TNFi o IL-17i di prima linea biologica.",
          "JAKi (upadacitinib, tofacitinib) come alternativa, con cautela nei profili di rischio.",
          "Considerazioni: TNFi preferiti se IBD o uveite ricorrente; IL-17i preferiti se psoriasi.",
        ],
      },
      {
        title: "Switch",
        items: [
          "Switch ad altro bDMARD (di classe diversa o stessa) in caso di mancata risposta o intolleranza.",
          "Considerare la differenza tra inefficacia primaria (cambia classe) e secondaria (altro farmaco stessa classe è opzione).",
        ],
      },
      {
        title: "Tapering",
        items: [
          "In pazienti in remissione clinica sostenuta considerare riduzione graduale del bDMARD (allungamento intervallo).",
        ],
      },
    ],
  },

  // ============ LES ============
  {
    id: "eular_2023_sle",
    name: "Lupus Eritematoso Sistemico",
    disease: "LES",
    source: "EULAR 2023",
    year: 2023,
    url: "https://ard.bmj.com/content/83/1/15",
    intro: "Update EULAR 2023 per la gestione del LES con focus su steroid-sparing.",
    sections: [
      {
        title: "Trattamento di base",
        items: [
          "Idrossiclorochina (5 mg/kg/die, max 400 mg) raccomandata in TUTTI i pazienti (salvo controindicazioni).",
          "Glucocorticoidi: usare la dose minima efficace, scendere a ≤ 5 mg/die di prednisone equivalente entro 3-6 mesi, idealmente sospendere.",
        ],
      },
      {
        title: "LES non-renale moderata",
        items: [
          "MTX, AZA, MMF come steroid-sparing.",
          "Belimumab da considerare precocemente in pazienti con malattia attiva nonostante terapia standard.",
          "Anifrolumab in alternativa, soprattutto con manifestazioni cutanee/articolari.",
        ],
      },
      {
        title: "Nefrite lupica",
        items: [
          "Induzione: MMF (alta dose) + GC (eventuali boli e.v.) + idrossiclorochina.",
          "Alternative all'induzione: ciclofosfamide a basso dosaggio (EuroLupus).",
          "Aggiungere belimumab o voclosporina al regime di induzione (terapia tripla; raccomandazione 2023).",
          "Mantenimento: MMF (preferito) o azatioprina, prolungato per ≥ 3 anni.",
        ],
      },
      {
        title: "Manifestazioni neurologiche / ematologiche severe",
        items: [
          "Boli di metilprednisolone + ciclofosfamide o rituximab.",
        ],
      },
      {
        title: "Rituximab",
        items: [
          "In casi refrattari (manifestazioni ematologiche, neurologiche, renali) anche se off-label.",
        ],
      },
    ],
  },

  // ============ SSc ============
  {
    id: "eular_2023_ssc",
    name: "Sclerosi Sistemica",
    disease: "Sclerosi Sistemica",
    source: "EULAR 2023 (update)",
    year: 2023,
    url: "https://ard.bmj.com/content/84/1/29",
    intro: "Update EULAR 2023 per la gestione della SSc per organo bersaglio.",
    sections: [
      {
        title: "Fenomeno di Raynaud / ulcere digitali",
        items: [
          "Calcio antagonisti (nifedipina) prima linea per Raynaud.",
          "PDE-5 inibitori (sildenafil, tadalafil) come alternativa o aggiuntiva.",
          "Iloprost e.v. per ulcere digitali attive o Raynaud severo.",
          "Bosentan per prevenire nuove ulcere digitali (RAPIDS-2).",
        ],
      },
      {
        title: "Skin involvement",
        items: [
          "MTX prima linea per skin precoce diffusa.",
          "MMF alternativa, soprattutto con ILD coesistente.",
          "Tocilizumab per skin progressiva con marcatori infiammatori elevati.",
          "HSCT in malattia precoce, rapidamente progressiva, in centri di esperienza.",
        ],
      },
      {
        title: "ILD",
        items: ["Vedi linee guida ERS/ACR/EULAR 2023 ILD specifiche."],
      },
      {
        title: "PAH",
        items: [
          "Screening annuale (ECG/eco/PFR/NT-proBNP) in tutti i pazienti SSc; conferma con cateterismo dx.",
          "Terapia combinata iniziale (ERA + PDE-5i) raccomandata per PAH-SSc moderata-severa.",
          "Selexipag o epoprostenolo aggiuntivo in classe funzionale III-IV.",
        ],
      },
      {
        title: "Crisi renale sclerodermica",
        items: [
          "ACE-inibitori a dose progressiva (captopril) IMMEDIATAMENTE all'inizio dei sintomi/al riscontro di ipertensione.",
          "Continuare ACE-i anche in dialisi.",
          "Evitare GC ad alte dosi (>15 mg/die) come fattore precipitante.",
        ],
      },
      {
        title: "Manifestazioni gastrointestinali",
        items: [
          "PPI alte dosi per reflusso/esofagite.",
          "Procinetici per dismotilità.",
          "Antibiotici a rotazione per SIBO (rifaximina, ciprofloxacina alternati).",
        ],
      },
    ],
  },

  // ============ Vasculiti ANCA ============
  {
    id: "eular_2023_aav",
    name: "Vasculiti ANCA-associate",
    disease: "Vasculiti ANCA",
    source: "EULAR 2022/23",
    year: 2023,
    url: "https://ard.bmj.com/content/83/1/30",
    intro: "Update EULAR 2022 per GPA, MPA, EGPA.",
    sections: [
      {
        title: "Induzione - GPA/MPA",
        items: [
          "Forme severe (compromissione organo): rituximab (preferito) O ciclofosfamide + GC.",
          "Boli metilprednisolone iniziali (500-1000 mg x 3 gg) in malattia minacciosa.",
          "Avacopan (orale, antagonista C5aR) come steroid-sparing aggiuntivo.",
          "Plasmaferesi NON raccomandata di routine; considerare in emorragia alveolare severa o creatinina >5.7 mg/dL (PEXIVAS rivalutato).",
        ],
      },
      {
        title: "Mantenimento - GPA/MPA",
        items: [
          "Rituximab 500 mg ogni 6 mesi per ≥ 24-48 mesi.",
          "Alternativa: azatioprina 1.5-2 mg/kg/die o MTX.",
          "Continuare HCQ in nefrite/LES coesistente.",
        ],
      },
      {
        title: "EGPA",
        items: [
          "Mepolizumab (300 mg/mese s.c.) per malattia non-organ-threatening.",
          "Rituximab/ciclofosfamide per malattia organ-threatening.",
        ],
      },
    ],
  },

  // ============ Sjögren ============
  {
    id: "eular_2019_sjogren",
    name: "Sindrome di Sjögren",
    disease: "Sjögren",
    source: "EULAR 2019",
    year: 2019,
    url: "https://ard.bmj.com/content/79/1/3",
    intro: "EULAR 2019 per la gestione di pSS.",
    sections: [
      {
        title: "Sintomi locali",
        items: [
          "Lacrime artificiali e gel oculari notturni come prima linea.",
          "Pilocarpina (5 mg x 4/die) o cevimelina per xerostomia.",
          "Ciclosporina collirio per cheratocongiuntivite secca moderata-severa.",
        ],
      },
      {
        title: "Manifestazioni sistemiche",
        items: [
          "HCQ per artralgie e sintomi costituzionali.",
          "MTX per artrite.",
          "GC a basse dosi per attività sistemica.",
          "Rituximab per manifestazioni severe (vasculite crioglobulinemica, neuropatia, nefropatia, parotidite cronica).",
        ],
      },
      {
        title: "Sorveglianza linfoma",
        items: [
          "Linfoadenopatia persistente, parotidite cronica, ipocomplementemia C4, fattore reumatoide elevato, crioglobuline = fattori di rischio.",
          "Considerare biopsia linfonodo se sospetto.",
        ],
      },
    ],
  },

  // ============ Gotta ============
  {
    id: "acr_2020_gout",
    name: "Gotta",
    disease: "Gotta",
    source: "ACR 2020 / EULAR 2016",
    year: 2020,
    url: "https://acrjournals.onlinelibrary.wiley.com/doi/10.1002/art.41247",
    urls: [
      { label: "ACR Gout Guideline (Landing)", href: "https://rheumatology.org/gout-guideline" },
      { label: "EULAR 2016 Gout (ARD)", href: "https://ard.bmj.com/content/76/1/29" },
    ],
    intro: "ACR 2020 update per la gestione della gotta cronica.",
    sections: [
      {
        title: "Indicazioni a terapia ipouricemizzante",
        items: [
          "≥ 2 attacchi/anno; tofi clinici; danno radiografico; nefrolitiasi uratica; CKD stadio 3+.",
        ],
      },
      {
        title: "Target terapeutico",
        items: [
          "Uricemia < 6 mg/dL; in pazienti con tofi o malattia severa < 5 mg/dL.",
        ],
      },
      {
        title: "Farmaci ipouricemizzanti",
        items: [
          "Allopurinolo: prima scelta. Iniziare 100 mg/die (50 mg in CKD), titolare di 100 mg ogni 2-5 settimane fino al target. Dose massima 800 mg/die.",
          "Febuxostat: alternativa se allopurinolo intollerato. Cautela in pazienti con malattia cardiovascolare (warning FDA).",
          "Pegloticasi: per gotta refrattaria con tofi multipli.",
        ],
      },
      {
        title: "Profilassi attacchi",
        items: [
          "Colchicina 0.5 mg x 1-2/die (o FANS o GC a basse dosi) per 3-6 mesi durante l'inizio della terapia ipouricemizzante.",
        ],
      },
      {
        title: "Attacco acuto",
        items: [
          "FANS o colchicina (1.2 mg + 0.6 mg dopo 1h, poi 0.6 mg x 2/die) o GC orali (30-40 mg per 3-5 gg).",
          "Anakinra in casi refrattari o controindicazioni.",
        ],
      },
    ],
  },

  // ============ PMR ============
  {
    id: "eular_acr_2015_pmr",
    name: "Polimialgia Reumatica",
    disease: "PMR",
    source: "EULAR/ACR 2015",
    year: 2015,
    url: "https://ard.bmj.com/content/74/10/1799",
    intro: "Linee guida per il trattamento di PMR.",
    sections: [
      {
        title: "Induzione",
        items: [
          "Prednisone 12.5-25 mg/die come dose iniziale (orale, dose singola al mattino).",
          "Risposta clinica attesa entro 1 settimana.",
        ],
      },
      {
        title: "Riduzione",
        items: [
          "Ridurre a 10 mg/die in 4-8 settimane.",
          "Successiva riduzione di 1 mg ogni 4 settimane fino a sospensione.",
        ],
      },
      {
        title: "Recidiva",
        items: [
          "Aumentare alla dose pre-recidiva, poi riduzione più lenta.",
          "Considerare MTX 7.5-10 mg/sett come steroid-sparing in pazienti con recidive multiple o tossicità da GC.",
        ],
      },
      {
        title: "Refrattaria",
        items: [
          "Tocilizumab off-label in casi refrattari (dati emergenti positivi 2023).",
        ],
      },
    ],
  },

  // ============ Behçet ============
  {
    id: "eular_2018_behcet",
    name: "Malattia di Behçet",
    disease: "Behçet",
    source: "EULAR 2018",
    year: 2018,
    url: "https://ard.bmj.com/content/77/6/808",
    intro: "Update EULAR 2018 per la gestione di Behçet.",
    sections: [
      {
        title: "Mucocutaneo",
        items: [
          "Colchicina 1-2 mg/die prima linea per ulcere orali/genitali, eritema nodoso.",
          "Apremilast per ulcere orali refrattarie.",
          "Anti-TNF in casi severi/refrattari.",
        ],
      },
      {
        title: "Uveite",
        items: [
          "Azatioprina + GC sistemici in uveite posteriore.",
          "Anti-TNF (infliximab, adalimumab) in malattia severa o refrattaria.",
          "Interferone-α come alternativa.",
        ],
      },
      {
        title: "Coinvolgimento vascolare",
        items: [
          "Ciclofosfamide + GC per aneurismi e trombosi venose severe.",
          "Anti-TNF nei casi refrattari.",
          "Anticoagulazione SOLO se trombosi documentata e dopo esclusione di aneurismi (rischio sanguinamento).",
        ],
      },
      {
        title: "Coinvolgimento neurologico",
        items: [
          "Boli GC + ciclofosfamide o anti-TNF per neuro-Behçet parenchimale.",
        ],
      },
    ],
  },

  // ============ Fibromialgia ============
  {
    id: "eular_2016_fm",
    name: "Fibromialgia",
    disease: "Fibromialgia",
    source: "EULAR 2016",
    year: 2016,
    url: "https://ard.bmj.com/content/76/2/318",
    intro: "EULAR 2016 per la gestione della fibromialgia.",
    sections: [
      {
        title: "Approccio non farmacologico (prima linea)",
        items: [
          "Educazione sulla malattia.",
          "Esercizio aerobico graduato e attività fisica regolare.",
          "Tecniche di rilassamento, mindfulness, terapia cognitivo-comportamentale.",
          "Idroterapia / terapia in piscina.",
        ],
      },
      {
        title: "Farmacologico - dolore severo",
        items: [
          "Amitriptilina 10-50 mg/die (sera) come prima scelta.",
          "Duloxetina 30-60 mg/die.",
          "Pregabalin 150-450 mg/die.",
          "Tramadolo se dolore moderato-severo non controllato (evitare oppioidi forti).",
        ],
      },
      {
        title: "Disturbi del sonno predominanti",
        items: [
          "Amitriptilina, ciclobenzaprina, pregabalin (sera).",
        ],
      },
      {
        title: "Da evitare",
        items: [
          "FANS cronici (efficacia limitata).",
          "GC sistemici.",
          "Oppioidi maggiori (rischio dipendenza, iperalgesia).",
        ],
      },
    ],
  },

  // ============ APS - Management EULAR 2019 ============
  {
    id: "eular_2019_aps",
    name: "Sindrome da anticorpi antifosfolipidi (gestione)",
    disease: "APS",
    source: "EULAR 2019 (Tektonidou)",
    year: 2019,
    url: "https://ard.bmj.com/content/78/10/1296",
    intro:
      "Raccomandazioni EULAR 2019 per la gestione dell'APS nell'adulto. Definizione di profilo aPL ad alto rischio: LA persistente positivo, doppia o tripla positività (LA + aCL + aβ2GPI), oppure titoli alti persistenti.",
    sections: [
      {
        title: "Principi generali",
        items: [
          "Stratificare il paziente per profilo aPL (alto rischio = LA persistente, doppia/tripla positività, titoli persistenti elevati).",
          "Trattare aggressivamente i fattori di rischio cardiovascolare e venoso (ipertensione, dislipidemia, fumo, obesità, immobilità).",
          "Tromboprofilassi con eparina LMWH in situazioni ad alto rischio (chirurgia, immobilizzazione prolungata, puerperio).",
          "Idrossiclorochina (HCQ) raccomandata in tutti i pazienti con LES + aPL.",
        ],
      },
      {
        title: "Profilassi primaria (asintomatici aPL+)",
        items: [
          "Aspirina a basse dosi (75–100 mg/die) in pazienti con profilo aPL ad alto rischio, con o senza LES.",
          "Aspirina a basse dosi nelle donne con APS ostetrica isolata (senza eventi trombotici) ad alto rischio.",
          "Non raccomandata di routine nei portatori a basso rischio asintomatici.",
        ],
      },
      {
        title: "APS trombotica - venosa (TEV non provocato)",
        items: [
          "Anticoagulazione orale a lungo termine con VKA (warfarin) target INR 2–3.",
          "DOAC (rivaroxaban, apixaban) NON raccomandati di routine, soprattutto in tripla positività (rischio aumentato di trombosi arteriose).",
          "In caso di recidiva nonostante INR 2–3 in target: aumentare INR a 3–4 oppure aggiungere LDA o passare a LMWH.",
        ],
      },
      {
        title: "APS trombotica - arteriosa",
        items: [
          "VKA con target INR 2–3 oppure 3–4 (più comune dopo evento ischemico cerebrale), in base al rischio di sanguinamento.",
          "Combinazione VKA + LDA come alternativa.",
          "Evitare i DOAC in pazienti con eventi arteriosi.",
        ],
      },
      {
        title: "APS catastrofica (CAPS)",
        items: [
          "Terapia di prima linea combinata: glucocorticoidi alte dosi (boli MP 500–1000 mg x 3 gg) + eparina + plasmaferesi e/o IVIg.",
          "Trattare l'evento scatenante (infezione, chirurgia, sospensione anticoagulante).",
          "Casi refrattari: rituximab (B-cell depletion) o eculizumab (inibizione del complemento).",
        ],
      },
      {
        title: "APS ostetrica",
        items: [
          "Storia di solo abortività ricorrente / morti fetali: LDA pre-concezionale + LMWH profilattica dopo positività β-hCG.",
          "Storia di APS trombotica: LDA + LMWH terapeutica per tutta la gravidanza e il puerperio.",
          "Aggiunta di HCQ e/o GC a basse dosi nei casi refrattari (recidiva nonostante terapia standard).",
          "Considerare IVIg in casi refrattari severi.",
        ],
      },
    ],
    note: "Le DOAC (rivaroxaban, apixaban) non sono raccomandate in APS, soprattutto in pazienti tripla positività, sulla base del trial TRAPS.",
  },

  // ============ EULAR 2024 Gravidanza & RMD ============
  {
    id: "eular_2024_pregnancy",
    name: "Farmaci antireumatici in riproduzione, gravidanza e allattamento",
    disease: "Gravidanza e RMD",
    source: "EULAR 2024 update (Andreoli/Russell) + ACR points-to-consider",
    year: 2024,
    url: "https://acrjournals.onlinelibrary.wiley.com/doi/10.1002/acr.25558",
    urls: [
      { label: "EULAR 2024 update (PubMed)", href: "https://pubmed.ncbi.nlm.nih.gov/40287311/" },
      { label: "EULAR 2016 PtC originali (ARD)", href: "https://ard.bmj.com/content/76/3/476" },
    ],
    intro:
      "Update EULAR 2024 sulle raccomandazioni per l'uso dei farmaci antireumatici prima del concepimento, in gravidanza, allattamento ed esposizione paterna. 5 principi generali + 12 raccomandazioni.",
    sections: [
      {
        title: "Principi generali",
        items: [
          "Counselling riproduttivo precoce in TUTTI i pazienti con malattia reumatica (donne E uomini) a partire dall'adolescenza.",
          "Pianificare la gravidanza in fase di remissione o bassa attività di malattia stabile da ≥6 mesi.",
          "Bilanciare il rischio del farmaco vs il rischio di malattia non controllata sulla madre e sul feto: una malattia attiva è essa stessa un fattore di rischio.",
          "Coinvolgere reumatologo + ginecologo (centri di gravidanza ad alto rischio se autoanticorpi anti-Ro/La, APS, LES attivo).",
          "Continuare i farmaci compatibili anche in allattamento per evitare flares.",
        ],
      },
      {
        title: "Pre-concezionale",
        items: [
          "Sospendere methotrexato ≥1 mese (donne) e ≥3 mesi (uomini, dato controverso, dati recenti tranquillizzanti).",
          "Sospendere micofenolato mofetil ≥6 settimane prima del concepimento.",
          "Sospendere ciclofosfamide ≥3 mesi (offrire crioconservazione gameti).",
          "Sospendere leflunomide e fare wash-out con colestiramina (verificare livello plasmatico <0.02 mg/L).",
          "Continuare HCQ (raccomandato), azatioprina, ciclosporina, tacrolimus, sulfasalazina (con folati).",
        ],
      },
      {
        title: "In gravidanza - raccomandazioni chiave",
        items: [
          "HCQ: continuare in tutte le pazienti con LES, APS o malattia attiva (effetto protettivo sulla riacutizzazione e sulla preeclampsia).",
          "Aspirina a basse dosi (75–100 mg) raccomandata in pazienti con LES, APS o storia di preeclampsia, dal primo trimestre fino a 36w.",
          "GC: prednisone/prednisolone come scelta di prima linea (metabolizzati dalla placenta); minima dose efficace; evitare desametasone/betametasone (passano la placenta) salvo per maturazione polmonare fetale.",
          "FANS: solo intermittente nel 1°-2° trimestre; SOSPENDERE entro 28 settimane (rischio di chiusura prematura del dotto di Botallo, oligoidramnios).",
          "TNFi: certolizumab pegol può essere continuato per tutta la gravidanza (basso passaggio transplacentare); altri TNFi (infliximab, adalimumab, etanercept, golimumab) possono essere proseguiti almeno fino a 20–32w in base al rischio.",
        ],
      },
      {
        title: "Allattamento",
        items: [
          "Compatibili: HCQ, azatioprina, ciclosporina, tacrolimus, sulfasalazina, GC <20 mg/die, certolizumab pegol e altri TNFi, colchicina, IVIg.",
          "Probabile compatibilità (passaggio minimo nel latte): rituximab, abatacept, tocilizumab, anakinra, secukinumab.",
          "Da evitare: methotrexato, ciclofosfamide, micofenolato, leflunomide.",
          "JAK inibitori (tofacitinib, baricitinib, upadacitinib): dati insufficienti, scoraggiare l'allattamento.",
        ],
      },
      {
        title: "Esposizione paterna",
        items: [
          "Compatibili: TNFi, MTX a basse dosi (dati recenti rassicuranti), azatioprina, sulfasalazina, ciclosporina, tacrolimus, HCQ.",
          "Da evitare/cautela: ciclofosfamide (offrire crioconservazione), talidomide.",
          "Sulfasalazina: può ridurre transitoriamente la spermatogenesi (oligospermia reversibile).",
        ],
      },
      {
        title: "Vaccinazioni in gravidanza/allattamento",
        items: [
          "Vaccini inattivati sicuri (influenza, COVID, pneumococco, Tdap raccomandato a 27–36w).",
          "Vaccini vivi attenuati controindicati in gravidanza; in allattamento possibili (MMR, varicella).",
          "Neonati esposti in utero a biologici (TNFi, rituximab nel 3° trimestre): differire vaccini vivi (BCG, rotavirus) di almeno 6 mesi.",
        ],
      },
    ],
    note: "Le decisioni vanno individualizzate; in caso di dubbi consultare un centro di riferimento.",
  },

  // ============ Tabella farmaci in gravidanza/allattamento (BSR 2022) ============
  {
    id: "bsr_2022_pregnancy_drugs",
    name: "Farmaci reumatologici in gravidanza e allattamento - Tabella di sicurezza",
    disease: "Gravidanza e RMD",
    source: "BSR 2022 (Russell et al.) + EULAR 2024",
    year: 2022,
    url: "https://academic.oup.com/rheumatology/article/62/4/e48/6783012",
    urls: [
      { label: "BSR 2022 - Full text (PMC)", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10070067/" },
      { label: "BSR Pregnancy guideline PDF", href: "https://www.rheumatology.org.uk/Portals/0/Documents/Practice/BSR_pregnancy_guideline_summary.pdf" },
    ],
    intro:
      "Tabella sintetica derivata dalle linee guida BSR 2022 (NICE-accredited) e dall'update EULAR 2024 per l'uso dei farmaci antireumatici in donne in età fertile, in gravidanza e in allattamento.",
    sections: [
      {
        title: "✅ COMPATIBILI in gravidanza (continuare se necessario)",
        items: [
          "Idrossiclorochina (≤400 mg/die) - raccomandata, effetto protettivo in LES/APS.",
          "Sulfasalazina (≤2 g/die) - aggiungere folati 5 mg/die nel 1° trimestre.",
          "Azatioprina (≤2 mg/kg/die).",
          "Ciclosporina e tacrolimus (monitorare livelli, BP, funzione renale).",
          "Colchicina (sicura in FMF e Behçet).",
          "Prednisone/prednisolone (minima dose efficace, preferiti rispetto a desametasone).",
          "Aspirina a basse dosi (75-100 mg) - raccomandata in LES, APS, storia di preeclampsia.",
          "LMWH (eparina a basso peso molecolare) - profilassi/terapia trombosi.",
          "IVIg.",
        ],
      },
      {
        title: "⚠️ CONDIZIONALI in gravidanza",
        items: [
          "FANS: solo intermittenti, SOSPENDERE entro 28 settimane (chiusura precoce dotto di Botallo, oligoidramnios). Preferire ibuprofene a breve emivita.",
          "TNF inibitori: certolizumab pegol (sicuro per tutta la gravidanza, minimo passaggio placentare). Altri TNFi (adalimumab, infliximab, etanercept, golimumab) - continuare fino a 20-32w in base ad attività; etanercept fino al 3° trimestre se necessario.",
          "Rituximab: evitare nel 2°-3° trimestre (deplezione B nel neonato); accettabile pre-concepimento e nel 1° trimestre se necessario.",
          "Anakinra, canakinumab, tocilizumab, abatacept, ustekinumab, secukinumab, ixekizumab: dati limitati ma generalmente sicuri se beneficio supera rischio.",
          "Belimumab, anifrolumab: dati limitati, sospendere se possibile pre-concepimento.",
          "Tacrolimus, ciclosporina: monitorare livelli e funzione renale (raccomandati in trapianto/SLE renale).",
        ],
      },
      {
        title: "❌ DA EVITARE in gravidanza (teratogeni o ad alto rischio)",
        items: [
          "Methotrexato - TERATOGENO. Sospendere ≥1 mese pre-concepimento; folati 5 mg/die per 12 settimane.",
          "Micofenolato mofetil/sodico - TERATOGENO (malformazioni cranio-facciali e cardiache). Sospendere ≥6 settimane pre-concepimento.",
          "Leflunomide - TERATOGENO. Wash-out con colestiramina (8 g x 3/die per 11 giorni); verificare livello plasmatico <0.02 mg/L.",
          "Ciclofosfamide - TERATOGENO e gonadotossico. Sospendere ≥3 mesi pre-concepimento. Offrire crioconservazione.",
          "JAK inibitori (tofacitinib, baricitinib, upadacitinib, filgotinib) - dati insufficienti; sospendere prima del concepimento.",
          "Bosentan, macitentan, ambrisentan (ERA per PAH) - teratogeni.",
          "Warfarin nel 1° trimestre (embriopatia warfarinica) e a fine gravidanza.",
          "DOAC (rivaroxaban, apixaban, dabigatran) - dati insufficienti, evitare.",
          "Talidomide - teratogeno noto.",
        ],
      },
      {
        title: "✅ COMPATIBILI in allattamento",
        items: [
          "Idrossiclorochina, sulfasalazina, azatioprina, ciclosporina, tacrolimus.",
          "Prednisone/prednisolone (≤20 mg/die senza precauzioni; >20 mg/die: aspettare 4 ore tra dose e poppata).",
          "FANS a breve emivita (ibuprofene preferito); evitare aspirina ad alte dosi.",
          "Colchicina, IVIg.",
          "TNFi (certolizumab, adalimumab, infliximab, etanercept, golimumab) - passaggio minimo nel latte e degradati nel tratto GI del neonato.",
          "Rituximab, abatacept, tocilizumab, anakinra, ustekinumab, secukinumab - probabile compatibilità (molecole grandi, scarsamente assorbite).",
        ],
      },
      {
        title: "❌ DA EVITARE in allattamento",
        items: [
          "Methotrexato (passaggio nel latte; dati insufficienti su sicurezza neonatale).",
          "Micofenolato mofetil/sodico.",
          "Ciclofosfamide.",
          "Leflunomide.",
          "JAK inibitori - dati insufficienti, sconsigliati.",
          "Apremilast - dati insufficienti.",
          "Warfarin: compatibile (passa minimamente nel latte). DOAC: evitare.",
        ],
      },
      {
        title: "Esposizione paterna - prima del concepimento",
        items: [
          "Compatibili: TNFi, azatioprina, ciclosporina, tacrolimus, HCQ, sulfasalazina (può causare oligospermia reversibile - sospendere 3 mesi se infertilità).",
          "Methotrexato a basse dosi: dati recenti (CRIB study) tranquillizzanti, BSR ammette continuazione; alcuni esperti suggeriscono ancora wash-out di 3 mesi per cautela.",
          "Da evitare/cautela: ciclofosfamide (gonadotossica, offrire crioconservazione), talidomide (teratogena anche per via paterna).",
          "JAK inibitori, micofenolato: dati insufficienti, preferibile wash-out.",
        ],
      },
      {
        title: "Vaccinazioni",
        items: [
          "Donna in età fertile: aggiornare vaccinazioni vivi (MMR, varicella) PRIMA del concepimento (almeno 4 settimane).",
          "In gravidanza: SICURI inattivati (influenza ogni anno, COVID-19, Tdap a 27-36w). CONTROINDICATI vivi attenuati.",
          "In allattamento: tutti i vaccini sicuri inclusi i vivi (MMR, varicella, febbre gialla con cautela).",
          "Neonato esposto in utero a biologici (specialmente TNFi 3° trimestre, rituximab): NO vaccini vivi (BCG, rotavirus) per ≥6 mesi; controllare livelli farmaco se necessario.",
        ],
      },
    ],
    note: "Tabella di sintesi a scopo orientativo. Decisioni terapeutiche individualizzate; consultare le linee guida complete e centri di riferimento per gravidanza ad alto rischio.",
  },
];

export const GUIDELINE_GROUPS = Array.from(new Set(GUIDELINES.map((g) => g.disease)));
