// Criteri classificativi delle malattie reumatiche.
// Ogni criterio ha:
//   id, name, disease, source, intro
//   sections: [{ title?, type: 'radio'|'check'|'list', items: [{ key, label, points, options? }] }]
//   threshold: { value, label } per la classificazione
//   note?: string

export const CRITERIA = [
  // ============ VEDOSS - Avouac 2011 / EUSTAR ============
  {
    id: "vedoss_2011",
    name: "VEDOSS (Sclerodermia molto precoce)",
    disease: "Sclerosi Sistemica",
    source: "Avouac/EUSTAR 2011",
    intro: "Identifica i pazienti a rischio di sviluppare SSc prima che soddisfino i criteri ACR/EULAR 2013. Richiede entrambi i criteri obbligatori (Raynaud + dita gonfie) PIÙ ≥1 criterio aggiuntivo.",
    sections: [
      {
        title: "Criteri obbligatori (entrambi necessari)",
        type: "check",
        items: [
          { key: "raynaud", label: "Fenomeno di Raynaud", points: 10 },
          { key: "puffy", label: "Dita gonfie (puffy fingers) / edema digitale", points: 10 },
        ],
      },
      {
        title: "Criteri aggiuntivi (≥1 necessario)",
        type: "check",
        items: [
          { key: "ana", label: "ANA positivi (titolo ≥1:160)", points: 1 },
          { key: "aca", label: "Anti-centromero positivi", points: 1 },
          { key: "scl70", label: "Anti-topoisomerasi I (Scl-70) positivi", points: 1 },
          { key: "rnap3", label: "Anti-RNA polimerasi III positivi", points: 1 },
          { key: "capillaroscopy_ssc", label: "Capillaroscopia: pattern sclerodermico (Early/Active/Late)", points: 1 },
        ],
      },
    ],
    threshold: { value: 21, label: "VEDOSS positivo (Raynaud + puffy fingers + ≥1 marker)" },
    note: "Verifica obbligatoriamente che siano presenti SIA Raynaud SIA dita gonfie. Lo score 21 si raggiunge solo con entrambi i criteri obbligatori + ≥1 aggiuntivo.",
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
];
