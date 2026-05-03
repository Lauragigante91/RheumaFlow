// Miscellanea reumatologica: tabelle di riferimento e iter diagnostici

export const MYOSITIS_ANTIBODIES = [
  { antibody: "Anti-Jo1", phenotype: "Antisintetasi", muscle: "✓ miosite classica", skin: "✓", lung: "✓✓ (frequente)", heart: "±", gi: "±", tumor: "✗", other: "Mani da meccanico, artrite" },
  { antibody: "Anti-PL7", phenotype: "Antisintetasi", muscle: "± (spesso lieve)", skin: "±", lung: "✓✓✓ (severa)", heart: "±", gi: "✗", tumor: "✗", other: "ILD dominante" },
  { antibody: "Anti-PL12", phenotype: "Antisintetasi", muscle: "± (spesso assente)", skin: "±", lung: "✓✓✓ (isolata possibile)", heart: "✗", gi: "✗", tumor: "✗", other: "ILD isolata possibile" },
  { antibody: "Anti-EJ", phenotype: "Antisintetasi", muscle: "✓", skin: "±", lung: "✓✓", heart: "✗", gi: "✗", tumor: "✗", other: "Artrite" },
  { antibody: "Anti-OJ", phenotype: "Antisintetasi", muscle: "✓", skin: "±", lung: "✓✓", heart: "✗", gi: "✗", tumor: "✗", other: "Fenotipo classico" },
  { antibody: "Anti-Mi-2", phenotype: "Dermatomiosite classica", muscle: "✓✓", skin: "✓✓✓", lung: "✗ (raro)", heart: "✗", gi: "✗", tumor: "✗", other: "Ottima prognosi" },
  { antibody: "Anti-TIF1-γ", phenotype: "Dermatomiosite paraneoplastica", muscle: "✓", skin: "✓✓✓", lung: "✗", heart: "✗", gi: "✗", tumor: "✓✓✓", other: "Rash severo - screening neoplasia!" },
  { antibody: "Anti-NXP2", phenotype: "Dermatomiosite", muscle: "✓✓ (severa)", skin: "✓", lung: "±", heart: "±", gi: "✓ (disfagia)", tumor: "✓ (adulti)", other: "Calcinosi" },
  { antibody: "Anti-MDA5", phenotype: "DM amiopatica", muscle: "✗ o lieve", skin: "✓✓", lung: "✓✓✓ (RP-ILD)", heart: "✗", gi: "✗", tumor: "✗", other: "Ulcere, rash, prognosi severa" },
  { antibody: "Anti-SAE", phenotype: "Dermatomiosite", muscle: "✓ (tardiva)", skin: "✓✓", lung: "±", heart: "✗", gi: "✓ (disfagia)", tumor: "±", other: "Rash precoce" },
  { antibody: "Anti-SRP", phenotype: "Miopatia necrotizzante", muscle: "✓✓✓", skin: "✗", lung: "✗", heart: "✓ (possibile)", gi: "✗", tumor: "✗", other: "CK molto alte" },
  { antibody: "Anti-HMGCR", phenotype: "Miopatia necrotizzante", muscle: "✓✓✓", skin: "✗", lung: "✗", heart: "✗", gi: "✗", tumor: "±", other: "Associazione con statine" },
  { antibody: "Anti-cN1A", phenotype: "Inclusion body myositis", muscle: "✓ (distale)", skin: "✗", lung: "✗", heart: "✗", gi: "✓ (disfagia)", tumor: "✗", other: "Debolezza asimmetrica" },
];

