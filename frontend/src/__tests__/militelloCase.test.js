import { parseVisitText } from "../lib/visitTextParser";

const MILITELLO_LETTER = `STRUTTURA COMPLESSA DI MEDICINA INTERNA AD INDIRIZZO REUMATOLOGICO
REFERTO
MOTIVO DELLA VISITA: controllo in artrite sieronegativa
ANAMNESI: attualmente lavora in un supermercato, non psoriasi. Nessun dato per connettivite.
COMORBILITA': proctite ulcerosa.
IN TERAPIA: Reumaflex 10 mg/settimana (da gennaio 2026), Folina 5 mg/settimana
ALLERGIE: nessuna
RACCORDO ANAMNESTICO:
Prima visita a maggio 2024. Avviata terapia con MTX da gennaio 2026. Miglioramento clinico al controllo di marzo 2026.
ACCERTAMENTI:
- EE dicembre 2024: emocromo nn - hb 13,2 - plt 336 - pcr 0,05
VISITA ODIERNA:
Torna a controllo a 4 mesi dall'avvio di MTX, che riferisce di tollerare poco. Permane dolore al polso ds.
In visione:
- EE 12/05/2026: Hb 13.3, WBC 7.1, Plt 308, VES 3 mm, PCR 0.06, cr 0,63, GOT/GPT 23/18, TSH 0,57.
EO: dolor e tumor polso ds, non altre articolazioni dolenti o tumefatte. Obiettivita internistica di norma.
GH 9/10, DAS28-PCR 3.1, CDAI/SDAI 15/15.06, DAPSA 16
CONCLUSIONI: Artrite enteropatica simil-reumatoide in MDA, meritevole di upgrade terapeutico ad antiTNF.
IN TERAPIA:
- Continua Reumaflex 10 mg 1 iniezione sottocute una volta a settimana, tutte le settimane, sempre lo stesso giorno (es. lunedi).
- Continua Folina 5 mg: 1 cp a settimana, 24 ore dopo il Reumaflex (es. martedi).`;

describe("Caso Militello — regressione permanente", () => {
  let extracted;
  beforeAll(() => {
    extracted = parseVisitText(MILITELLO_LETTER).extracted;
  });

  test("estrazione diagnosi: artrite enteropatica dalle conclusioni", () => {
    expect(extracted.patient?.diagnosi).toMatch(/enteropatica/i);
  });

  test("MTX (Reumaflex) con data di inizio gennaio 2026", () => {
    const mtx = (extracted.therapies || []).find(
      (t) => t.drug_name === "Methotrexate"
    );
    expect(mtx).toBeTruthy();
    expect(mtx.start_date).toMatch(/^2026-01/);
  });

  test("comorbilita: proctite ulcerosa", () => {
    const com = extracted.comorbidita || [];
    expect(com.some((c) => /proctite ulcerosa/i.test(c))).toBe(true);
  });

  test("clinimetria: DAS28-PCR, CDAI, SDAI, DAPSA", () => {
    const byType = new Map(
      (extracted.assessments || []).map((a) => [a.index_type, a.score])
    );
    expect(byType.get("das28_crp")).toBe(3.1);
    expect(byType.get("cdai")).toBe(15);
    expect(byType.get("sdai")).toBe(15.06);
    expect(byType.get("dapsa")).toBe(16);
  });

  test("decisione di switch/upgrade ad anti-TNF (classe)", () => {
    const decision = extracted.therapy_decision;
    expect(decision).toBeTruthy();
    expect(decision.action).toMatch(/switch|upgrade|escalat/i);
    expect(decision.target_class).toMatch(/anti-?tnf/i);
  });
});
