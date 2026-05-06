// Criteri classificativi delle malattie reumatiche.
// Ogni criterio ha:
//   id, name, disease, source, intro
//   sections: [{ title?, type: 'radio'|'check'|'list', items: [{ key, label, points, options? }] }]
//   threshold: { value, label } per la classificazione
//   note?: string

export const CRITERIA = [
  // ============ VEDOSS - EUSTAR (2-level structure) ============
  {
    id: "vedoss_2011",
    name: "VEDOSS (Sclerodermia molto precoce)",
    disease: "Sclerosi Sistemica",
    source: "EUSTAR - Avouac et al.",
    intro:
      "I criteri VEDOSS (Very Early Diagnosis of Systemic Sclerosis) identificano i pazienti a rischio di sviluppare SSc PRIMA che soddisfino i criteri ACR/EULAR 2013. Struttura a 2 livelli: LIVELLO 1 richiede TUTTI E TRE i red flags (Raynaud + ANA + puffy fingers); LIVELLO 2 conferma la SSc molto precoce con ≥1 marker sclerodermico specifico.",
    sections: [
      {
        title: "LIVELLO 1 - Red flags (tutti e tre obbligatori per il sospetto)",
        type: "check",
        items: [
          { key: "raynaud", label: "Fenomeno di Raynaud (criterio di ingresso obbligatorio)", points: 1 },
          { key: "ana", label: "Positività ANA", points: 1 },
          { key: "puffy", label: "Puffy fingers (dita edematose)", points: 1 },
        ],
      },
      {
        title: "LIVELLO 2 - Conferma di SSc molto precoce (almeno UNO dei seguenti)",
        type: "check",
        items: [
          { key: "aca", label: "Autoanticorpo SSc-specifico: anti-centromero (ACA)", points: 1 },
          { key: "scl70", label: "Autoanticorpo SSc-specifico: anti-topoisomerasi I (Scl-70)", points: 1 },
          { key: "rnap3", label: "Autoanticorpo SSc-specifico: anti-RNA polimerasi III", points: 1 },
          { key: "capillaroscopy_ssc", label: "Capillaroscopia periungueale con pattern sclerodermico (Early/Active/Late)", points: 1 },
        ],
      },
    ],
    threshold: { value: 4, label: "VEDOSS positivo (3 red flags di Livello 1 + ≥1 marker Livello 2)" },
    note:
      "Interpretazione: il sospetto VEDOSS richiede tutti e tre i red flags del Livello 1 (Raynaud + ANA + puffy fingers). Il sospetto è confermato come 'SSc molto precoce' SOLO se coesiste almeno un marker del Livello 2 (autoanticorpo SSc-specifico o capillaroscopia sclerodermica). Uno score totale ≥4 è indicativo ma verifica manualmente che tutti i 3 red flags del Livello 1 siano positivi.",
  },

  // ============ ARTRITE REUMATOIDE ============
  {
    id: "acr_eular_2010_ra",
    name: "Artrite Reumatoide",
    disease: "Artrite Reumatoide",
    source: "ACR/EULAR 2010",
    intro: "Score totale ≥6/10 = AR definita. Da applicare in pazienti con almeno 1 articolazione con sinovite clinica non altrimenti spiegata.",
    sections: [
      {
        title: "Coinvolgimento articolare",
        type: "radio",
        groupKey: "joints",
        options: [
          { value: "1lj", label: "1 articolazione grande", points: 0 },
          { value: "210lj", label: "2-10 articolazioni grandi", points: 1 },
          { value: "13sj", label: "1-3 articolazioni piccole (con o senza grandi)", points: 2 },
          { value: "410sj", label: "4-10 articolazioni piccole (con o senza grandi)", points: 3 },
          { value: "10pj", label: ">10 articolazioni (almeno 1 piccola)", points: 5 },
        ],
      },
      {
        title: "Sierologia (almeno 1 test)",
        type: "radio",
        groupKey: "sero",
        options: [
          { value: "neg", label: "FR e ACPA negativi", points: 0 },
          { value: "lowpos", label: "FR o ACPA debolmente positivi (≤3× ULN)", points: 2 },
          { value: "highpos", label: "FR o ACPA fortemente positivi (>3× ULN)", points: 3 },
        ],
      },
      {
        title: "Reattanti di fase acuta",
        type: "radio",
        groupKey: "apr",
        options: [
          { value: "norm", label: "PCR e VES normali", points: 0 },
          { value: "abn", label: "PCR o VES anormali", points: 1 },
        ],
      },
      {
        title: "Durata sintomi",
        type: "radio",
        groupKey: "duration",
        options: [
          { value: "lt6", label: "< 6 settimane", points: 0 },
          { value: "ge6", label: "≥ 6 settimane", points: 1 },
        ],
      },
    ],
    threshold: { value: 6, label: "AR definita (score ≥ 6)" },
  },

  // ============ ARTRITE PSORIASICA - CASPAR ============
  {
    id: "caspar_psa",
    name: "Artrite Psoriasica",
    disease: "Artrite Psoriasica",
    source: "CASPAR 2006",
    intro: "Malattia infiammatoria muscoloscheletrica + ≥3 punti dai criteri seguenti.",
    sections: [
      {
        title: "Criteri (somma punti)",
        type: "check",
        items: [
          { key: "psoriasis_current", label: "Psoriasi cutanea attuale", points: 2 },
          { key: "psoriasis_history", label: "Storia personale di psoriasi", points: 1 },
          { key: "psoriasis_family", label: "Storia familiare di psoriasi (1°/2° grado)", points: 1 },
          { key: "nail_dystrophy", label: "Distrofia ungueale tipica", points: 1 },
          { key: "rf_negative", label: "FR negativo", points: 1 },
          { key: "dactylitis", label: "Dattilite (attuale o storica)", points: 1 },
          { key: "juxta_bone", label: "Neoformazione ossea iuxta-articolare radiografica", points: 1 },
        ],
      },
    ],
    threshold: { value: 3, label: "AP classificata (score ≥ 3)" },
  },

  // ============ ASAS SpA ASSIALE ============
  {
    id: "asas_axspa",
    name: "Spondiloartrite assiale",
    disease: "Spondiloartrite",
    source: "ASAS 2009",
    intro: "Pazienti con dolore lombare ≥3 mesi e età d'esordio <45 anni. Vale 1 dei 2 bracci.",
    sections: [
      {
        title: "Imaging (ramo imaging)",
        type: "check",
        items: [
          { key: "sacroiliitis_imaging", label: "Sacroileite all'imaging (RMN o radiografia secondo criteri NY mod.) + ≥1 feature SpA", points: 1 },
        ],
      },
      {
        title: "HLA-B27 (ramo clinico) - richiede ≥2 features SpA aggiuntive",
        type: "check",
        items: [
          { key: "hlab27", label: "HLA-B27 positivo + ≥2 features SpA", points: 1 },
        ],
      },
      {
        title: "Features SpA (utili per entrambi i bracci)",
        type: "check",
        items: [
          { key: "ibp", label: "Dolore lombare infiammatorio (IBP)", points: 0 },
          { key: "arthritis", label: "Artrite", points: 0 },
          { key: "enthesitis", label: "Entesite (calcaneare)", points: 0 },
          { key: "uveitis", label: "Uveite", points: 0 },
          { key: "dactylitis", label: "Dattilite", points: 0 },
          { key: "psoriasis", label: "Psoriasi", points: 0 },
          { key: "ibd", label: "Malattia infiammatoria intestinale (Crohn/UC)", points: 0 },
          { key: "good_response", label: "Buona risposta a FANS", points: 0 },
          { key: "family_history", label: "Storia familiare di SpA", points: 0 },
          { key: "elevated_crp", label: "PCR elevata", points: 0 },
        ],
      },
    ],
    threshold: { value: 1, label: "axSpA classificata (uno dei due bracci)" },
    note: "Verifica manualmente che le features SpA aggiuntive siano sufficienti per il ramo clinico (≥2 features oltre HLA-B27).",
  },

  // ============ INFLAMMATORY BACK PAIN (ASAS 2009) ============
  {
    id: "asas_ibp",
    name: "Inflammatory Back Pain (IBP)",
    disease: "Spondiloartrite",
    source: "ASAS expert criteria 2009",
    intro: "In pazienti con dolore lombare cronico (≥3 mesi). IBP presente se ≥4 dei 5 criteri.",
    sections: [
      {
        type: "check",
        items: [
          { key: "age_onset", label: "Esordio prima dei 40 anni", points: 1 },
          { key: "insidious", label: "Esordio insidioso", points: 1 },
          { key: "improvement_exercise", label: "Miglioramento con il movimento", points: 1 },
          { key: "no_improvement_rest", label: "Nessun miglioramento con il riposo", points: 1 },
          { key: "night_pain", label: "Dolore notturno (con miglioramento alzandosi)", points: 1 },
        ],
      },
    ],
    threshold: { value: 4, label: "IBP classificato (≥ 4/5)" },
  },

  // ============ LES ACR/EULAR 2019 ============
  {
    id: "acr_eular_2019_sle",
    name: "Lupus Eritematoso Sistemico (LES)",
    disease: "LES",
    source: "ACR/EULAR 2019",
    intro: "Criterio di ingresso: ANA ≥1:80 in HEp-2 (almeno una volta). Score totale ≥10 = LES classificato. Per ogni dominio considera SOLO il punteggio più alto.",
    sections: [
      {
        title: "Criterio di ingresso",
        type: "check",
        items: [{ key: "ana", label: "ANA ≥ 1:80 (HEp-2) almeno una volta - REQUISITO", points: 0 }],
      },
      {
        title: "Costituzionale",
        type: "radio", groupKey: "constitutional",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "fever", label: "Febbre", points: 2 },
        ],
      },
      {
        title: "Ematologico (max)",
        type: "radio", groupKey: "hematologic",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "leuko", label: "Leucopenia", points: 3 },
          { value: "thrombo", label: "Trombocitopenia", points: 4 },
          { value: "ahai", label: "Anemia emolitica autoimmune", points: 4 },
        ],
      },
      {
        title: "Neuropsichiatrico (max)",
        type: "radio", groupKey: "neuro",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "delirium", label: "Delirium", points: 2 },
          { value: "psychosis", label: "Psicosi", points: 3 },
          { value: "seizure", label: "Crisi epilettiche", points: 5 },
        ],
      },
      {
        title: "Mucocutaneo (max)",
        type: "radio", groupKey: "muco",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "alopecia", label: "Alopecia non cicatriziale", points: 2 },
          { value: "ulcers", label: "Ulcere orali", points: 2 },
          { value: "subacute", label: "Lupus cutaneo subacuto/discoide", points: 4 },
          { value: "acute", label: "Lupus cutaneo acuto", points: 6 },
        ],
      },
      {
        title: "Sieroso (max)",
        type: "radio", groupKey: "serous",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "effusion", label: "Versamento pleurico/pericardico", points: 5 },
          { value: "acute_peri", label: "Pericardite acuta", points: 6 },
        ],
      },
      {
        title: "Muscoloscheletrico",
        type: "radio", groupKey: "msk",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "joints", label: "Coinvolgimento articolare (≥2 articolazioni)", points: 6 },
        ],
      },
      {
        title: "Renale (max)",
        type: "radio", groupKey: "renal",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "proteinuria", label: "Proteinuria > 0.5 g/24h", points: 4 },
          { value: "biopsy_25", label: "Biopsia: classe II o V", points: 8 },
          { value: "biopsy_34", label: "Biopsia: classe III o IV", points: 10 },
        ],
      },
      {
        title: "Anticorpi antifosfolipidi",
        type: "radio", groupKey: "apl",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "pos", label: "Anti-cardiolipina o anti-β2GP1 o LAC positivi", points: 2 },
        ],
      },
      {
        title: "Complemento (max)",
        type: "radio", groupKey: "complement",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "low_one", label: "Basso C3 o C4", points: 3 },
          { value: "low_both", label: "Basso C3 e C4", points: 4 },
        ],
      },
      {
        title: "Anticorpi specifici LES (max)",
        type: "radio", groupKey: "ab_specific",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "dsdna_sm", label: "Anti-dsDNA o anti-Sm", points: 6 },
        ],
      },
    ],
    threshold: { value: 10, label: "LES classificato (score ≥ 10)" },
    note: "ANA ≥1:80 è prerequisito assoluto. Sommare un solo punteggio massimo per dominio.",
  },

  // ============ SJOGREN ACR/EULAR 2016 ============
  {
    id: "acr_eular_2016_sjogren",
    name: "Sindrome di Sjögren",
    disease: "Sjögren",
    source: "ACR/EULAR 2016",
    intro: "Pazienti con sintomi di occhio o bocca secchi (almeno 1 di 5 ESSDAI) o sospetto. Score ≥4 = Sjögren primario.",
    sections: [
      {
        type: "check",
        items: [
          { key: "biopsy", label: "Sialoadenite linfocitaria focale alla biopsia ghiandole salivari minori (focus score ≥1)", points: 3 },
          { key: "ssa", label: "Anti-SSA/Ro positivi", points: 3 },
          { key: "ocular_staining", label: "Ocular Staining Score ≥5 (o van Bijsterveld ≥4) in almeno un occhio", points: 1 },
          { key: "schirmer", label: "Schirmer test ≤5 mm/5 min in almeno un occhio", points: 1 },
          { key: "uwsf", label: "Flusso salivare non stimolato ≤0.1 ml/min", points: 1 },
        ],
      },
    ],
    threshold: { value: 4, label: "Sjögren primario classificato (score ≥ 4)" },
    note: "Esclusione: HCV attiva, HIV, sarcoidosi, amiloidosi, GVHD, malattia IgG4-correlata, radioterapia testa-collo.",
  },

  // ============ SCLEROSI SISTEMICA ACR/EULAR 2013 ============
  {
    id: "acr_eular_2013_ssc",
    name: "Sclerosi Sistemica",
    disease: "Sclerosi Sistemica",
    source: "ACR/EULAR 2013",
    intro: "Score totale ≥9 = SSc classificata. Considerare il punteggio massimo in ogni dominio.",
    sections: [
      {
        title: "Ispessimento cutaneo dita di entrambe le mani prossimale alle MCF (criterio sufficiente da solo)",
        type: "radio", groupKey: "skin_proximal",
        options: [
          { value: "none", label: "Assente", points: 0 },
          { value: "yes", label: "Presente", points: 9 },
        ],
      },
      {
        title: "Ispessimento cutaneo delle dita (max)",
        type: "radio", groupKey: "skin_fingers",
        options: [
          { value: "none", label: "Assente", points: 0 },
          { value: "puffy", label: "Dita gonfie (puffy fingers)", points: 2 },
          { value: "sclerodactyly", label: "Sclerodattilia distale alle MCF", points: 4 },
        ],
      },
      {
        title: "Lesioni dita (max)",
        type: "radio", groupKey: "fingertip",
        options: [
          { value: "none", label: "Assente", points: 0 },
          { value: "pits", label: "Cicatrici puntiformi (digital pitting scars)", points: 2 },
          { value: "ulcers", label: "Ulcere digitali", points: 3 },
        ],
      },
      {
        title: "Telangectasie",
        type: "check",
        items: [{ key: "telangiectasia", label: "Telangectasie", points: 2 }],
      },
      {
        title: "Capillaroscopia",
        type: "check",
        items: [{ key: "capillaroscopy", label: "Capillaroscopia tipica per sclerodermia", points: 2 }],
      },
      {
        title: "Ipertensione polmonare e/o ILD",
        type: "check",
        items: [{ key: "pah_ild", label: "PAH e/o malattia interstiziale polmonare (ILD)", points: 2 }],
      },
      {
        title: "Fenomeno di Raynaud",
        type: "check",
        items: [{ key: "raynaud", label: "Fenomeno di Raynaud", points: 3 }],
      },
      {
        title: "Autoanticorpi specifici (max 3 punti)",
        type: "radio", groupKey: "antibodies",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "any", label: "Anti-centromero / anti-topoisomerasi I (Scl-70) / anti-RNA polimerasi III", points: 3 },
        ],
      },
    ],
    threshold: { value: 9, label: "SSc classificata (score ≥ 9)" },
  },

  // ============ GOTTA ACR/EULAR 2015 ============
  {
    id: "acr_eular_2015_gout",
    name: "Gotta",
    disease: "Gotta",
    source: "ACR/EULAR 2015",
    intro: "Criterio di ingresso: ≥1 episodio di tumefazione/dolore/dolorabilità in articolazione periferica o borsa. Score ≥8 = gotta.",
    sections: [
      {
        title: "Pattern coinvolgimento articolare",
        type: "radio", groupKey: "pattern",
        options: [
          { value: "ankle_mid", label: "Caviglia/mediopiede (no I MTF)", points: 1 },
          { value: "first_mtp", label: "Coinvolgimento I MTF (passato/attuale)", points: 2 },
          { value: "none", label: "Altro pattern", points: 0 },
        ],
      },
      {
        title: "Caratteristiche dell'attacco",
        type: "check",
        items: [
          { key: "erythema", label: "Eritema sopra l'articolazione", points: 1 },
          { key: "intolerance", label: "Intolleranza al tatto/pressione", points: 1 },
          { key: "difficulty_walking", label: "Difficoltà a camminare/usare l'articolazione", points: 1 },
        ],
        note: "Per ogni episodio max 3 punti, considerare il peggiore.",
      },
      {
        title: "Decorso temporale (≥2 caratteristiche di un attacco tipico)",
        type: "radio", groupKey: "time_course",
        options: [
          { value: "one", label: "1 episodio tipico", points: 1 },
          { value: "recurrent", label: "Episodi ricorrenti tipici", points: 2 },
          { value: "none", label: "Nessuno", points: 0 },
        ],
      },
      {
        title: "Tofi clinici",
        type: "radio", groupKey: "tophi",
        options: [
          { value: "no", label: "Assenti", points: 0 },
          { value: "yes", label: "Presenti", points: 4 },
        ],
      },
      {
        title: "Uricemia (mg/dL) - sospendere terapia ipouricemizzante",
        type: "radio", groupKey: "uric",
        options: [
          { value: "lt4", label: "< 4 mg/dL", points: -4 },
          { value: "46", label: "4 - <6 mg/dL", points: 0 },
          { value: "68", label: "6 - <8 mg/dL", points: 2 },
          { value: "810", label: "8 - <10 mg/dL", points: 3 },
          { value: "ge10", label: "≥ 10 mg/dL", points: 4 },
        ],
      },
      {
        title: "Liquido sinoviale",
        type: "radio", groupKey: "synovial",
        options: [
          { value: "na", label: "Non eseguito", points: 0 },
          { value: "neg", label: "MSU non identificati", points: -2 },
        ],
      },
      {
        title: "Imaging",
        type: "check",
        items: [
          { key: "us_dch", label: "Ecografia: double contour sign", points: 4 },
          { key: "dect", label: "DECT: deposito di MSU", points: 4 },
          { key: "xr_erosion", label: "Erosioni gottose tipiche (RX)", points: 4 },
        ],
      },
    ],
    threshold: { value: 8, label: "Gotta classificata (score ≥ 8)" },
    note: "Identificazione cristalli MSU al microscopio polarizzato resta gold standard (criterio sufficiente).",
  },

  // ============ POLIMIALGIA REUMATICA ACR/EULAR 2012 ============
  {
    id: "acr_eular_2012_pmr",
    name: "Polimialgia Reumatica",
    disease: "PMR",
    source: "ACR/EULAR 2012",
    intro: "Pazienti ≥50 anni con dolore bilaterale ai cingoli e VES/PCR elevate. Score ≥4 (≥5 con ecografia) = PMR.",
    sections: [
      {
        title: "Criteri richiesti (prerequisito)",
        type: "check",
        items: [
          { key: "age", label: "Età ≥ 50 anni", points: 0 },
          { key: "shoulder_pain", label: "Dolore bilaterale ai cingoli scapolari", points: 0 },
          { key: "elevated_apr", label: "VES o PCR aumentate", points: 0 },
        ],
      },
      {
        title: "Criteri di scoring",
        type: "check",
        items: [
          { key: "morning_stiffness", label: "Rigidità mattutina > 45 minuti", points: 2 },
          { key: "hip_pain", label: "Dolore alle anche o limitazione del movimento", points: 1 },
          { key: "rf_ccp_neg", label: "FR e anti-CCP negativi", points: 2 },
          { key: "no_other_joint", label: "Assenza coinvolgimento altre articolazioni", points: 1 },
          { key: "us_shoulder", label: "Ecografia: ≥1 spalla con bursite subdeltoidea/tenosinovite bicipitale/sinovite gleno-omerale + ≥1 anca con sinovite/bursite trocanterica", points: 1 },
          { key: "us_both", label: "Ecografia: entrambe le spalle con bursite subdeltoidea/tenosinovite/sinovite", points: 1 },
        ],
      },
    ],
    threshold: { value: 4, label: "PMR classificata (score ≥ 4 senza eco, ≥ 5 con eco)" },
  },

  // ============ ANCA VASCULITI ACR/EULAR 2022 - GPA ============
  {
    id: "acr_eular_2022_gpa",
    name: "Granulomatosi con Poliangite (GPA)",
    disease: "Vasculiti ANCA",
    source: "ACR/EULAR 2022",
    intro: "In paziente con vasculite di piccolo/medio vaso. Score ≥5 = GPA.",
    sections: [
      {
        title: "Clinica",
        type: "check",
        items: [
          { key: "nasal", label: "Coinvolgimento naso/seni paranasali (sanguinamento, croste, sinusite, dolore)", points: 3 },
          { key: "cartilaginous", label: "Coinvolgimento cartilagineo (es. perforazione setto, sella nasale)", points: 2 },
          { key: "hearing", label: "Sordità neurosensoriale o conduttiva", points: 1 },
        ],
      },
      {
        title: "Laboratorio / imaging",
        type: "check",
        items: [
          { key: "anca_pr3", label: "c-ANCA o anti-PR3 positivi", points: 5 },
          { key: "lung_nodule", label: "Noduli polmonari, masse o cavitazioni", points: 2 },
          { key: "granuloma", label: "Granuloma, infiltrato extravascolare granulomatoso o vasculite granulomatosa alla biopsia", points: 2 },
          { key: "inflammation_sinus", label: "Coinvolgimento naso/seni in imaging", points: 1 },
          { key: "pauciimmune_gn", label: "Glomerulonefrite pauci-immune", points: 1 },
        ],
      },
      {
        title: "Sottrai punti",
        type: "check",
        items: [
          { key: "anca_mpo", label: "p-ANCA o anti-MPO positivi", points: -1 },
          { key: "eosinophilia", label: "Eosinofilia ≥ 1×10⁹/L", points: -4 },
        ],
      },
    ],
    threshold: { value: 5, label: "GPA classificata (score ≥ 5)" },
  },
  {
    id: "acr_eular_2022_mpa",
    name: "Poliangite Microscopica (MPA)",
    disease: "Vasculiti ANCA",
    source: "ACR/EULAR 2022",
    intro: "Score ≥5 = MPA.",
    sections: [
      {
        title: "Clinica e laboratorio",
        type: "check",
        items: [
          { key: "anca_mpo", label: "p-ANCA o anti-MPO positivi", points: 6 },
          { key: "fibrosis", label: "Fibrosi polmonare o ILD (imaging)", points: 3 },
          { key: "pauciimmune_gn", label: "Glomerulonefrite pauci-immune", points: 1 },
        ],
      },
      {
        title: "Sottrai punti",
        type: "check",
        items: [
          { key: "nasal", label: "Sintomi naso/seni o cartilaginosi", points: -3 },
          { key: "anca_pr3", label: "c-ANCA o anti-PR3 positivi", points: -1 },
          { key: "eosinophilia", label: "Eosinofilia ≥ 1×10⁹/L", points: -4 },
        ],
      },
    ],
    threshold: { value: 5, label: "MPA classificata (score ≥ 5)" },
  },
  {
    id: "acr_eular_2022_egpa",
    name: "Granulomatosi Eosinofila con Poliangite (EGPA)",
    disease: "Vasculiti ANCA",
    source: "ACR/EULAR 2022",
    intro: "Score ≥6 = EGPA.",
    sections: [
      {
        type: "check",
        items: [
          { key: "asthma", label: "Asma ostruttivo", points: 3 },
          { key: "eosinophilia", label: "Eosinofilia ≥ 1×10⁹/L", points: 5 },
          { key: "nasal_polyps", label: "Polipi nasali", points: 3 },
          { key: "neuropathy", label: "Mononeurite multipla", points: 1 },
          { key: "extra_eos", label: "Infiltrati eosinofili extravascolari (biopsia)", points: 2 },
          { key: "anca_mpo", label: "p-ANCA o anti-MPO positivi", points: -3 },
          { key: "hematuria", label: "Ematuria", points: -1 },
        ],
      },
    ],
    threshold: { value: 6, label: "EGPA classificata (score ≥ 6)" },
  },

  // ============ STILL DELL'ADULTO - YAMAGUCHI 1992 ============
  {
    id: "yamaguchi_aosd",
    name: "Still dell'adulto (AOSD)",
    disease: "AOSD",
    source: "Yamaguchi 1992",
    intro: "Almeno 5 criteri totali, di cui ≥2 maggiori. Esclusioni richieste.",
    sections: [
      {
        title: "Criteri maggiori",
        type: "check",
        items: [
          { key: "fever", label: "Febbre ≥ 39°C per ≥ 1 settimana", points: 1 },
          { key: "arthralgia", label: "Artralgie/artrite ≥ 2 settimane", points: 1 },
          { key: "rash", label: "Rash tipico (color salmone, evanescente)", points: 1 },
          { key: "leukocytosis", label: "Leucocitosi ≥ 10.000/mm³ con neutrofili ≥ 80%", points: 1 },
        ],
      },
      {
        title: "Criteri minori",
        type: "check",
        items: [
          { key: "sore_throat", label: "Faringodinia", points: 1 },
          { key: "lymph", label: "Linfoadenopatia / splenomegalia", points: 1 },
          { key: "lft", label: "Alterazioni epatiche (transaminasi)", points: 1 },
          { key: "ana_rf_neg", label: "ANA e FR negativi", points: 1 },
        ],
      },
    ],
    threshold: { value: 5, label: "AOSD classificata (≥ 5 totali, ≥ 2 maggiori)" },
    note: "Esclusioni: infezioni, neoplasie (linfomi), altre malattie reumatiche.",
  },

  // ============ MIOSITI ACR/EULAR 2017 ============
  {
    id: "acr_eular_2017_iim",
    name: "Miositi Idiopatiche Infiammatorie",
    disease: "Miositi",
    source: "ACR/EULAR 2017",
    intro: "Score (senza biopsia ≥5.5; con biopsia ≥6.7) = IIM probabile. Soglia >7.5 (senza) / >8.7 (con biopsia) = IIM definita.",
    sections: [
      {
        title: "Età d'esordio",
        type: "radio", groupKey: "age",
        options: [
          { value: "lt18", label: "< 18 anni", points: 1.3 },
          { value: "ge18", label: "≥ 18 anni e < 40 anni", points: 1.5 },
          { value: "ge40", label: "≥ 40 anni", points: 2.1 },
          { value: "none", label: "Non valutabile", points: 0 },
        ],
      },
      {
        title: "Debolezza muscolare",
        type: "check",
        items: [
          { key: "prox_upper", label: "Debolezza obiettiva simmetrica prossimale arti superiori", points: 0.7 },
          { key: "prox_lower", label: "Debolezza obiettiva simmetrica prossimale arti inferiori", points: 0.8 },
          { key: "neck_flex_stronger", label: "Flessori del collo più deboli degli estensori", points: 1.9 },
          { key: "leg_prox_stronger", label: "Muscoli arti inferiori prossimali più deboli dei distali", points: 0.9 },
        ],
      },
      {
        title: "Manifestazioni cutanee",
        type: "check",
        items: [
          { key: "heliotrope", label: "Eritema eliotropo", points: 3.1 },
          { key: "gottron_papules", label: "Papule di Gottron", points: 2.1 },
          { key: "gottron_sign", label: "Segno di Gottron", points: 3.3 },
        ],
      },
      {
        title: "Altre manifestazioni",
        type: "check",
        items: [
          { key: "dysphagia", label: "Disfagia o dismotilità esofagea", points: 0.7 },
        ],
      },
      {
        title: "Laboratorio",
        type: "check",
        items: [
          { key: "anti_jo1", label: "Anti-Jo-1 positivi", points: 3.9 },
          { key: "elevated_enzymes", label: "Elevati enzimi muscolari (CK, LDH, AST, ALT, aldolasi)", points: 1.3 },
        ],
      },
      {
        title: "Biopsia muscolare (se eseguita)",
        type: "check",
        items: [
          { key: "endomysial_infiltrate", label: "Infiltrato endomisiale di cellule mononucleate intorno a miofibre non necrotiche", points: 1.7 },
          { key: "perimysial_infiltrate", label: "Infiltrato perimisiale/perivascolare di cellule mononucleate", points: 1.2 },
          { key: "perifascicular_atrophy", label: "Atrofia perifascicolare", points: 1.9 },
          { key: "rimmed_vacuoles", label: "Vacuoli orlati (rimmed vacuoles)", points: 3.1 },
        ],
      },
    ],
    threshold: { value: 5.5, label: "IIM probabile (≥5.5 senza biopsia / ≥6.7 con biopsia)" },
  },

  // ============ FIBROMIALGIA ACR 2016 ============
  {
    id: "acr_2016_fm",
    name: "Fibromialgia",
    disease: "Fibromialgia",
    source: "ACR 2016 (revisione 2010/2011)",
    intro: "Diagnosi se: WPI ≥ 7 + SSS ≥ 5 OPPURE WPI 4-6 + SSS ≥ 9. Sintomi presenti da almeno 3 mesi.",
    sections: [
      {
        title: "Widespread Pain Index (WPI) - aree con dolore (max 19)",
        type: "check",
        items: [
          { key: "shoulder_l", label: "Spalla SX", points: 1 },
          { key: "shoulder_r", label: "Spalla DX", points: 1 },
          { key: "upper_arm_l", label: "Braccio SX", points: 1 },
          { key: "upper_arm_r", label: "Braccio DX", points: 1 },
          { key: "lower_arm_l", label: "Avambraccio SX", points: 1 },
          { key: "lower_arm_r", label: "Avambraccio DX", points: 1 },
          { key: "hip_l", label: "Anca SX", points: 1 },
          { key: "hip_r", label: "Anca DX", points: 1 },
          { key: "upper_leg_l", label: "Coscia SX", points: 1 },
          { key: "upper_leg_r", label: "Coscia DX", points: 1 },
          { key: "lower_leg_l", label: "Gamba SX", points: 1 },
          { key: "lower_leg_r", label: "Gamba DX", points: 1 },
          { key: "jaw_l", label: "Mascella SX", points: 1 },
          { key: "jaw_r", label: "Mascella DX", points: 1 },
          { key: "chest", label: "Torace", points: 1 },
          { key: "abdomen", label: "Addome", points: 1 },
          { key: "upper_back", label: "Dorso", points: 1 },
          { key: "lower_back", label: "Lombi", points: 1 },
          { key: "neck", label: "Collo", points: 1 },
        ],
      },
      {
        title: "Symptom Severity Scale (SSS) - max 12",
        type: "radio", groupKey: "fatigue",
        options: [
          { value: 0, label: "Fatica: nessuna (0)", points: 0 },
          { value: 1, label: "Fatica: lieve (1)", points: 1 },
          { value: 2, label: "Fatica: moderata (2)", points: 2 },
          { value: 3, label: "Fatica: grave (3)", points: 3 },
        ],
      },
      {
        type: "radio", groupKey: "wak",
        options: [
          { value: 0, label: "Sonno non ristoratore: nessuno (0)", points: 0 },
          { value: 1, label: "Sonno: lieve (1)", points: 1 },
          { value: 2, label: "Sonno: moderato (2)", points: 2 },
          { value: 3, label: "Sonno: grave (3)", points: 3 },
        ],
      },
      {
        type: "radio", groupKey: "cognitive",
        options: [
          { value: 0, label: "Sintomi cognitivi: nessuno (0)", points: 0 },
          { value: 1, label: "Cognitivi: lievi (1)", points: 1 },
          { value: 2, label: "Cognitivi: moderati (2)", points: 2 },
          { value: 3, label: "Cognitivi: gravi (3)", points: 3 },
        ],
      },
      {
        title: "Sintomi somatici (ultimo 6 mesi)",
        type: "check",
        items: [
          { key: "headache", label: "Cefalea", points: 1 },
          { key: "abdominal_pain", label: "Dolore o crampi addominali", points: 1 },
          { key: "depression", label: "Depressione", points: 1 },
        ],
      },
    ],
    threshold: { value: 12, label: "Fibromialgia probabile (WPI≥7+SSS≥5 oppure WPI 4-6+SSS≥9)" },
    note: "Verifica manualmente WPI e SSS separati: lo score totale qui mostrato è la somma indicativa.",
  },

  // ============ BEHÇET - ICBD 2014 ============
  {
    id: "icbd_2014_behcet",
    name: "Malattia di Behçet",
    disease: "Behçet",
    source: "ICBD 2014",
    intro: "Score ≥ 4 = Behçet classificato.",
    sections: [
      {
        type: "check",
        items: [
          { key: "ocular", label: "Lesioni oculari (uveite anteriore/posteriore, vasculite retinica)", points: 2 },
          { key: "genital_aphthosis", label: "Afte genitali", points: 2 },
          { key: "oral_aphthosis", label: "Afte orali (≥3 episodi/anno)", points: 2 },
          { key: "skin", label: "Manifestazioni cutanee (pseudofollicolite, eritema nodoso)", points: 1 },
          { key: "neuro", label: "Manifestazioni neurologiche", points: 1 },
          { key: "vascular", label: "Manifestazioni vascolari (trombosi venosa, aneurismi)", points: 1 },
          { key: "pathergy", label: "Pathergy test positivo", points: 1 },
        ],
      },
    ],
    threshold: { value: 4, label: "Behçet classificato (score ≥ 4)" },
  },

  // ============ IgG4-RD ACR/EULAR 2019 ============
  {
    id: "acr_eular_2019_igg4",
    name: "Malattia IgG4-correlata",
    disease: "IgG4-RD",
    source: "ACR/EULAR 2019",
    intro: "Step 1 (entry): coinvolgimento clinico/radiologico organo tipico o biopsia con linfoplasmocitosi. Step 2 (esclusioni): nessuna deve essere presente. Step 3 (inclusione): score ≥ 20.",
    sections: [
      {
        title: "Criteri di inclusione (somma punti)",
        type: "check",
        items: [
          { key: "histopathology_dense", label: "Infiltrato linfoplasmacitario denso senza altra causa", points: 4 },
          { key: "histopathology_storiform", label: "Fibrosi storiforme + infiltrato linfoplasmocitario", points: 13 },
          { key: "histopathology_obliterative", label: "Flebite obliterante", points: 6 },
          { key: "ihc_ratio", label: "IHC: rapporto IgG4/IgG > 40% e IgG4+ > 10/HPF", points: 14 },
          { key: "serum_igg4_2x", label: "IgG4 sieriche 2-5× ULN", points: 6 },
          { key: "serum_igg4_5x", label: "IgG4 sieriche > 5× ULN", points: 11 },
          { key: "bilateral_lacrimal", label: "Coinvolgimento bilaterale ghiandole lacrimali/parotide/sottomandibolari/sublinguali", points: 14 },
          { key: "chest_paravertebral", label: "Massa paravertebrale toracica", points: 11 },
          { key: "retroperitoneum", label: "Fibrosi retroperitoneale circumferenziale/anterolaterale", points: 8 },
          { key: "pancreas_typical", label: "Pancreas: ingrandimento diffuso con halo", points: 19 },
          { key: "pancreas_other", label: "Pancreas: altre alterazioni indicative", points: 8 },
          { key: "biliary", label: "Coinvolgimento biliare extrapancreatico", points: 9 },
          { key: "kidney_low_complement", label: "Rene: ipocomplementemia", points: 6 },
          { key: "kidney_imaging", label: "Rene: lesioni multiple all'imaging", points: 10 },
        ],
      },
      {
        title: "Esclusioni (Step 2) - se presenti, NON classificare",
        type: "check",
        items: [
          { key: "exclude_fever", label: "Febbre persistente non spiegata", points: 0 },
          { key: "exclude_no_response", label: "Mancata risposta a steroidi", points: 0 },
          { key: "exclude_anca_pos", label: "ANCA positivi (PR3/MPO)", points: 0 },
          { key: "exclude_neoplasia", label: "Neoplasia accertata", points: 0 },
          { key: "exclude_infection", label: "Infezione attiva", points: 0 },
          { key: "exclude_other_disease", label: "Altra malattia autoimmune accertata (LES, SSc, ecc.)", points: 0 },
        ],
      },
    ],
    threshold: { value: 20, label: "IgG4-RD classificata (score ≥ 20 e nessuna esclusione)" },
    note: "Verifica obbligatoriamente che i criteri di entry e nessuna esclusione siano soddisfatti.",
  },

  // ============ APS - ACR/EULAR 2023 (Barbhaiya) ============
  {
    id: "acr_eular_2023_aps",
    name: "Sindrome da anticorpi antifosfolipidi (APS)",
    disease: "APS",
    source: "ACR/EULAR 2023",
    intro:
      "Criteri di classificazione 2023 (Barbhaiya et al.). ENTRY criterion: ≥1 aPL test positivo (LA, aCL IgG/IgM o aβ2GPI IgG/IgM) entro 3 anni da un evento clinico aPL-associato. CLASSIFICAZIONE: ≥3 punti nel dominio CLINICO (D1-D6) E ≥3 punti nel dominio LABORATORISTICO (D7-D8). I valori sono stratificati per profilo di rischio.",
    sections: [
      {
        title: "Entry criterion (obbligatorio)",
        type: "check",
        items: [
          { key: "entry_apl", label: "Almeno un test aPL positivo (LA, aCL o aβ2GPI IgG/IgM) entro 3 anni da un evento clinico", points: 0 },
          { key: "entry_event", label: "Almeno un evento clinico aPL-associato documentato", points: 0 },
        ],
      },
      {
        title: "D1 - Macrovascolare: tromboembolismo venoso (VTE)",
        type: "radio",
        groupKey: "d1_vte",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "high_risk", label: "VTE in paziente con profilo VTE ad alto rischio", points: 1 },
          { value: "low_risk", label: "VTE in paziente senza profilo VTE ad alto rischio", points: 3 },
        ],
      },
      {
        title: "D2 - Macrovascolare: trombosi arteriosa (AT)",
        type: "radio",
        groupKey: "d2_at",
        options: [
          { value: "none", label: "Nessuna", points: 0 },
          { value: "high_risk", label: "AT in paziente con profilo CVD ad alto rischio", points: 2 },
          { value: "low_risk", label: "AT in paziente senza profilo CVD ad alto rischio", points: 4 },
        ],
      },
      {
        title: "D3 - Microvascolare",
        type: "radio",
        groupKey: "d3_micro",
        options: [
          { value: "none", label: "Nessuna", points: 0 },
          { value: "suspected", label: "Sospetta (livedo racemosa, ulcere cutanee, microematuria, ecc.)", points: 2 },
          { value: "established", label: "Documentata (biopsia, RM, angio, retinopatia aPL, nefropatia aPL)", points: 5 },
        ],
      },
      {
        title: "D4 - Ostetrico",
        type: "radio",
        groupKey: "d4_obst",
        options: [
          { value: "none", label: "Nessuno", points: 0 },
          { value: "early_loss", label: "≥3 perdite consecutive pre-fetali (<10w) e/o early fetal (10–15w 6/7)", points: 1 },
          { value: "fetal_death", label: "Morte fetale (16–33w 6/7) senza preeclampsia o insufficienza placentare", points: 1 },
          { value: "pe_severe", label: "Preeclampsia severa O insufficienza placentare severa <34w (con/senza morte fetale)", points: 3 },
          { value: "pe_pi", label: "Preeclampsia severa AND insufficienza placentare severa <34w (con/senza morte fetale)", points: 4 },
        ],
      },
      {
        title: "D5 - Valvulopatia cardiaca",
        type: "radio",
        groupKey: "d5_valve",
        options: [
          { value: "none", label: "Nessuna", points: 0 },
          { value: "thickening", label: "Ispessimento valvolare", points: 2 },
          { value: "vegetation", label: "Vegetazione (endocardite di Libman-Sacks)", points: 4 },
        ],
      },
      {
        title: "D6 - Ematologico",
        type: "check",
        items: [
          { key: "d6_thrombocytopenia", label: "Trombocitopenia (piastrine 20–130 × 10⁹/L) attribuibile ad APS", points: 2 },
        ],
      },
      {
        title: "D7 - LA (Lupus Anticoagulant) - dosaggio funzionale",
        type: "radio",
        groupKey: "d7_la",
        options: [
          { value: "none", label: "Negativo", points: 0 },
          { value: "single", label: "Positivo singolo (una sola occasione)", points: 1 },
          { value: "persistent", label: "Persistentemente positivo (≥2 occasioni a distanza ≥12 settimane)", points: 5 },
        ],
      },
      {
        title: "D8 - aPL su fase solida (aCL/aβ2GPI ELISA, isotipi IgG/IgM)",
        type: "radio",
        groupKey: "d8_solid",
        options: [
          { value: "none", label: "Negativo", points: 0 },
          { value: "mod_igm", label: "Moderato-alto positivo IgM (aCL o aβ2GPI ≥40 unità)", points: 1 },
          { value: "mod_igg", label: "Moderato positivo IgG aCL OR aβ2GPI (40–79 unità)", points: 4 },
          { value: "high_igg_single", label: "Alto positivo IgG aCL OR aβ2GPI (≥80 unità) - singolo test", points: 5 },
          { value: "high_igg_both", label: "Alto positivo IgG aCL AND aβ2GPI (≥80 unità entrambi)", points: 7 },
        ],
      },
    ],
    threshold: { value: 6, label: "Soddisfatti i criteri APS (verificare ≥3 clinici E ≥3 laboratorio)" },
    note:
      "ATTENZIONE: la classificazione richiede ≥3 punti nel dominio CLINICO (D1–D6) E SEPARATAMENTE ≥3 punti nel dominio LABORATORIO (D7–D8). Il punteggio totale ≥6 è solo indicativo: verifica manualmente che entrambi i sotto-domini raggiungano ≥3. Ogni dominio contribuisce con il valore più alto raggiunto nel suo gruppo (nessuna sommatoria intra-dominio).",
  },

  // ============ GCA - ACR/EULAR 2022 (Ponte) ============
  {
    id: "acr_eular_2022_gca",
    name: "Arterite Gigantocellulare (GCA)",
    disease: "Vasculiti grandi vasi",
    source: "ACR/EULAR 2022 (Ponte)",
    intro:
      "Criteri di classificazione 2022 (Ponte et al.). REQUISITI ASSOLUTI (entry): età ≥50 anni alla diagnosi E evidenza di vasculite dei medi/grandi vasi tramite imaging (US/MRI/PET/angio-TC) o istologia, con esclusione dei mimics. Soglia per classificazione: ≥6 punti.",
    sections: [
      {
        title: "Requisiti assoluti (entry, obbligatori)",
        type: "check",
        items: [
          { key: "entry_age50", label: "Età ≥50 anni alla diagnosi", points: 0 },
          { key: "entry_imaging", label: "Vasculite di medi/grandi vasi confermata (imaging o biopsia)", points: 0 },
          { key: "entry_mimics", label: "Esclusi i mimics (infezioni, neoplasie, altre vasculiti)", points: 0 },
        ],
      },
      {
        title: "Criteri clinici aggiuntivi",
        type: "check",
        items: [
          { key: "morning_stiffness", label: "Rigidità mattutina di spalle/collo", points: 2 },
          { key: "visual_loss", label: "Perdita visiva improvvisa", points: 3 },
          { key: "jaw_claudication", label: "Claudicatio mandibolare o linguale", points: 2 },
          { key: "new_headache", label: "Cefalea temporale di nuova insorgenza", points: 2 },
          { key: "scalp_tenderness", label: "Dolore al cuoio capelluto", points: 2 },
          { key: "abnormal_temporal", label: "Esame anomalo dell'arteria temporale (assenza polso, dolorabilità, indurimento)", points: 2 },
        ],
      },
      {
        title: "Laboratorio",
        type: "radio",
        groupKey: "lab_inflam",
        options: [
          { value: "none", label: "VES <50 mm/h E PCR <10 mg/L", points: 0 },
          { value: "high", label: "Massima VES ≥50 mm/h O PCR ≥10 mg/L", points: 3 },
        ],
      },
      {
        title: "Imaging / Istologia",
        type: "check",
        items: [
          { key: "biopsy_pos", label: "Biopsia arteria temporale positiva (vasculite) o halo sign all'eco color-Doppler", points: 5 },
          { key: "bilateral_axillary", label: "Coinvolgimento ascellare bilaterale (US/MRI/PET/CTA)", points: 2 },
          { key: "fdg_aorta", label: "Captazione FDG-PET aortica", points: 2 },
        ],
      },
    ],
    threshold: { value: 6, label: "Soddisfatti i criteri GCA" },
    note: "I requisiti di entry sono OBBLIGATORI; senza di essi i criteri non sono applicabili anche se score ≥6. AUC 0.91, sensibilità 87%, specificità 95% nella validazione.",
  },

  // ============ Takayasu - ACR/EULAR 2022 (Grayson) ============
  {
    id: "acr_eular_2022_tak",
    name: "Arterite di Takayasu (TAK)",
    disease: "Vasculiti grandi vasi",
    source: "ACR/EULAR 2022 (Grayson)",
    intro:
      "Criteri di classificazione 2022 (Grayson et al.). REQUISITI ASSOLUTI (entry): età ≤60 anni alla diagnosi E imaging dimostrante vasculite dei grandi vasi (angio-TC, MRA, PET, angiografia convenzionale o ecografia). Soglia per classificazione: ≥5 punti.",
    sections: [
      {
        title: "Requisiti assoluti (entry, obbligatori)",
        type: "check",
        items: [
          { key: "entry_age60", label: "Età ≤60 anni alla diagnosi", points: 0 },
          { key: "entry_imaging", label: "Imaging compatibile con vasculite dei grandi vasi", points: 0 },
        ],
      },
      {
        title: "Criteri clinici",
        type: "check",
        items: [
          { key: "female", label: "Sesso femminile", points: 1 },
          { key: "angina", label: "Angina (dolore toracico ischemico)", points: 2 },
          { key: "limb_claudication", label: "Claudicatio degli arti", points: 2 },
          { key: "bruit", label: "Soffio arterioso", points: 2 },
          { key: "reduced_upper_pulse", label: "Riduzione del polso di un arto superiore", points: 2 },
          { key: "carotid_pulse", label: "Riduzione del polso o dolorabilità di una carotide", points: 2 },
          { key: "bp_diff", label: "Differenza pressoria ≥20 mmHg tra le braccia", points: 1 },
        ],
      },
      {
        title: "Imaging - territori arteriosi coinvolti",
        type: "radio",
        groupKey: "imaging_territories",
        options: [
          { value: "none", label: "Nessun territorio coinvolto", points: 0 },
          { value: "one", label: "1 territorio arterioso coinvolto", points: 1 },
          { value: "two", label: "2 territori arteriosi coinvolti", points: 2 },
          { value: "three", label: "≥3 territori arteriosi coinvolti", points: 3 },
        ],
      },
      {
        title: "Imaging - pattern aggiuntivi",
        type: "check",
        items: [
          { key: "paired_artery", label: "Coinvolgimento di arteria pari (es. entrambe le succlavie/carotidi)", points: 1 },
          { key: "aorta_renal_mes", label: "Coinvolgimento aorta addominale + arteria renale o mesenterica", points: 3 },
        ],
      },
    ],
    threshold: { value: 5, label: "Soddisfatti i criteri TAK" },
    note: "I requisiti di entry sono OBBLIGATORI. AUC 0.97, sensibilità 93.8%, specificità 99.2% nella validazione.",
  },

  // ============ IPAF — Fischer 2015 (ATS/ERS) ============
  {
    id: "ipaf_2015_fischer",
    name: "IPAF (Interstitial Pneumonia with Autoimmune Features)",
    disease: "IPAF / ILD",
    source: "Fischer et al. — ATS/ERS Research Statement, 2015",
    intro:
      "I criteri IPAF identificano pazienti con polmonite interstiziale che presentano caratteristiche suggestive di malattia autoimmune ma che NON soddisfano i criteri di una connettivite definita. Requisiti obbligatori: (1) presenza di polmonite interstiziale documentata da HRCT o biopsia chirurgica, (2) esclusione di eziologie alternative, (3) assenza di criteri per CTD definita. In aggiunta, è richiesto almeno UN elemento da almeno DUE dei tre domini (Clinico, Sierologico, Morfologico).",
    sections: [
      {
        title: "Requisiti obbligatori (TUTTI E TRE devono essere soddisfatti)",
        type: "check",
        groupKey: "mandatory",
        items: [
          { key: "iip_documented", label: "Polmonite interstiziale documentata (HRCT o biopsia chirurgica polmonare)", points: 1 },
          { key: "exclusion_alt", label: "Esclusione di eziologie alternative (pneumoconiosi, farmaci, esposizioni, infezioni, etc.)", points: 1 },
          { key: "no_ctd_criteria", label: "NON soddisfa i criteri classificativi di una CTD definita (AR, LES, SSc, miosite, Sjögren, MCTD)", points: 1 },
        ],
      },
      {
        title: "DOMINIO CLINICO (almeno 1 elemento)",
        type: "check",
        groupKey: "clinical",
        items: [
          { key: "distal_fissuring", label: "Fissurazioni cutanee distali delle dita (mani da meccanico)", points: 1 },
          { key: "digital_ulceration", label: "Ulcerazione del polpastrello", points: 1 },
          { key: "inflammatory_arthritis", label: "Artrite infiammatoria o stiffness mattutina poliarticolare ≥60 minuti", points: 1 },
          { key: "palmar_telangiectasia", label: "Teleangectasie palmari", points: 1 },
          { key: "raynaud", label: "Fenomeno di Raynaud", points: 1 },
          { key: "edema_unexplained", label: "Edema digitale inspiegato", points: 1 },
          { key: "gottron_fixed_rash", label: "Rash fisso sulla superficie estensoria delle dita (segno di Gottron)", points: 1 },
        ],
      },
      {
        title: "DOMINIO SIEROLOGICO (almeno 1 elemento)",
        type: "check",
        groupKey: "serologic",
        items: [
          { key: "ana_high_titer", label: "ANA ≥1:320, qualsiasi pattern (IFI su HEp-2)", points: 1 },
          { key: "ana_nucleolar", label: "ANA con pattern nucleolare (a qualsiasi titolo)", points: 1 },
          { key: "ana_centromere", label: "ANA con pattern centromerico (a qualsiasi titolo)", points: 1 },
          { key: "rf_2x_uln", label: "Fattore reumatoide ≥2× ULN", points: 1 },
          { key: "anti_ccp", label: "Anti-CCP positivi", points: 1 },
          { key: "anti_dsdna", label: "Anti-dsDNA positivi (titolo significativo)", points: 1 },
          { key: "anti_ro_ssa", label: "Anti-Ro/SSA (52 o 60 kDa) positivi", points: 1 },
          { key: "anti_la_ssb", label: "Anti-La/SSB positivi", points: 1 },
          { key: "anti_rnp", label: "Anti-RNP positivi", points: 1 },
          { key: "anti_smith", label: "Anti-Smith positivi", points: 1 },
          { key: "anti_topo1", label: "Anti-topoisomerasi I (Scl-70) positivi", points: 1 },
          { key: "anti_synthetase", label: "Anticorpi anti-tRNA-sintetasi (Jo-1, PL-7, PL-12, EJ, OJ, KS, Zo, tRS)", points: 1 },
          { key: "anti_pmscl", label: "Anti-PM-Scl positivi", points: 1 },
          { key: "anti_mda5", label: "Anti-MDA5 positivi", points: 1 },
        ],
      },
      {
        title: "DOMINIO MORFOLOGICO (almeno 1 elemento)",
        type: "check",
        groupKey: "morphologic",
        items: [
          { key: "hrct_nsip", label: "HRCT: pattern NSIP", points: 1 },
          { key: "hrct_op", label: "HRCT: pattern OP (organizing pneumonia)", points: 1 },
          { key: "hrct_nsip_op", label: "HRCT: pattern overlap NSIP + OP", points: 1 },
          { key: "hrct_lip", label: "HRCT: pattern LIP (lymphocytic interstitial pneumonia)", points: 1 },
          { key: "histo_nsip", label: "Istologia: pattern NSIP", points: 1 },
          { key: "histo_op", label: "Istologia: pattern OP", points: 1 },
          { key: "histo_nsip_op", label: "Istologia: pattern overlap NSIP-OP", points: 1 },
          { key: "histo_lip", label: "Istologia: pattern LIP", points: 1 },
          { key: "histo_lymphoid_aggregates", label: "Istologia: aggregati linfoidi interstiziali con centri germinativi", points: 1 },
          { key: "histo_lymphoplasm_infiltration", label: "Istologia: infiltrazione linfoplasmacellulare diffusa (con o senza follicoli)", points: 1 },
          { key: "multi_pleural", label: "Multi-compartimentale: versamento o ispessimento pleurico inspiegato", points: 1 },
          { key: "multi_pericardial", label: "Multi-compartimentale: versamento o ispessimento pericardico inspiegato", points: 1 },
          { key: "multi_airway", label: "Multi-compartimentale: malattia intrinseca delle vie aeree inspiegata (PFR ostruttive, bronchiolite, bronchiectasie)", points: 1 },
          { key: "multi_vasculopathy", label: "Multi-compartimentale: vasculopatia polmonare inspiegata", points: 1 },
        ],
      },
    ],
    threshold: { value: 5, label: "Soddisfatti i criteri IPAF (3 obbligatori + ≥1 elemento in ≥2 domini)" },
    note: "Lo score numerico è solo orientativo. La classificazione IPAF richiede TUTTI E TRE i requisiti obbligatori (IIP documentata, esclusione di alternative, assenza di CTD definita) E almeno UN elemento da almeno DUE dei tre domini (Clinico, Sierologico, Morfologico). Verifica manualmente la copertura dei domini prima di classificare il paziente. Riferimento: Fischer A et al. Eur Respir J 2015;46(4):976-87.",
  },

  // ============ Artropatia da emocromatosi — EULAR 2025 ============
  {
    id: "haemochromatosis_arthropathy_2025",
    name: "Artropatia da emocromatosi (EULAR 2025)",
    disease: "Artropatia da emocromatosi",
    source: "Kiely PDW et al. — EULAR 2025 Classification Criteria, Ann Rheum Dis 2026;85(2):238-245",
    intro:
      "Primi criteri classificativi EULAR per l'artropatia da emocromatosi (HA). Si applicano a pazienti con OMOZIGOSI HFE C282Y, dolore articolare e sovraccarico di ferro documentato. Score ≥5/11 punti su almeno 3 criteri = classificazione (sensibilità 71,4%, specificità 93,3%). Distingue HA da osteoartrosi e CPPD.",
    sections: [
      {
        title: "Requisiti di entry obbligatori (TUTTI E TRE)",
        type: "check",
        groupKey: "entry",
        items: [
          { key: "hfe_c282y_homozygous", label: "Omozigosi HFE C282Y", points: 1 },
          { key: "joint_pain", label: "Dolore articolare", points: 1 },
          { key: "iron_overload", label: "Evidenza di sovraccarico di ferro (ferritina, saturazione transferrina, biopsia/RMN epatica)", points: 1 },
        ],
      },
      {
        title: "Età all'esordio dei sintomi articolari",
        type: "radio",
        groupKey: "age_onset",
        options: [
          { value: "lt40", label: "<40 anni", points: 0 },
          { value: "40_50", label: "40-50 anni", points: 1 },
          { value: "gt50", label: ">50 anni", points: 2 },
        ],
      },
      {
        title: "Caratteristiche cliniche",
        type: "check",
        groupKey: "clinical",
        items: [
          { key: "mcp_clinical", label: "Coinvolgimento clinico delle articolazioni MCP (in particolare MCP 2 e 3): tumefazione, dolorabilità o limitazione funzionale", points: 1 },
          { key: "dip_clinical", label: "Coinvolgimento clinico delle articolazioni DIP", points: 1 },
          { key: "ankle_clinical", label: "Coinvolgimento clinico della caviglia (tumefazione, dolorabilità o limitazione)", points: 1 },
        ],
      },
      {
        title: "Caratteristiche radiografiche",
        type: "check",
        groupKey: "radiographic",
        items: [
          { key: "mcp_hook_osteophytes", label: "Osteofiti uncinati (\"hook osteophytes\") a MCP 2, 3 o caviglia", points: 2 },
          { key: "dip_radiographic", label: "Alterazioni radiografiche alle DIP (riduzione spazio articolare, osteofiti, sclerosi subcondrale)", points: 1 },
          { key: "ankle_radiographic", label: "Alterazioni radiografiche alla caviglia", points: 1 },
        ],
      },
      {
        title: "Storia di chirurgia",
        type: "check",
        groupKey: "surgery",
        items: [
          { key: "hip_ankle_surgery", label: "Storia di intervento chirurgico ad anca o caviglia (artroprotesi, artrodesi)", points: 2 },
        ],
      },
    ],
    threshold: { value: 5, label: "Soddisfatti i criteri EULAR 2025 di artropatia da emocromatosi" },
    note: "I requisiti di entry sono OBBLIGATORI. La classificazione richiede ≥5 punti su 11 con almeno 3 criteri positivi tra quelli scoring. Sensibilità 71,4%, specificità 93,3%.",
  },

  // ============ EULAR/ACR Risk Stratification Criteria for RA in Arthralgia (2025) ============
  {
    id: "eular_acr_ra_risk_arthralgia_2025",
    name: "Stratificazione del rischio di AR in fase di artralgia (EULAR/ACR 2025)",
    disease: "AR — fase a rischio",
    source: "EULAR/ACR 2025 — Ann Rheum Dis 2025; van Steenbergen HW et al.",
    intro:
      "Modello di stratificazione del rischio per identificare pazienti con artralgia (in particolare CSA — Clinically Suspect Arthralgia) a rischio di sviluppare artrite infiammatoria/AR entro 12 mesi. NON diagnostica AR ma stratifica il rischio. Cutoff orientativo: >10 punti = rischio alto. AUC 0.80 (clinico+sierologico) → 0.93 (con RMN). Modello validato su 2293 pazienti.",
    sections: [
      {
        title: "Variabili cliniche",
        type: "radio",
        groupKey: "morning_stiffness",
        options: [
          { value: "none", label: "Rigidità mattutina assente o <30 min", points: 0 },
          { value: "30_60", label: "Rigidità mattutina 30-60 min", points: 2 },
          { value: "gt60", label: "Rigidità mattutina >60 min", points: 4 },
        ],
      },
      {
        title: "Sintomi riferiti dal paziente",
        type: "check",
        groupKey: "patient_symptoms",
        items: [
          { key: "patient_swelling", label: "Tumefazione articolare riferita dal paziente", points: 4 },
          { key: "difficulty_fist", label: "Difficoltà a chiudere il pugno", points: 5 },
        ],
      },
      {
        title: "Markers infiammatori",
        type: "check",
        groupKey: "inflammation",
        items: [
          { key: "crp_elevated", label: "PCR elevata", points: 1 },
        ],
      },
      {
        title: "Fattore reumatoide (FR)",
        type: "radio",
        groupKey: "rf",
        options: [
          { value: "negative", label: "FR negativo", points: 0 },
          { value: "low", label: "FR positivo a basso titolo (≤3× ULN)", points: 2 },
          { value: "high", label: "FR positivo a titolo alto (>3× ULN)", points: 4 },
        ],
      },
      {
        title: "Anticorpi anti-CCP / ACPA",
        type: "radio",
        groupKey: "acpa",
        options: [
          { value: "negative", label: "ACPA negativi", points: 0 },
          { value: "low", label: "ACPA positivi a basso titolo (≤3× ULN)", points: 4 },
          { value: "high", label: "ACPA positivi a titolo alto (>3× ULN)", points: 8 },
        ],
      },
      {
        title: "Imaging (modello esteso, opzionale)",
        type: "check",
        groupKey: "imaging",
        items: [
          { key: "mri_tenosynovitis", label: "RMN: tenosinovite dei flessori e/o estensori del polso", points: 2 },
          { key: "mri_subclinical_inflammation", label: "RMN: altre evidenze di infiammazione subclinica (sinovite, osteite)", points: 2 },
        ],
      },
    ],
    threshold: { value: 10, label: "Rischio elevato di sviluppare AR entro 12 mesi (cutoff orientativo >10)" },
    note: "I criteri NON diagnosticano AR — stratificano solo il rischio di progressione in fase di artralgia. Cutoff >10 punti: sensibilità e specificità >75% nel modello esteso con RMN. La diagnosi di AR è clinica e basata sui criteri ACR/EULAR 2010. Considera invio precoce al reumatologo per i pazienti con punteggi elevati.",
  },

  // ============ Hand Osteoarthritis — EULAR 2023 ============
  {
    id: "hand_oa_eular_2023",
    name: "Osteoartrosi della mano (EULAR 2023)",
    disease: "Osteoartrosi",
    source: "Haugen IK, Kloppenburg M et al. — Ann Rheum Dis 2024;83(11):1428-1435",
    intro:
      "Criteri classificativi EULAR 2023 per l'osteoartrosi della mano. Score 0-15. Cutoff: ≥9 OA mano in generale, ≥8 OA interfalangea, ≥8 OA della base del pollice. Articolazioni target: DIP 2-5 bilaterali, PIP 2-5 bilaterali, IP1 (interfalangea pollice), CMC1 (base pollice).",
    sections: [
      {
        title: "Requisiti di entry obbligatori (ENTRAMBI)",
        type: "check",
        groupKey: "entry",
        items: [
          { key: "symptoms_target_joint", label: "Dolore, dolorabilità e/o rigidità in almeno UNA articolazione target nella maggior parte dei giorni delle ultime 6 settimane (DIP 2-5, PIP 2-5, IP1, CMC1 bilaterali)", points: 1 },
          { key: "exclusion_alt", label: "Sintomi NON meglio spiegati da altra patologia (artropatie da cristalli, malattie infiammatorie sistemiche, traumi acuti, condizioni non infiammatorie). Cautela in pazienti con psoriasi (DD con AP).", points: 1 },
        ],
      },
      {
        title: "Età",
        type: "radio",
        groupKey: "age",
        options: [
          { value: "lt45", label: "<45 anni", points: 0 },
          { value: "45_54", label: "45-54 anni", points: 1 },
          { value: "55_64", label: "55-64 anni", points: 2 },
          { value: "ge65", label: "≥65 anni", points: 3 },
        ],
      },
      {
        title: "Rigidità mattutina",
        type: "radio",
        groupKey: "morning_stiffness",
        options: [
          { value: "none", label: "Assente", points: 1 },
          { value: "le30", label: "≤30 minuti", points: 2 },
          { value: "gt30", label: ">30 minuti", points: 0 },
        ],
      },
      {
        title: "Articolazioni con osteofiti (radiografia)",
        type: "radio",
        groupKey: "osteophytes",
        options: [
          { value: "0", label: "Nessuna", points: 0 },
          { value: "1_2", label: "1-2 articolazioni", points: 2 },
          { value: "3_5", label: "3-5 articolazioni", points: 3 },
          { value: "ge6", label: "≥6 articolazioni", points: 4 },
        ],
      },
      {
        title: "Articolazioni con riduzione dello spazio articolare (JSN, radiografia)",
        type: "radio",
        groupKey: "jsn",
        options: [
          { value: "0", label: "Nessuna", points: 0 },
          { value: "1_2", label: "1-2 articolazioni", points: 1 },
          { value: "3_5", label: "3-5 articolazioni", points: 2 },
          { value: "ge6", label: "≥6 articolazioni", points: 3 },
        ],
      },
      {
        title: "Concordanza sintomi-struttura",
        type: "radio",
        groupKey: "concordance",
        options: [
          { value: "no", label: "No (osteofiti/JSN presenti in <50% delle articolazioni dolorose)", points: 0 },
          { value: "yes", label: "Sì (osteofiti o JSN presenti in ≥50% delle articolazioni dolorose nelle ultime 6 settimane)", points: 3 },
        ],
      },
    ],
    threshold: { value: 9, label: "Soddisfatti i criteri di OA della mano (≥9/15)" },
    note: "Cutoff specifici per sottotipi: ≥9 per OA della mano in generale, ≥8 per OA interfalangea (DIP/PIP/IP1), ≥8 per OA della base del pollice (CMC1). Articolazioni target: DIP 2-5, PIP 2-5, IP1, CMC1 (bilaterali). Sensibilità/specificità ottimizzate per popolazioni di studio. Verifica i requisiti di entry obbligatori.",
  },
];

export const CRITERIA_GROUPS = [
  "Artrite Reumatoide",
  "Artrite Psoriasica",
  "Spondiloartrite",
  "LES",
  "Sjögren",
  "Sclerosi Sistemica",
  "Gotta",
  "PMR",
  "Vasculiti ANCA",
  "AOSD",
  "Miositi",
  "Fibromialgia",
  "Behçet",
  "IgG4-RD",
  "APS",
  "Vasculiti grandi vasi",
  "IPAF / ILD",
  "Artropatia da emocromatosi",
  "AR — fase a rischio",
  "Osteoartrosi",
];