export const AUTOINFLAMMATORY_DISEASES = [
  { disease: "FMF", onset: "Infanzia", fever: "✓ alta", pattern: "1-3 gg", signs: "Sierositi (peritonite, pleurite)", skin: "Erisipeloide", organs: "Articolazioni, peritoneo", redflag: "Dolore addominale ricorrente", genetics: "MEFV, SAA" },
  { disease: "TRAPS", onset: "Infanzia", fever: "✓ prolungata", pattern: "1-3 settimane", signs: "Mialgie migranti, dolore profondo", skin: "Rash migrante", organs: "Occhio (edema periorbitale)", redflag: "Febbre lunga + dolore migrante", genetics: "TNFRSF1A" },
  { disease: "HIDS / MKD", onset: "Infanzia", fever: "✓ alta", pattern: "3-7 gg", signs: "Adenopatie, diarrea", skin: "Maculo-papulare", organs: "GI", redflag: "Febbre + linfonodi + diarrea", genetics: "MVK, IgD↑" },
  { disease: "FCAS (CAPS)", onset: "Infanzia", fever: "✓ lieve", pattern: "<24h", signs: "Trigger freddo", skin: "Orticarioide", organs: "Articolazioni", redflag: "Freddo → febbre breve", genetics: "NLRP3" },
  { disease: "MWS (CAPS)", onset: "Infanzia", fever: "✓ moderata", pattern: "Giorni", signs: "Ipoacusia progressiva", skin: "Orticarioide", organs: "Rene (amiloidosi)", redflag: "Perdita udito progressiva", genetics: "NLRP3" },
  { disease: "NOMID/CINCA (CAPS)", onset: "Neonatale", fever: "✓ persistente", pattern: "Continuo", signs: "Meningite cronica, artropatia", skin: "Orticarioide persistente", organs: "SNC, osso", redflag: "Rash neonatale + SNC", genetics: "NLRP3, RM/CSF" },
  { disease: "PFAPA", onset: "Infanzia", fever: "✓ alta", pattern: "Regolare (3-6 settimane)", signs: "Aftosi, faringite, adenite", skin: "✗", organs: "ORL", redflag: "Periodicità perfetta", genetics: "Clinico" },
  { disease: "AOSD (Still adulto)", onset: "Adulto", fever: "✓ elevata", pattern: "Quotidiana (quotidian spikes)", signs: "Rash salmonato, artrite", skin: "Evanescente color salmone", organs: "Fegato, milza", redflag: "Ferritina molto alta", genetics: "Ferritina↑↑, gly ferritina ↓" },
  { disease: "Behçet", onset: "Giovane adulto", fever: "±", pattern: "Recidivante", signs: "Aftosi orale/genitale", skin: "Pseudofollicolite", organs: "Occhi, SNC", redflag: "Uveite + aftosi", genetics: "HLA-B51" },
  { disease: "Schnitzler", onset: "Adulto", fever: "✓ cronica", pattern: "Persistente", signs: "Orticaria + gammopatia", skin: "Orticaria", organs: "Osso", redflag: "Orticaria + IgM monoclonale", genetics: "Elettroforesi" },
  { disease: "DIRA", onset: "Neonatale", fever: "✓", pattern: "Continuo", signs: "Pustole severe", skin: "Pustoloso", organs: "Osso", redflag: "Pustolosi neonatale", genetics: "IL1RN" },
  { disease: "PAPA", onset: "Infanzia", fever: "±", pattern: "Recidivante", signs: "Artrite sterile + acne", skin: "Acne severa", organs: "Cute", redflag: "Acne + artrite sterile", genetics: "PSTPIP1" },
  { disease: "VEXAS", onset: "Adulto (>50 aa, M)", fever: "✓ persistente", pattern: "Cronico", signs: "Condriti, vasculiti, citopenie", skin: "Dermatosi neutrofile", organs: "Midollo, cute, polmone", redflag: "Vacuoli mieloidi, MDS associata", genetics: "UBA1 somatica" },
];

