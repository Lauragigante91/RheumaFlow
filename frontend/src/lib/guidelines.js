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

  // ============ LVV - EULAR 2018 (Hellmich) ============
  {
    id: "eular_2018_lvv",
    name: "Vasculiti dei grandi vasi (GCA + Takayasu) - gestione",
    disease: "Vasculiti grandi vasi",
    source: "EULAR 2018 update (Hellmich)",
    year: 2018,
    url: "https://ard.bmj.com/content/79/1/19",
    urls: [
      { label: "EULAR 2018 LVV (PubMed)", href: "https://pubmed.ncbi.nlm.nih.gov/31270110/" },
      { label: "PDF Vasculitis Foundation", href: "https://vasculitis.org/wp-content/uploads/2023/10/EULAR-Recommendations-for-the-management-of-large-vessel-vasculitis.pdf" },
    ],
    intro:
      "Update EULAR 2018 per la gestione delle vasculiti dei grandi vasi (Arterite Gigantocellulare GCA e Arterite di Takayasu TAK): 3 principi generali + 10 raccomandazioni.",
    sections: [
      {
        title: "Principi generali",
        items: [
          "Pazienti con LVV richiedono valutazione e gestione multidisciplinare in centri di esperienza.",
          "Conferma diagnostica obbligatoria con imaging (eco color-Doppler, MRI, angio-TC, FDG-PET) o istologia PRIMA di iniziare il trattamento.",
          "Decisioni condivise con il paziente, comunicazione di obiettivi terapeutici e potenziali effetti avversi.",
        ],
      },
      {
        title: "Diagnosi - GCA",
        items: [
          "Sospetto clinico → eco color-Doppler delle arterie temporali e ascellari come prima indagine (operatore esperto).",
          "Halo sign all'eco è altamente specifico; in alternativa MRI 3T delle arterie cefaliche.",
          "Biopsia dell'arteria temporale (≥1 cm) se imaging non disponibile o discordante; falso negativo possibile.",
          "Imaging dell'aorta toracica e dei grandi vasi (CTA/MRA/PET) per documentare estensione extracranica e baseline.",
        ],
      },
      {
        title: "Diagnosi - Takayasu",
        items: [
          "MRA o CTA dell'aorta e dei grandi vasi è l'imaging di prima scelta.",
          "FDG-PET utile per attività infiammatoria e monitoraggio.",
          "Eco color-Doppler delle carotidi/succlavie in mani esperte.",
        ],
      },
      {
        title: "Trattamento - induzione GCA",
        items: [
          "Glucocorticoidi alte dosi: prednisone 40-60 mg/die (1 mg/kg, max 60 mg) come prima linea.",
          "GCA con perdita visiva attuale o recente: boli e.v. metilprednisolone 500-1000 mg x 3 gg, poi switch a orale.",
          "Riduzione progressiva: target 15-20 mg/die a 2-3 mesi, ≤5 mg/die a 1 anno.",
          "Adjuvante steroid-sparing: TOCILIZUMAB (162 mg/sett s.c. o 8 mg/kg/4 sett e.v.) raccomandato in malattia refrattaria/recidivante o ad alto rischio di tossicità GC (GiACTA trial).",
          "MTX (10-15 mg/sett) come alternativa quando tocilizumab non disponibile.",
          "Aspirina a basse dosi NON raccomandata di routine; valutare in ischemia cerebrale o critical limb ischemia.",
        ],
      },
      {
        title: "Trattamento - induzione Takayasu",
        items: [
          "Glucocorticoidi alte dosi (prednisone 1 mg/kg/die, max 60 mg) di prima linea.",
          "Combinare GC con immunosoppressore non-biologico (MTX 15-25 mg/sett, AZA 2 mg/kg/die o MMF 2 g/die) in TUTTI i pazienti.",
          "Riduzione GC graduale, target ≤10 mg/die a 6 mesi.",
          "Casi refrattari/recidivanti: agenti biologici (TNFi: infliximab, adalimumab; tocilizumab) come seconda linea.",
        ],
      },
      {
        title: "Monitoraggio",
        items: [
          "Valutazione clinica + indici di flogosi (VES, PCR) ogni 3-6 mesi nel primo anno.",
          "Imaging di follow-up per documentare progressione strutturale: MRA/CTA ogni 6-12 mesi nel primo anno, poi annualmente.",
          "Screening ecocardiografico annuale per dilatazione aortica nelle GCA con coinvolgimento aortico.",
          "Profilassi GC: bifosfonati + Ca/vitD per osteoporosi; PPI; controllo glicemia/PA; vaccinazioni (pneumococco, influenza, COVID).",
        ],
      },
      {
        title: "Procedure di rivascolarizzazione (TAK)",
        items: [
          "Indicate per stenosi/occlusioni critiche con sintomi ischemici severi non controllabili medicalmente.",
          "Eseguire preferibilmente in fase di malattia in remissione (rischio di restenosi inferiore).",
          "Coinvolgimento multidisciplinare con chirurgia vascolare e radiologia interventistica.",
          "Bypass chirurgico generalmente preferito a stent endovascolari per durabilità maggiore.",
        ],
      },
    ],
    note: "Aggiornamento EULAR 2018 (pubblicato 2020).",
  },

  // ============ ACR/VF 2021 GCA & TAK ============
  {
    id: "acr_vf_2021_lvv",
    name: "Vasculiti grandi vasi (GCA + Takayasu) - linee guida ACR",
    disease: "Vasculiti grandi vasi",
    source: "ACR/VF 2021 (Maz)",
    year: 2021,
    url: "https://rheumatology.org/large-vessel-vasculitis-guideline",
    urls: [
      { label: "ACR 2021 Full text (Wiley)", href: "https://acrjournals.onlinelibrary.wiley.com/doi/10.1002/art.41774" },
      { label: "VF PDF", href: "https://vasculitisfoundation.org/wp-content/uploads/2024/01/2021-ACR-VF-Guideline-for-Management-of-Giant-Cell-Arteritis-and-Takayasu-Artheritis.pdf" },
    ],
    intro:
      "Linee guida ACR/Vasculitis Foundation 2021 (Maz et al.) per la gestione di GCA e TAK. 22 raccomandazioni per GCA + 20 per TAK.",
    sections: [
      {
        title: "GCA - Diagnosi",
        items: [
          "Sospetto di GCA con sintomi cranici → eco color-Doppler temporali bilaterale O biopsia temporale (lunghezza ≥1 cm) come test diagnostico iniziale.",
          "Sospetto di GCA con sintomi sistemici / coinvolgimento grandi vasi → MRA o CTA dell'aorta e dei rami principali.",
          "FDG-PET nei casi con sospetto di malattia extracranica e marker infiammatori elevati.",
          "NON ritardare il trattamento per attendere conferma diagnostica nei casi con perdita visiva attuale o recente.",
        ],
      },
      {
        title: "GCA - Induzione",
        items: [
          "GCA non complicata: prednisone orale 40-60 mg/die.",
          "GCA con perdita visiva acuta o ischemia transitoria oculare: boli e.v. metilprednisolone 500-1000 mg/die x 3 gg.",
          "Aggiungere tocilizumab al GC dall'inizio (raccomandazione condizionale a favore) - efficace nel ridurre l'esposizione cumulativa a GC.",
          "MTX come alternativa se tocilizumab controindicato o non disponibile.",
        ],
      },
      {
        title: "GCA - Recidive e tapering",
        items: [
          "Recidiva con sintomi cranici: aumentare GC alla dose pre-recidiva + tocilizumab (se non già in uso).",
          "Recidiva senza sintomi cranici: aumento moderato GC + considerare tocilizumab.",
          "Riduzione GC con tocilizumab: target sospensione GC entro 6-12 mesi.",
          "Aspirina a basse dosi NON raccomandata di routine in GCA.",
        ],
      },
      {
        title: "TAK - Induzione",
        items: [
          "GC alte dosi (1 mg/kg/die prednisone) come prima linea.",
          "Aggiungere immunosoppressore non-biologico (MTX, AZA, MMF, leflunomide) al GC in TUTTI i pazienti.",
          "Casi severi/refrattari: TNFi (preferenza ACR) o tocilizumab come seconda linea.",
        ],
      },
      {
        title: "TAK - Recidive",
        items: [
          "Recidive in corso di GC + DMARD non-biologico → aggiungere o passare a TNFi (infliximab, adalimumab) o tocilizumab.",
          "Aspirina non raccomandata di routine; considerare in caso di rischio CV elevato o coinvolgimento coronarico.",
          "Anticoagulazione solo per indicazioni specifiche (trombosi documentata).",
        ],
      },
      {
        title: "Procedure invasive",
        items: [
          "Rivascolarizzazione (chirurgia vs endovascolare) nei pazienti con stenosi sintomatica critica, idealmente in fase di remissione attiva.",
          "Continuare immunosoppressione per ridurre rischio restenosi.",
          "Centro di esperienza multidisciplinare raccomandato.",
        ],
      },
      {
        title: "Sorveglianza imaging",
        items: [
          "GCA con coinvolgimento aortico: imaging (CTA/MRA o ecocardio aortico) ogni 1-2 anni per dilatazione/aneurisma.",
          "TAK: imaging seriato (MRA preferita per minor radiazione) ogni 6-12 mesi nel primo anno, poi annualmente in remissione.",
          "Adeguare frequenza in base ad attività clinica e sospetto di progressione.",
        ],
      },
    ],
    note: "Le raccomandazioni ACR sono complementari alle EULAR 2018; differenze principali sull'uso di tocilizumab vs MTX e sull'aspirina.",
  },

  // ============ EULAR 2025 - RA Update ============
  {
    id: "eular_2025_ra",
    name: "Artrite Reumatoide (update 2025)",
    disease: "Artrite Reumatoide",
    source: "EULAR 2025 (Smolen)",
    year: 2025,
    url: "https://ard.bmj.com/content/early/2026/03/18/ard-2026-228134",
    urls: [
      { label: "PubMed", href: "https://pubmed.ncbi.nlm.nih.gov/41826212/" },
      { label: "EULAR document download", href: "https://www.eular.org/document/download/1406/ec021a77-cdf3-4de3-ae72-57c1757db549/1325" },
    ],
    intro:
      "Update 2025 delle raccomandazioni EULAR per il trattamento dell'AR (Smolen et al.). 5 principi generali invariati dal 2022 + 9 raccomandazioni (da 11 nel 2022) su DMARDs sintetici convenzionali (csDMARDs), biologici (bDMARDs inclusi biosimilari) e sintetici mirati (tsDMARDs/JAK-i), con nuove evidenze su sicurezza (MACE, neoplasie, TEV), costi e sequenziamento.",
    sections: [
      {
        title: "Principi generali (invariati)",
        items: [
          "Iniziare i DMARDs immediatamente alla diagnosi di AR.",
          "Target: remissione sostenuta o bassa attività di malattia in tutti i pazienti.",
          "Monitoraggio frequente (ogni 1-3 mesi se attiva); adeguare la terapia se non miglioramento a 3 mesi o target non raggiunto a 6 mesi.",
          "MTX come parte della prima strategia terapeutica (leflunomide o sulfasalazina se MTX controindicato).",
          "Decisioni condivise con il paziente tenendo conto di preferenze, comorbidità, efficacia e sicurezza.",
        ],
      },
      {
        title: "Prima linea",
        items: [
          "MTX + glucocorticoidi a breve termine (bridging) al momento di inizio/cambio csDMARD, con rapido tapering e sospensione appena possibile.",
          "Target primario: remissione clinica (DAS28 <2.6, SDAI ≤3.3, CDAI ≤2.8 o Boolean); alternativa accettabile: LDA.",
          "Se MTX controindicato: leflunomide 20 mg/die o sulfasalazina 2-3 g/die.",
        ],
      },
      {
        title: "Risposta insufficiente dopo 3-6 mesi",
        items: [
          "Aggiungere un bDMARD (TNFi, IL-6i, abatacept, rituximab) al csDMARD.",
          "In alternativa considerare un JAKi DOPO valutazione dei fattori di rischio (età >65 anni, fumo attuale/pregresso, altri fattori di rischio CV o neoplastico, TEV pregresso).",
          "Nei pazienti ad alto rischio per MACE/malignità/TEV, preferire bDMARDs rispetto a JAKi (riferimento studio ORAL Surveillance).",
        ],
      },
      {
        title: "Sequenziamento dopo fallimento di bDMARD/JAKi",
        items: [
          "Cambio classe (es. da TNFi ad anti-IL-6 o abatacept) o stessa classe (secondo TNFi) sono entrambi validi.",
          "Rituximab indicato specialmente dopo fallimento di TNFi o in presenza di controindicazioni ad altri biologici.",
          "Preferire biosimilari per ridurre i costi a parità di efficacia e sicurezza.",
        ],
      },
      {
        title: "Remissione sostenuta: tapering",
        items: [
          "Dopo remissione sostenuta (≥6 mesi), considerare RIDUZIONE di dose/intervallo dei b/tsDMARDs piuttosto che sospensione completa (minor rischio di flare).",
          "csDMARDs possono essere mantenuti come 'backbone' durante il tapering.",
          "Sospensione completa possibile ma con monitoraggio stretto; ripristinare rapidamente in caso di flare.",
        ],
      },
      {
        title: "Glucocorticoidi",
        items: [
          "GC a breve termine al momento di inizio/cambio di csDMARD, con tapering rapido (obiettivo <7.5 mg/die di prednisone equivalente entro 3 mesi, sospensione entro 6 mesi).",
          "Evitare GC cronici a qualsiasi dose come terapia di mantenimento.",
        ],
      },
    ],
    note: "Principale novità 2025: rafforzamento del messaggio di sicurezza sui JAK-i nei pazienti a rischio MACE/malignità; raccomandazione esplicita per biosimilari; target di tapering con preferenza per riduzione vs sospensione.",
  },

  // ============ EULAR 2025 - Behçet Update ============
  {
    id: "eular_2025_behcet",
    name: "Malattia di Behçet (update 2025)",
    disease: "Behçet",
    source: "EULAR 2025 (update)",
    year: 2025,
    url: "https://ard.bmj.com/content/early/2026/03/23/ard-2026-228291",
    urls: [
      { label: "PubMed", href: "https://pubmed.ncbi.nlm.nih.gov/41876291/" },
      { label: "EULAR recommendations", href: "https://www.eular.org/recommendations-management" },
    ],
    intro:
      "Update EULAR 2025 per la gestione della sindrome di Behçet: 5 principi generali + 12 raccomandazioni organizzate per coinvolgimento d'organo. Rispetto al 2018: 1 raccomandazione interamente nuova, 7 con modifiche sostanziali, 4 con revisioni minori.",
    sections: [
      {
        title: "Principi generali",
        items: [
          "La malattia di Behçet ha decorso recidivante-remittente, può essere organo- e life-threatening; le manifestazioni possono migliorare nel tempo.",
          "Individualizzare il trattamento in base ad attività di malattia, fattori prognostici, presentazione d'organo.",
          "Approccio multidisciplinare (reumatologo, oftalmologo, gastroenterologo, neurologo, vascular surgeon).",
          "Educazione del paziente e decisione condivisa per prevenire il danno d'organo.",
          "Obiettivo: massimizzare la qualità di vita e prevenire il danno d'organo irreversibile.",
        ],
      },
      {
        title: "Manifestazioni mucocutanee e articolari",
        items: [
          "Colchicina 1-2 mg/die come PRIMA linea per aftosi orale/genitale ricorrente, eritema nodoso, artrite acuta.",
          "Glucocorticoidi topici per ulcere genitali (clobetasolo) e aftosi orale.",
          "Casi refrattari: apremilast (approvato per aftosi orale) o anti-TNFα monoclonali (adalimumab, infliximab).",
          "Artrite cronica/recidivante: immunosoppressori (AZA, ciclosporina) o anti-TNFα.",
        ],
      },
      {
        title: "Coinvolgimento oculare (uveite)",
        items: [
          "TUTTI i casi di uveite Behçet richiedono immunosoppressori per induzione/mantenimento della remissione.",
          "Coinvolgimento posteriore vista-minacciante: anti-TNFα monoclonali (PREFERIBILMENTE INFLIXIMAB) + immunosoppressore (AZA).",
          "EVITARE la monoterapia con glucocorticoidi in uveite posteriore/panuveite.",
          "Alternative: interferon-α, adalimumab, ciclosporina.",
          "Approccio steroid-sparing aggressivo per prevenire danno retinico cumulativo.",
        ],
      },
      {
        title: "Coinvolgimento vascolare",
        items: [
          "Trombosi venosa profonda o aneurismi: GC alte dosi + immunosoppressori (ciclofosfamide o AZA) come induzione.",
          "Anti-TNFα MONOCLONALI precocemente in induzione e mantenimento, preferiti rispetto ad altri biologici.",
          "Anticoagulazione: controversa; NON raccomandata di routine in assenza di alto rischio trombotico persistente o coinvolgimento cardiaco (evitare sanguinamento in aneurismi polmonari).",
        ],
      },
      {
        title: "Coinvolgimento neurologico (neuro-Behçet)",
        items: [
          "Parenchimale acuto: boli metilprednisolone + immunosoppressore (AZA, MMF o MTX).",
          "Refrattario/ricorrente: anti-TNFα monoclonali (infliximab preferibile).",
          "Trombosi dei seni venosi: GC ± anticoagulazione (controversa, valutare caso per caso).",
          "EVITARE ciclosporina in neuro-Behçet (possibile neurotossicità).",
        ],
      },
      {
        title: "Coinvolgimento gastrointestinale",
        items: [
          "Induzione: GC + 5-ASA o AZA nei casi lievi-moderati.",
          "Malattia severa o perforazione/emorragia: chirurgia + anti-TNFα.",
          "Refrattario: infliximab o adalimumab + immunosoppressore.",
        ],
      },
    ],
    note: "Principale novità 2025: raccomandazione esplicita per TNFα monoclonali precocemente (non più solo in refrattari) nelle manifestazioni vascolari/neurologiche/oculari life-threatening, con preferenza per infliximab nell'uveite. Apremilast formalmente inserito per l'aftosi orale refrattaria.",
  },

  // ============ ERS/EULAR 2025 - CTD-ILD ============
  {
    id: "ers_eular_2025_ctd_ild",
    name: "Interstiziopatia polmonare da malattie connettivali (CTD-ILD)",
    disease: "Interstiziopatia polmonare (ILD)",
    source: "ERS/EULAR 2025 (clinical practice guideline)",
    year: 2025,
    url: "https://doi.org/10.1016/j.ard.2025.08.021",
    urls: [
      { label: "DOI ARD 2025.08.021", href: "https://doi.org/10.1016/j.ard.2025.08.021" },
      { label: "ERS guidelines page", href: "https://www.ersnet.org/guidelines/" },
    ],
    intro:
      "Linee guida congiunte ERS/EULAR 2025 per la pratica clinica nelle CTD-ILD (Sclerosi sistemica, miositi, AR, Sjögren, MCTD, LES). Approccio sistematico a screening, diagnosi, stratificazione di gravità e terapia, con particolare enfasi sulla PPF (Progressive Pulmonary Fibrosis) come entità trasversale.",
    sections: [
      {
        title: "Screening all'esordio della CTD",
        items: [
          "SSc: HRCT al basale per TUTTI i pazienti (qualunque subset, anche limitata); PFR (FVC + DLCO) baseline.",
          "Miositi (soprattutto anti-MDA5, anti-sintetasi): HRCT + PFR all'esordio; allert a RP-ILD in MDA5.",
          "AR: HRCT se sintomi respiratori persistenti, fattori di rischio (RF/ACPA alti, fumo, età avanzata, M) o crackles inspiratori.",
          "Sjögren, MCTD, LES: HRCT su indicazione clinica; basso sospetto in LES pura isolata.",
        ],
      },
      {
        title: "Diagnosi e caratterizzazione",
        items: [
          "HRCT ad alta risoluzione: pattern (NSIP prevalente in SSc/miositi, UIP più comune in AR, OP possibile), estensione (Goh-Wells >20% = estesa).",
          "Discussione multidisciplinare (MDD) con radiologo e pneumologo per casi atipici.",
          "Biopsia polmonare chirurgica NON raccomandata di routine in CTD-ILD (rischio superiore al beneficio; fenotipo CTD già orientativo).",
          "Profilo autoanticorpale completo: ANA, ENA (Scl-70, RNAP3, Jo-1, PL-7, MDA5, Ro52, PM-Scl), RF, anti-CCP.",
        ],
      },
      {
        title: "Stratificazione di gravità e rischio progressione",
        items: [
          "Gravità basale: FVC <70%, DLCO <60%, estensione HRCT >20%, desaturazione al 6MWT.",
          "Criteri di progressione (PPF): declino FVC ≥5% in 1 anno, declino DLCO ≥10%, aumento estensione HRCT, peggioramento sintomatico.",
          "Monitoraggio: PFR + sintomi ogni 3-6 mesi nel primo anno; HRCT annuale se progressione sospetta.",
          "6-minute walk test: utile per monitoraggio e valutazione PH associata.",
        ],
      },
      {
        title: "Terapia di prima linea - SSc-ILD",
        items: [
          "Micofenolato mofetil 2-3 g/die come prima scelta (estensione HRCT ≥20% o FVC <80% o declino funzionale).",
          "Alternativa: ciclofosfamide (e.v. cicli) nei casi rapidamente progressivi.",
          "Tocilizumab (162 mg/sett s.c.): efficace nella stabilizzazione FVC, considerare in pazienti a rischio progressione.",
          "Nintedanib: aggiungere se progressione nonostante terapia immunosoppressiva (PPF), trial SENSCIS.",
        ],
      },
      {
        title: "Terapia - Miosite-ILD",
        items: [
          "Prima linea: GC + MMF o azatioprina (tutte le miositi).",
          "Anti-MDA5 con RP-ILD: terapia AGGRESSIVA precoce (triple therapy: GC alte dosi + tacrolimus + ciclofosfamide; plasmaferesi/IVIG nei casi severi).",
          "Anti-sintetasi (Jo-1, PL-7, PL-12): MMF, ciclofosfamide o rituximab.",
          "Tofacitinib o baricitinib: evidenza crescente in MDA5-ILD refrattaria.",
        ],
      },
      {
        title: "Terapia - AR-ILD",
        items: [
          "Sospendere MTX SOLO se sospetto danno polmonare iatrogeno (NON di routine, le evidenze 2023-2024 hanno riabilitato MTX).",
          "Rituximab o abatacept preferibili a TNFi in AR-ILD nota (TNFi possono peggiorare ILD in alcuni casi).",
          "Nintedanib: approvato per PPF-AR (trial INBUILD), aggiungere se progressione.",
        ],
      },
      {
        title: "PPF (Progressive Pulmonary Fibrosis) - approccio trasversale",
        items: [
          "Definizione: ≥2 criteri in 12 mesi tra: peggioramento sintomi respiratori, declino FVC ≥5%, declino DLCO ≥10%, aumento fibrosi/honeycombing su HRCT.",
          "Nintedanib 150 mg x 2/die raccomandato in TUTTE le CTD-ILD con fenotipo PPF (SSc, AR, miositi, Sjögren, MCTD).",
          "Continuare o aggiungere immunosoppressore appropriato alla CTD sottostante.",
          "Pirfenidone: dati più limitati nelle CTD-ILD; considerare se nintedanib controindicato.",
        ],
      },
      {
        title: "Trapianto di polmone",
        items: [
          "Considerare precocemente in pazienti giovani con ILD progressiva nonostante terapia massimale.",
          "SSc non è più controindicazione assoluta se GI/cardiaco/renale ben controllati.",
          "Referral in centro di trapianto quando FVC <50% o DLCO <30% o desaturazione marcata al 6MWT.",
        ],
      },
    ],
    note: "Prima linea guida congiunta ERS/EULAR CTD-ILD; innovazioni chiave: stratificazione PPF, nintedanib esteso a tutte le CTD-ILD progressive, ruolo crescente tocilizumab in SSc-ILD, approccio più aggressivo in anti-MDA5 RP-ILD.",
  },

  // ============ EULAR 2019 - Vaccinazioni ============
  {
    id: "eular_2019_vaccination",
    name: "Vaccinazioni nei pazienti con malattie reumatiche autoimmuni",
    disease: "Vaccinazioni e profilassi",
    source: "EULAR 2019 (Furer)",
    year: 2019,
    url: "https://ard.bmj.com/content/79/1/39",
    urls: [
      { label: "PubMed", href: "https://pubmed.ncbi.nlm.nih.gov/31413005/" },
      { label: "PMC full text", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10324938/" },
    ],
    intro:
      "Raccomandazioni EULAR 2019 per la vaccinazione in pazienti adulti con AIIRD (Furer et al.): 6 principi generali + 9 raccomandazioni specifiche. Aggiornamento delle linee guida 2011 basato su revisioni sistematiche di rischio infettivo, efficacia e sicurezza vaccinale.",
    sections: [
      {
        title: "Principi generali",
        items: [
          "Valutare annualmente lo stato vaccinale di ogni paziente con AIIRD.",
          "Decisione condivisa con il paziente su benefici e rischi della vaccinazione.",
          "Programmare le vaccinazioni quando la malattia è QUIESCENTE, idealmente PRIMA di iniziare immunosoppressori.",
          "Vaccini NON VIVI sono sicuri in pazienti in qualunque terapia (csDMARD, bDMARD, tsDMARD, GC).",
          "Vaccini VIVI ATTENUATI richiedono cautela; preferibilmente prima dell'inizio dei biologici.",
          "Coinvolgere il medico di famiglia e coordinarsi con i centri vaccinali territoriali.",
        ],
      },
      {
        title: "Vaccini FORTEMENTE raccomandati",
        items: [
          "INFLUENZA: annuale, TUTTI i pazienti con AIIRD. Vaccino inattivato quadrivalente.",
          "PNEUMOCOCCO: schema sequenziale PCV13 (Prevenar13) seguito da PPV23 (Pneumovax23) a distanza di 8 settimane. Richiamo PPV23 a 5 anni.",
          "SARS-CoV-2: primario + richiami secondo raccomandazioni nazionali aggiornate.",
        ],
      },
      {
        title: "Altri vaccini non-vivi raccomandati",
        items: [
          "TETANO (Tdap): secondo schema generale della popolazione; in pazienti che hanno ricevuto rituximab negli ultimi 6 mesi, considerare immunoglobuline antitetano passive in caso di ferita a rischio.",
          "HPV: somministrare secondo le indicazioni generali della popolazione; particolarmente incoraggiato nelle pazienti con LES (maggiore rischio di infezione HPV persistente).",
          "EPATITE A e B: pazienti a rischio (viaggi, conviventi, tossicodipendenti, sanitari, pre-terapia con rituximab/biologici).",
          "HERPES ZOSTER ricombinante (Shingrix): raccomandato in tutti i pazienti AIIRD >50 anni (vaccino NON vivo, sicuro anche in immunosoppressione).",
          "Meningococco, Haemophilus influenzae B: nei pazienti con deficit del complemento o in terapia con eculizumab.",
        ],
      },
      {
        title: "Vaccini VIVI ATTENUATI - cautela",
        items: [
          "MMR (morbillo-parotite-rosolia): controindicato in immunosoppressione significativa; se possibile, somministrare prima dell'inizio del biologico.",
          "Varicella: stessa cautela; verificare stato sierologico prima della terapia.",
          "Febbre gialla: controindicata durante terapia biologica; se viaggio in area endemica è indispensabile, valutare sospensione temporanea (caso per caso).",
          "BCG, rotavirus, polio orale: controindicati in immunosoppressione.",
          "Herpes zoster VIVO (Zostavax): NON usare se disponibile Shingrix (ricombinante, sicuro).",
        ],
      },
      {
        title: "Contesti particolari",
        items: [
          "RITUXIMAB: vaccinare ALMENO 6 mesi dopo l'ultima infusione (ripresa linfociti B); meglio prima dell'induzione.",
          "JAK inibitori e metotrexato: vaccini inattivati sicuri; possibile riduzione della risposta.",
          "Gravidanza in AIIRD: influenza + Tdap raccomandati; evitare vivi.",
          "Neonati esposti in utero a TNFi (soprattutto 3° trimestre) o rituximab: EVITARE vaccini vivi (BCG, rotavirus) per ALMENO 6 mesi.",
          "Conviventi di paziente AIIRD: vaccinare come popolazione generale; EVITARE la polio orale; rotavirus nei neonati conviventi è sicuro.",
        ],
      },
      {
        title: "Monitoraggio risposta vaccinale",
        items: [
          "Titoli anticorpali post-vaccinazione utili in pazienti in rituximab o biologici intensi.",
          "HBsAb quantitativo dopo ciclo epatite B.",
          "Pneumococco: no monitoraggio di routine; richiamo PPV23 a 5 anni.",
        ],
      },
    ],
    note: "Le raccomandazioni sono state parzialmente aggiornate post-COVID-19 per includere vaccinazioni SARS-CoV-2; l'herpes zoster ricombinante Shingrix (non-vivo) ha reso obsoleta la controindicazione al vaccino vivo Zostavax negli immunosoppressi.",
  },

  // ============ ACR/AAHKS 2022 - Perioperatorio ============
  {
    id: "acr_aahks_2022_perioperative",
    name: "Gestione perioperatoria dei farmaci antireumatici (chirurgia elettiva)",
    disease: "Perioperatorio",
    source: "ACR/AAHKS 2022 (Goodman)",
    year: 2022,
    url: "https://rheumatology.org/perioperative-management-guideline",
    urls: [
      { label: "PubMed", href: "https://pubmed.ncbi.nlm.nih.gov/35732511/" },
      { label: "Full text Wiley", href: "https://acrjournals.onlinelibrary.wiley.com/doi/10.1002/acr.24893" },
      { label: "AAHKS page", href: "https://www.aahks.org/perioperative-management-guidelines/" },
    ],
    intro:
      "Linee guida ACR/AAHKS 2022 (Goodman et al.) per la gestione perioperatoria dei farmaci antireumatici (DMARDs, biologici, tsDMARDs, glucocorticoidi) in pazienti con malattie reumatiche (AR, SpA, JIA, LES) sottoposti ad ARTROPLASTICA ELETTIVA dell'anca o ginocchio. Aggiornamento 2022 estende raccomandazioni a nuovi farmaci e al LES.",
    sections: [
      {
        title: "Principi generali",
        items: [
          "Obiettivo: bilanciare rischio infezione peri-operatoria vs rischio di flare di malattia.",
          "Le raccomandazioni si applicano a chirurgia elettiva; in urgenza prevale il giudizio clinico.",
          "Coordinamento tra reumatologo, chirurgo ortopedico e paziente (decisione condivisa).",
          "Le raccomandazioni 2022 si estendono anche al LES (non solo ad artrite infiammatoria).",
        ],
      },
      {
        title: "DMARDs convenzionali - CONTINUARE per tutta la perioperatoria",
        items: [
          "Methotrexato: CONTINUARE al dosaggio abituale (evidenza robusta: no aumento infezioni).",
          "Leflunomide: CONTINUARE.",
          "Sulfasalazina: CONTINUARE.",
          "Idrossiclorochina: CONTINUARE (cardioprotettiva in LES).",
          "Azatioprina, ciclosporina, tacrolimus: continuare in LES severo/attivo; valutare caso per caso in AR.",
          "Apremilast (non-biologico tsDMARD): continuare.",
        ],
      },
      {
        title: "Biologici e JAK inibitori - SOSPENDERE preoperatoriamente",
        items: [
          "TNFi (adalimumab, etanercept, infliximab, golimumab, certolizumab): programmare chirurgia alla FINE dell'intervallo di somministrazione (es. adalimumab s.c. 40 mg ogni 2 sett → operare alla settimana 2, successiva dose post-operatoria).",
          "Tocilizumab e.v. (ogni 4 sett) → operare a settimana 5; s.c. (settimanale) → saltare ultima dose.",
          "Rituximab (ogni 4-6 mesi): operare al mese 7 (1 mese dopo l'inizio del nuovo ciclo).",
          "Abatacept: s.c. settimanale → saltare ultima dose; e.v. ogni 4 sett → operare a settimana 5.",
          "Ustekinumab: operare a settimana 13 (12 settimane tra le dosi + 1 settimana margine).",
          "Secukinumab/Ixekizumab (IL-17i): saltare ultima dose prima della chirurgia.",
          "JAK inibitori (tofacitinib, baricitinib, upadacitinib, filgotinib): SOSPENDERE 3 GIORNI prima della chirurgia.",
          "RIPRESA post-operatoria: tutti i biologici/JAKi possono essere ripresi una volta che la guarigione della ferita è evidente (tipicamente 14 giorni) e in assenza di segni di infezione.",
        ],
      },
      {
        title: "Glucocorticoidi",
        items: [
          "Dose ≤10 mg/die prednisone equivalente: CONTINUARE la dose abituale (no stress dose di routine).",
          "Dose 10-20 mg/die: continuare al dosaggio abituale senza supplementazione di routine.",
          "Dose >20 mg/die: considerare STRESS DOSE perioperatoria (idrocortisone 50-100 mg e.v. all'induzione + tapering rapido nelle 24-48h).",
          "Prima della chirurgia: se possibile, ottimizzare riducendo il GC a ≤10 mg/die durante la pianificazione preoperatoria.",
        ],
      },
      {
        title: "LES - indicazioni specifiche (nuove in 2022)",
        items: [
          "LES SEVERO ATTIVO (renale, SNC, cardiopolmonare): continuare tutti i farmaci (rituximab, belimumab, MMF, AZA) in consulto con il reumatologo. Rinviare chirurgia elettiva se possibile.",
          "LES NON SEVERO: idrossiclorochina sempre continuata; MMF/AZA/MTX continuati; biologici (belimumab, rituximab) SOSPESI secondo i criteri dei biologici generali.",
          "Anifrolumab: dati limitati; gestire come biologico (sospendere pre-operatoriamente e riprendere dopo guarigione ferita).",
        ],
      },
      {
        title: "Valutazione pre-operatoria",
        items: [
          "Controllare screening attivo: TBC latente (IGRA), epatiti B/C, HIV se non già fatto per l'inizio del biologico.",
          "Ottimizzare comorbidità: diabete, BPCO, scompenso cardiaco, insufficienza renale.",
          "Ridurre al minimo GC cronici, fumo, obesità grave (BMI>40) - fattori di rischio indipendenti di infezione protesi.",
          "Screening nasale S. aureus e decolonizzazione con mupirocina + clorexidina nella settimana pre-operatoria.",
        ],
      },
    ],
    note: "Le raccomandazioni si applicano a chirurgia elettiva ortopedica maggiore (principalmente THA/TKA). In urgenza o per altri interventi (es. cardiochirurgia, chirurgia addominale maggiore) i principi sono estrapolabili ma la decisione è del team chirurgico.",
  },
];

export const GUIDELINE_GROUPS = Array.from(new Set(GUIDELINES.map((g) => g.disease)));