export const ANA_PATTERNS = [
  { pattern: "Omogeneo", antibodies: "Anti-dsDNA, istoni", diseases: "LES, LES indotto da farmaci" },
  { pattern: "Speckled (fine/grossolano)", antibodies: "Anti-Sm, RNP, SSA, SSB, Scl-70", diseases: "LES, MCTD, Sjögren, SSc" },
  { pattern: "Nucleolare", antibodies: "Anti-RNAP III, U3-RNP, Th/To, PM-Scl", diseases: "SSc (soprattutto diffusa), overlap" },
  { pattern: "Centromerico", antibodies: "Anti-ACA (CENP-B)", diseases: "SSc limitata, CREST, CBP" },
  { pattern: "Nuclear dots", antibodies: "Anti-Sp100, PML", diseases: "Colangite biliare primitiva (CBP)" },
  { pattern: "Citoplasmatico", antibodies: "Anti-Jo1, Ribosomal P, Mi-2, mitocondriali", diseases: "Miositi, LES (ribosomal P), CBP" },
  { pattern: "NuMA", antibodies: "Anti-NuMA (anti-centrosoma)", diseases: "Sjögren, raro SSc" },
];

export const DIAGNOSTIC_ALGORITHMS = [
  {
    id: "iperckemia",
    name: "iperCKemia - iter diagnostico",
    category: "Algoritmi",
    intro: "Approccio sistematico all'iperCKemia, distinzione benigna vs patologica e identificazione di cause reumatologiche.",
    steps: [
      {
        title: "1. Conferma e ripetizione",
        items: [
          "Confermare con 2-3 dosaggi ripetuti a distanza (variabilità fisiologica).",
          "Riposo 5-7 giorni prima del dosaggio (evitare attività fisica intensa, traumi, EMG, iniezioni i.m.).",
          "Escludere cause benigne: esercizio fisico, fans, alcol, etnia (afrocaraibici), macro-CK.",
        ],
      },
      {
        title: "2. Valutazione clinica",
        items: [
          "Anamnesi: farmaci (statine, fibrati, steroidi, colchicina), familiarità (miopatie ereditarie), esordio, debolezza, mialgie, crampi, dolore post-sforzo.",
          "Esame obiettivo: debolezza prossimale vs distale, simmetrica/asimmetrica, segni cutanei (rash eliotropo, Gottron), segni sistemici.",
          "Red flags: disfagia, disfonia, insufficienza respiratoria, miocardite, rash.",
        ],
      },
      {
        title: "3. Esami di secondo livello",
        items: [
          "Emocromo, VES, PCR, funzione epato-renale, TSH (ipotiroidismo), elettroliti, vit D.",
          "Troponina I (distinguere danno muscolare vs cardiaco; troponina T può essere elevata in miopatie).",
          "Aldolasi, LDH, AST/ALT (profilo muscolare).",
          "Esame urine: mioglobinuria se CK >5000 U/L.",
          "Ferritina (iperferritinemia in AOSD, HLH, miositi severe).",
        ],
      },
      {
        title: "4. Screening autoimmune (se sospetto miosite)",
        items: [
          "ANA + panel miosite-specifici (Jo-1, PL-7, PL-12, EJ, OJ, Mi-2, TIF1-γ, NXP2, MDA5, SAE, SRP, HMGCR, cN1A).",
          "Anticorpi miosite-associati: Ro/SSA (52/60 kDa), PM-Scl, Ku, U1-RNP.",
          "Capillaroscopia (pattern SSc in overlap).",
        ],
      },
      {
        title: "5. Esami strumentali",
        items: [
          "EMG-ENG: pattern miopatico (MUAP brevi, polifasici, attività spontanea).",
          "RM muscolare (cosce): edema (STIR), atrofia, sostituzione adiposa; utile per guidare biopsia.",
          "Biopsia muscolare se diagnosi incerta: infiltrato infiammatorio, necrosi, atrofia perifascicolare (DM), vacuoli orlati (IBM).",
        ],
      },
      {
        title: "6. Diagnosi differenziale",
        items: [
          "Miopatie infiammatorie: DM, PM, IMNM, ASS, IBM, overlap.",
          "Miopatie da farmaci: statine (anti-HMGCR), colchicina, GC (senza CK↑), fibrati.",
          "Endocrine: ipotiroidismo, Cushing, iperparatiroidismo.",
          "Metaboliche: glicogenosi (McArdle), disturbi mitocondriali, deficit CPT2.",
          "Genetiche: distrofie muscolari, canalopatie.",
          "Rabdomiolisi acuta: trauma, infezioni, drugs of abuse.",
        ],
      },
      {
        title: "Red flags - ricovero urgente",
        items: [
          "CK >10.000 U/L con rabdomiolisi, AKI, iperkaliemia.",
          "Insufficienza respiratoria (coinvolgimento muscoli respiratori/diaframma).",
          "Disfagia severa con rischio ab ingestis.",
          "Miocardite (troponina I elevata, sintomi cardiaci).",
        ],
      },
    ],
  },
  {
    id: "aftosi_orale_ricorrente",
    name: "Aftosi orale ricorrente - iter diagnostico",
    category: "Algoritmi",
    intro: "Valutazione sistematica dell'aftosi orale ricorrente (>3 episodi/anno), distinzione benigna vs sistemica.",
    steps: [
      {
        title: "1. Caratterizzazione clinica",
        items: [
          "Numero, dimensioni e morfologia: minor (<1 cm, guarigione <14 gg, senza cicatrice), major (>1 cm, profonde, cicatrizzanti), herpetiformi (multiple piccole).",
          "Sede: solo orale vs oro-genitale (Behçet).",
          "Frequenza, durata, fattori scatenanti (stress, ciclo mestruale, alimenti).",
          "Sintomi sistemici associati: febbre, artralgie, uveite, lesioni cutanee, GI.",
        ],
      },
      {
        title: "2. Escludere cause locali",
        items: [
          "Trauma meccanico cronico (dentizione, protesi).",
          "Deficit carenziali: vit B12, folati, ferro, zinco.",
          "Intolleranze alimentari (glutine, lattosio, nickel).",
          "Infezioni: HSV (coltura, PCR), HIV, sifilide, candidosi.",
        ],
      },
      {
        title: "3. Screening nutrizionale",
        items: [
          "Emocromo con MCV, ferritina, sideremia, transferrina.",
          "Vit B12, folati, vit D, zinco.",
          "Anti-transglutaminasi IgA + IgA totali (celiachia).",
        ],
      },
      {
        title: "4. Screening autoimmune e sistemico",
        items: [
          "ANA, ENA panel, ANCA, HLA-B51 (Behçet), HLA-B27 (spondiloartriti).",
          "Immunoglobuline (deficit IgA può associarsi ad aftosi).",
          "Patergy test (Behçet): puntura con ago sterile → lesione pustolare >48h = positivo.",
          "Valutazione oftalmologica (uveite subclinica).",
        ],
      },
      {
        title: "5. Valutazione GI",
        items: [
          "MICI (Crohn, RCU): calprotectina fecale, colonscopia se sospetto.",
          "Celiachia: sierologia + eventuale biopsia duodenale.",
          "Sindrome di Behçet con coinvolgimento intestinale.",
        ],
      },
      {
        title: "6. Diagnosi differenziale principale",
        items: [
          "RAS (recurrent aphthous stomatitis) - diagnosi di esclusione.",
          "Malattia di Behçet (aftosi orale + ≥2 di: aftosi genitale, uveite, lesioni cutanee, patergy+).",
          "PFAPA (nei bambini): periodico + faringite + adenite.",
          "MICI: Crohn soprattutto.",
          "Lupus (aftosi palatale non dolente spesso).",
          "Sindrome di MAGIC (mouth and genital ulcers with inflamed cartilage - overlap Behçet + policondrite).",
          "Deficit di IgA o altre immunodeficienze.",
          "Ciclica/neutropenica: neutropenia ciclica.",
        ],
      },
      {
        title: "Criteri ICBD 2014 Behçet (accessibili dalla pagina Criteri)",
        items: [
          "Aftosi orale (OBBLIGATORIA, 2 punti), aftosi genitale (2), lesioni oculari (2), lesioni cutanee (1), manifestazioni neurologiche (1), manifestazioni vascolari (1), patergy test + (1). Soglia ≥4.",
        ],
      },
    ],
  },
  {
    id: "eritema_nodoso",
    name: "Eritema nodoso - iter diagnostico",
    category: "Algoritmi",
    intro: "Pannicolite settale classica. L'eritema nodoso è una REAZIONE cutanea, quasi sempre secondaria: la priorità è identificare la causa.",
    steps: [
      {
        title: "1. Conferma diagnostica",
        items: [
          "Clinica: noduli eritematosi dolenti, caldi, regioni pretibiali (tipicamente bilaterali simmetrici), 1-5 cm, non ulcerativi.",
          "Evoluzione: fase evolutiva simile ad ematoma (rosso → giallo-verde → bruno), risoluzione senza cicatrice in 4-8 settimane.",
          "Accompagnato da febbricola, artralgie, malessere generale.",
          "Biopsia solo se atipico: mostra pannicolite SETTALE senza vasculite.",
        ],
      },
      {
        title: "2. Cause principali da escludere",
        items: [
          "Infezioni: streptococco β-emolitico A (faringite recente, ASLO), TBC (IGRA, Rx torace), Yersinia (coprocoltura), Mycoplasma, Chlamydia, virus (EBV, HCV, HIV).",
          "Sarcoidosi: linfoadenopatie ilari bilaterali + EN + artralgie = Sindrome di Löfgren.",
          "MICI: sospettare se sintomi GI, calprotectina fecale, colonscopia.",
          "Farmaci: estroprogestinici, antibiotici (sulfamidici, penicilline), FANS, JAK-i.",
          "Gravidanza.",
          "Vasculiti / altre malattie autoimmuni: Behçet, AR, LES.",
          "Neoplasie (raro): linfomi, leucemie.",
          "Idiopatica (~30-50% dei casi).",
        ],
      },
      {
        title: "3. Esami di primo livello",
        items: [
          "Emocromo, VES, PCR (elevate).",
          "Tampone faringeo + ASLO (streptococco).",
          "Rx torace (adenopatie ilari - sarcoidosi, TBC primaria).",
          "IGRA (Quantiferon) o test di Mantoux per TBC.",
          "Funzione epato-renale, elettroliti.",
          "β-hCG in donne in età fertile.",
        ],
      },
      {
        title: "4. Esami di secondo livello (in base al sospetto)",
        items: [
          "ACE sierico, lisozima, calcemia, calciuria 24h (sarcoidosi).",
          "HRCT torace ad alta risoluzione se Rx dubbia.",
          "Coprocoltura + ricerca Yersinia (se sintomi GI).",
          "Sierologie: EBV, CMV, HCV, HIV, sifilide, Mycoplasma.",
          "ANA, ENA, ANCA se sospetto autoimmune.",
          "Calprotectina fecale, colonscopia se sospetto MICI.",
          "HLA-B51, patergy test se sospetto Behçet.",
        ],
      },
      {
        title: "5. Sindrome di Löfgren",
        items: [
          "Triade: eritema nodoso + adenopatie ilari bilaterali + poliartrite migrante delle caviglie.",
          "Patognomonica di sarcoidosi acuta.",
          "Ottima prognosi: risoluzione spontanea in 6-24 mesi in >80% dei casi.",
          "Non sempre necessita biopsia se presentazione tipica.",
        ],
      },
      {
        title: "6. Trattamento",
        items: [
          "Riposo, elevazione arti inferiori, calze elastiche a compressione graduata.",
          "FANS (naprossene, indometacina) come prima scelta per dolore.",
          "Ioduro di potassio (300-900 mg/die): opzione storica, efficace.",
          "Colchicina 1 mg/die: efficace, specialmente in Behçet o recidivante.",
          "GC sistemici (prednisone 20-40 mg/die) in forme severe, refrattarie o associate a patologia sistemica che lo richieda.",
          "Trattamento eziologico della causa sottostante (antibiotici, immunosoppressori per MICI/sarcoidosi, ecc.).",
        ],
      },
    ],
  },
  {
    id: "raynaud",
    name: "Fenomeno di Raynaud - distinzione primario vs secondario",
    category: "Algoritmi",
    intro: "Algoritmo di valutazione per distinguere il Raynaud primario (benigno) dal secondario (spia di malattia autoimmune).",
    steps: [
      {
        title: "Caratteristiche del Raynaud PRIMARIO (Allen & Brown)",
        items: [
          "Esordio generalmente giovane (15-30 aa), sesso femminile.",
          "Simmetrico, bilaterale, senza necrosi/ulcere.",
          "Assenza di segni/sintomi di malattia sistemica.",
          "Capillaroscopia NORMALE.",
          "ANA negativi / titolo basso (<1:160 aspecifico).",
          "VES e PCR normali.",
          "Assenza di alterazioni vascolari periferiche.",
        ],
      },
      {
        title: "Red flags per Raynaud SECONDARIO",
        items: [
          "Esordio >30-40 anni (soprattutto uomini).",
          "Asimmetrico, monolaterale o solo agli arti superiori.",
          "Ulcere digitali, pitting scars, gangrena.",
          "Sintomi sistemici: artralgie, xerostomia, dispnea, disfagia, mialgie.",
          "Puffy fingers, sclerodattilia, telangiectasie.",
          "Capillaroscopia con pattern sclerodermico (early/active/late).",
          "ANA positivi (soprattutto ACA, Scl-70, RNAP III).",
          "VES o PCR elevate.",
        ],
      },
      {
        title: "Esami consigliati",
        items: [
          "Capillaroscopia periungueale (OBBLIGATORIA): distingue pattern normale/aspecifico vs SSc.",
          "ANA (IIF su HEp-2), ENA panel, ACA, Scl-70, RNAP III.",
          "Emocromo, VES, PCR, funzione tiroidea (ipotiroidismo può dare Raynaud secondario).",
          "Criogolbuline, FR, elettroforesi.",
          "Sospetto vasculopatia: ecografia arterie arti superiori, angio-RM se trombosi.",
        ],
      },
      {
        title: "Cause principali di Raynaud secondario",
        items: [
          "SSc (più frequente), VEDOSS.",
          "MCTD, LES, Sjögren.",
          "Miositi (soprattutto ASS).",
          "Vasculiti: Buerger (tromboangioite obliterante).",
          "Farmaci: β-bloccanti, derivati ergotaminici, bleomicina, chemioterapici.",
          "Ostruzioni vascolari: trombosi, sindrome dello stretto toracico.",
          "Endocrine: ipotiroidismo.",
          "Ematologiche: crioglobulinemie, policitemia, mieloma.",
        ],
      },
      {
        title: "Trattamento",
        items: [
          "Misure non farmacologiche: evitare freddo, fumo, β-bloccanti, stress; guanti termici.",
          "Prima linea: calcio-antagonisti diidropiridinici (nifedipina 30-60 mg/die, amlodipina).",
          "Seconda linea: PDE-5 inibitori (sildenafil, tadalafil).",
          "Ulcere digitali attive: iloprost e.v. in cicli; bosentan per prevenzione nuove ulcere (SSc).",
          "Casi refrattari: simpaticectomia digitale, botulino locale.",
        ],
      },
    ],
  },
  {
    id: "iperferritinemia",
    name: "Iperferritinemia in reumatologia",
    category: "Algoritmi",
    intro: "Iperferritinemia severa (>1000 µg/L) è un red flag reumatologico: orienta verso malattie iperinfiammatorie (AOSD, MAS, HLH).",
    steps: [
      {
        title: "Soglie di allarme",
        items: [
          "Ferritina >500 µg/L: sospettare condizione infiammatoria.",
          "Ferritina >1000 µg/L: red flag reumatologico, AOSD probabile.",
          "Ferritina >10.000 µg/L: considerare MAS/HLH (emergenza).",
          "Frazione glicata della ferritina <20%: altamente specifica per AOSD.",
        ],
      },
      {
        title: "Cause principali",
        items: [
          "AOSD (Still dell'adulto): febbre spikes, rash salmone, artrite, leucocitosi neutrofila, transaminasi↑, faringodinia.",
          "Sindrome da attivazione macrofagica (MAS): complicanza di AOSD/sJIA, LES, Kawasaki; pancitopenia, CID, ferritina >10.000.",
          "Emofagocitosi linfoistiocitaria (HLH): forma primitiva (genetica) o secondaria (infezioni, tumori, autoimmuni).",
          "Infezioni severe (sepsi, virali come EBV, CMV, HIV, COVID-19).",
          "Neoplasie (linfomi, leucemie).",
          "Sovraccarico ferro: emocromatosi (ma ferritina in genere <1500-2000, con transferrina saturata ↑↑).",
          "Epatopatie (steatoepatite).",
        ],
      },
      {
        title: "Criteri HLH-2004 (5 su 8 richiesti)",
        items: [
          "Febbre >7 gg.",
          "Splenomegalia.",
          "Citopenia ≥2 linee (Hb <9, piastrine <100, neutrofili <1).",
          "Ipertrigliceridemia >265 mg/dL e/o ipofibrinogenemia <150 mg/dL.",
          "Emofagocitosi in midollo/milza/linfonodi.",
          "Attività NK ridotta/assente.",
          "Ferritina >500 µg/L (tipicamente >10.000 in HLH).",
          "CD25 solubile (sIL-2R) elevato >2400 U/mL.",
        ],
      },
      {
        title: "Criteri H-score (MAS)",
        items: [
          "Score calcolato con: temperatura, organomegalia, citopenie, trigliceridi, fibrinogeno, transaminasi, ferritina, emofagocitosi, immunosoppressione preesistente.",
          "Score >169: alta probabilità di MAS/HLH (93% sens, 86% spec).",
          "Online: saintantoine.aphp.fr/score/",
        ],
      },
      {
        title: "Approccio terapeutico urgente",
        items: [
          "MAS/HLH: boli di metilprednisolone 500-1000 mg x 3 gg + IVIg + eventuale anakinra/etoposide.",
          "AOSD senza MAS: GC (prednisone 0.5-1 mg/kg), poi steroid-sparing (MTX, anakinra, canakinumab, tocilizumab).",
          "Cercare e trattare trigger infettivo/neoplastico sottostante.",
        ],
      },
    ],
  },
  {
    id: "uveite",
    name: "Uveite - approccio reumatologico",
    category: "Algoritmi",
    intro: "L'uveite (infiammazione del tratto uveale) è frequente in reumatologia. La classificazione anatomica (anteriore, intermedia, posteriore, panuveite) orienta l'etiologia.",
    steps: [
      {
        title: "Classificazione anatomica (SUN)",
        items: [
          "Anteriore (irite, iridociclite): 80% dei casi. Cellule in camera anteriore.",
          "Intermedia (pars planitis): vitreite, snowballs.",
          "Posteriore (coroidite/retinite): alterazioni fundus.",
          "Panuveite: tutti i segmenti.",
        ],
      },
      {
        title: "Uveite anteriore acuta - cause reumatologiche",
        items: [
          "Spondiloartriti (HLA-B27+): uveite anteriore acuta ricorrente, unilaterale alternante (40% dei pazienti SpA).",
          "Artrite idiopatica giovanile (JIA): uveite cronica anteriore, spesso bilaterale, PAUCI-sintomatica (screening oftalmologico obbligatorio).",
          "Sarcoidosi: granulomatosa, può essere anteriore, intermedia o posteriore.",
          "Behçet: panuveite con ipopion, vasculite retinica, severa.",
          "Sindrome di Cogan: uveite + sintomi vestibolo-cocleari.",
        ],
      },
      {
        title: "Screening reumatologico",
        items: [
          "HLA-B27 (uveite anteriore ricorrente).",
          "ACE sierico, lisozima, calcemia, Rx torace / HRCT (sarcoidosi).",
          "IGRA/Mantoux, sierologia sifilide, HIV (escludere infezioni).",
          "ANA (JIA), ANCA, anti-dsDNA (LES).",
          "HLA-B51 (Behçet).",
          "Angio-fluorografia, OCT se uveite posteriore.",
        ],
      },
      {
        title: "Trattamento di base",
        items: [
          "Anteriore lieve: steroidi topici (desametasone collirio) + cicloplegici.",
          "Anteriore severa/ricorrente: GC sistemici + steroid-sparing (MTX, AZA).",
          "Posteriore/panuveite: GC sistemici ± immunosoppressore.",
          "Refrattaria: anti-TNF (adalimumab è il solo biologico con indicazione approvata per uveite non infettiva).",
          "Behçet: azatioprina + GC; anti-TNF in severa; interferone-α.",
        ],
      },
    ],
  },
  {
    id: "dolore_infiammatorio",
    name: "Dolore infiammatorio vs meccanico",
    category: "Algoritmi",
    intro: "Distinguere il pattern di dolore è il primo passo per orientare la diagnosi tra artropatie infiammatorie e degenerative.",
    steps: [
      {
        title: "Dolore INFIAMMATORIO - caratteristiche",
        items: [
          "Peggiora con il riposo, migliora con il movimento.",
          "Rigidità mattutina >30-60 minuti.",
          "Dolore notturno (risveglio tipicamente nella seconda metà della notte).",
          "Tumefazione articolare calda/rossa.",
          "Rigidità dopo inattività prolungata (gelling).",
          "Risposta marcata ai FANS.",
          "Indici di flogosi elevati (VES, PCR).",
        ],
      },
      {
        title: "Dolore MECCANICO - caratteristiche",
        items: [
          "Peggiora con l'attività, migliora con il riposo.",
          "Rigidità mattutina <30 minuti.",
          "Raro dolore notturno (salvo posizioni forzate).",
          "Tumefazione assente o fredda/dura (osteofiti).",
          "Crepitii articolari, limitazione meccanica.",
          "Risposta modesta ai FANS.",
          "Indici di flogosi normali.",
        ],
      },
      {
        title: "Dolore INFIAMMATORIO CRONICO ASSIALE (ASAS-IBP)",
        items: [
          "≥4 dei seguenti 5 (sensibilità 77%, specificità 92%):",
          "1. Esordio <40 anni.",
          "2. Esordio insidioso.",
          "3. Miglioramento con l'esercizio.",
          "4. Nessun miglioramento con il riposo.",
          "5. Dolore notturno (con miglioramento all'alzarsi).",
        ],
      },
      {
        title: "Pattern articolare",
        items: [
          "Monoartrite: gotta, pseudogotta, settica, reattiva, trauma.",
          "Oligoartrite (<5): spondiloartriti, AP, sarcoidosi (Löfgren), reattiva, gotta.",
          "Poliartrite simmetrica: AR, LES, miositi, polimialgia (spalle/anche).",
          "Poliartrite asimmetrica: psoriasica, reattiva, IBD-associata.",
          "Migrante: streptococco (febbre reumatica), gonococcica, Lyme, sarcoidosi.",
          "Additiva: AR.",
          "Intermittente: gotta, FMF, palindromica, relapsing polychondritis.",
        ],
      },
    ],
  },
];

export const MISC_GROUPS = [
  { id: "tables", label: "Tabelle di riferimento" },
  { id: "algorithms", label: "Iter diagnostici" },
];
