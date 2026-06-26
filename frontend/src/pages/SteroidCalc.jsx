import React, { useState, useMemo } from "react";
import { Card } from "../components/ui/card";
import { Info, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

const STEROIDS = [
  {
    nome: "Idrocortisone",
    brand: "Flebocortid, Solu-Cortef",
    via: ["ev", "im"],
    eq: 20,
    mineralocort: "alta",
    emivitaBiol: "8–12 h",
    uso: "emergenza",
    note: "Riferimento per il calcolo delle equivalenze. Usato nella crisi addisoniana e come stress dose.",
  },
  {
    nome: "Cortisone acetato",
    brand: "Cortone",
    via: ["os"],
    eq: 25,
    mineralocort: "alta",
    emivitaBiol: "8–12 h",
    uso: "raro",
    note: "Profarmaco convertito a idrocortisone in sede epatica. Raramente usato in reumatologia.",
  },
  {
    nome: "Prednisone",
    brand: "Deltacortene, Lodotra",
    via: ["os"],
    eq: 5,
    mineralocort: "bassa",
    emivitaBiol: "18–36 h",
    uso: "comune",
    note: "Gold standard orale in reumatologia. Lodotra (rilascio modificato alle ore 2:00) riduce la rigidita mattutina nell'AR.",
  },
  {
    nome: "Prednisolone",
    brand: "Sintropred, Soldesam",
    via: ["os", "ev", "im"],
    eq: 5,
    mineralocort: "bassa",
    emivitaBiol: "18–36 h",
    uso: "comune",
    note: "Forma attiva del prednisone. Preferibile in epatopatia (non richiede conversione epatica).",
  },
  {
    nome: "Metilprednisolone",
    brand: "Medrol (os), Solu-Medrol (ev)",
    via: ["os", "ev", "im", "ia"],
    eq: 4,
    mineralocort: "minima",
    emivitaBiol: "18–36 h",
    uso: "comune",
    note: "Preferito per la pulse therapy iv (500–1000 mg/die × 3gg in LES, vasculiti, flare gravi). Minore ritenzione idrica.",
  },
  {
    nome: "Deflazacort",
    brand: "Flantadin, Deflan",
    via: ["os"],
    eq: 6,
    mineralocort: "minima",
    emivitaBiol: "18–36 h",
    uso: "comune",
    note: "Minore impatto su metabolismo glucidico e massa ossea rispetto al prednisone. Indicato in diabetici e pazienti a rischio osteoporosi.",
  },
  {
    nome: "Triamcinolone",
    brand: "Kenacort, Triamvirtu",
    via: ["ia", "im", "intralesionale"],
    eq: 4,
    mineralocort: "nulla",
    emivitaBiol: "18–36 h",
    uso: "infiltrativo",
    note: "Depot per infiltrazioni articolari. Effetto locale prolungato (2–4 settimane). Non utilizzare in articolazioni protesiche.",
  },
  {
    nome: "Betametasone",
    brand: "Bentelan (ev/os), Diprospan (depot)",
    via: ["os", "ev", "im", "ia"],
    eq: 0.6,
    mineralocort: "nulla",
    emivitaBiol: "36–54 h",
    uso: "comune",
    note: "Diprospan (depot): infiltrazione a rilascio lento, effetto prolungato. Bentelan ev: flare acuti e crisi.",
  },
  {
    nome: "Desametasone",
    brand: "Decadron, Soldesam",
    via: ["os", "ev", "im"],
    eq: 0.75,
    mineralocort: "nulla",
    emivitaBiol: "36–54 h",
    uso: "selettivo",
    note: "Emivita lunga, non interferisce con il test al cortisolo (test di soppressione a basse dosi). Non ideale per uso cronico per soppressione surrenalica.",
  },
  {
    nome: "Budesonide",
    brand: "Entocort, Jorveza",
    via: ["os (topico GI)"],
    eq: null,
    mineralocort: "nulla",
    emivitaBiol: "variabile",
    uso: "selettivo",
    note: "Steroide a uso topico GI con elevato first-pass epatico (~90%). Usato in IBD e colite microscopica. Effetti sistemici minimi; non calcolabile equivalenza sistemica.",
  },
];

const USO_CONFIG = {
  comune:      { label: "Uso comune",    cls: "bg-violet-50 text-violet-700 border-violet-200"   },
  emergenza:   { label: "Emergenza",     cls: "bg-red-50 text-red-700 border-red-200"             },
  infiltrativo:{ label: "Infiltrativo",  cls: "bg-amber-50 text-amber-700 border-amber-200"       },
  selettivo:   { label: "Uso selettivo", cls: "bg-teal-50 text-teal-700 border-teal-200"          },
  raro:        { label: "Raro",          cls: "bg-gray-100 text-gray-500 border-gray-200"         },
};

const MINERALOCORT_CONFIG = {
  alta:   { label: "Alta",   cls: "text-red-600"    },
  bassa:  { label: "Bassa",  cls: "text-amber-600"  },
  minima: { label: "Minima", cls: "text-teal-600"   },
  nulla:  { label: "Nulla",  cls: "text-gray-400"   },
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function BadgeUso({ uso }) {
  const cfg = USO_CONFIG[uso] || USO_CONFIG.raro;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function ViaList({ via }) {
  return (
    <div className="flex flex-wrap gap-1">
      {via.map(v => (
        <span key={v} className="inline-block px-1 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-mono">
          {v}
        </span>
      ))}
    </div>
  );
}

function Tabella() {
  const [filterUso, setFilterUso]     = useState("tutti");
  const [expandedRow, setExpandedRow] = useState(null);

  const filtered = filterUso === "tutti"
    ? STEROIDS
    : STEROIDS.filter(s => s.uso === filterUso);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilterUso("tutti")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            filterUso === "tutti"
              ? "bg-[#0A2540] text-white border-[#0A2540]"
              : "bg-white text-gray-600 border-gray-200 hover:border-[#0A2540]"
          }`}
        >
          Tutti
        </button>
        {Object.entries(USO_CONFIG).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setFilterUso(k)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterUso === k
                ? "bg-[#0A2540] text-white border-[#0A2540]"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#0A2540]"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Farmaco</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Brand</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Via</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 text-right">Dose eq. (mg)</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Mineralocort.</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Emivita biol.</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Uso</th>
                <th className="px-4 py-2.5 w-6" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const isOpen = expandedRow === s.nome;
                const mc     = MINERALOCORT_CONFIG[s.mineralocort] || MINERALOCORT_CONFIG.nulla;
                return (
                  <React.Fragment key={s.nome}>
                    <tr
                      className={`border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 align-top ${isOpen ? "bg-blue-50/30" : ""}`}
                      onClick={() => setExpandedRow(isOpen ? null : s.nome)}
                    >
                      <td className="px-4 py-2.5 font-semibold text-[#0A2540] whitespace-nowrap">{s.nome}</td>
                      <td className="px-4 py-2.5 text-gray-500">{s.brand}</td>
                      <td className="px-4 py-2.5"><ViaList via={s.via} /></td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-[#0A2540]">
                        {s.eq !== null ? s.eq : <span className="text-gray-400 font-normal">—</span>}
                      </td>
                      <td className={`px-4 py-2.5 font-medium ${mc.cls}`}>{mc.label}</td>
                      <td className="px-4 py-2.5 text-gray-600">{s.emivitaBiol}</td>
                      <td className="px-4 py-2.5"><BadgeUso uso={s.uso} /></td>
                      <td className="px-4 py-2.5 text-gray-400">
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-gray-200 bg-blue-50/20">
                        <td colSpan={8} className="px-4 py-3">
                          <p className="text-xs text-gray-700 leading-relaxed">{s.note}</p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Calcolatore() {
  const validSteroidi = STEROIDS.filter(s => s.eq !== null);
  const [fromNome, setFromNome] = useState("Prednisone");
  const [toNome,   setToNome]   = useState("Metilprednisolone");
  const [dose,     setDose]     = useState("");

  const fromDrug = validSteroidi.find(s => s.nome === fromNome);
  const toDrug   = validSteroidi.find(s => s.nome === toNome);

  const result = useMemo(() => {
    const d = parseFloat(dose);
    if (!d || d <= 0 || !fromDrug || !toDrug) return null;
    return round2((d / fromDrug.eq) * toDrug.eq);
  }, [dose, fromDrug, toDrug]);

  const allConversions = useMemo(() => {
    const d = parseFloat(dose);
    if (!d || d <= 0 || !fromDrug) return [];
    return validSteroidi.map(s => ({
      ...s,
      result: round2((d / fromDrug.eq) * s.eq),
    }));
  }, [dose, fromDrug, validSteroidi]);

  const predEquiv = allConversions.find(s => s.nome === "Prednisone")?.result;

  return (
    <div className="space-y-5">
      <Card className="border-gray-200 shadow-sm">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold block mb-1.5">
                Farmaco di partenza
              </label>
              <select
                value={fromNome}
                onChange={e => setFromNome(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0A2540] bg-white"
              >
                {validSteroidi.map(s => (
                  <option key={s.nome} value={s.nome}>{s.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold block mb-1.5">
                Dose (mg)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={dose}
                onChange={e => setDose(e.target.value)}
                placeholder="es. 25"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0A2540] bg-white"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold block mb-1.5">
                Converti in
              </label>
              <select
                value={toNome}
                onChange={e => setToNome(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0A2540] bg-white"
              >
                {validSteroidi.map(s => (
                  <option key={s.nome} value={s.nome}>{s.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {result !== null && (
            <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg px-5 py-4">
              <span className="text-sm text-teal-800">
                {dose} mg {fromDrug?.nome} =
              </span>
              <span className="text-2xl font-black text-teal-900">
                {result} <span className="text-base font-normal">mg {toDrug?.nome}</span>
              </span>
            </div>
          )}

          {result !== null && fromNome !== "Prednisone" && predEquiv !== undefined && (
            <div className="text-xs text-gray-500">
              Equivalente prednisone: <span className="font-semibold text-[#0A2540]">{predEquiv} mg</span>
            </div>
          )}
        </div>
      </Card>

      {allConversions.length > 0 && (
        <Card className="border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Tutte le equivalenze
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Farmaco</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Dose eq. (mg)</th>
                </tr>
              </thead>
              <tbody>
                {allConversions.map((s) => {
                  const isSource = s.nome === fromNome;
                  const isPred   = s.nome === "Prednisone";
                  return (
                    <tr
                      key={s.nome}
                      className={`border-b border-gray-100 ${isSource ? "bg-blue-50" : isPred ? "bg-teal-50/50" : ""}`}
                    >
                      <td className="px-4 py-2">
                        <span className={`font-medium ${isSource ? "text-blue-800" : "text-[#0A2540]"}`}>
                          {s.nome}
                        </span>
                        {isSource && (
                          <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">
                            partenza
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-[#0A2540]">
                        {s.result}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

const TOPICI_CLASSI = [
  { id: "I",   label: "Classe I",   sublabel: "Debolissimi",  activeCls: "border-teal-500 text-teal-700 bg-teal-50",   dotCls: "bg-teal-500"   },
  { id: "II",  label: "Classe II",  sublabel: "Deboli",       activeCls: "border-blue-500 text-blue-700 bg-blue-50",   dotCls: "bg-blue-500"   },
  { id: "III", label: "Classe III", sublabel: "Moderati",     activeCls: "border-violet-500 text-violet-700 bg-violet-50", dotCls: "bg-violet-500" },
  { id: "IV",  label: "Classe IV",  sublabel: "Potenti",      activeCls: "border-amber-500 text-amber-700 bg-amber-50",  dotCls: "bg-amber-500"  },
  { id: "V",   label: "Classe V",   sublabel: "Molto potenti",activeCls: "border-red-500 text-red-700 bg-red-50",      dotCls: "bg-red-500"    },
];

const TOPICI_RISCHIO_CFG = {
  basso:       { label: "Rischio basso",      cls: "bg-teal-50 text-teal-700 border-teal-200"     },
  medio:       { label: "Rischio medio",      cls: "bg-violet-50 text-violet-700 border-violet-200" },
  alto:        { label: "Rischio alto",       cls: "bg-amber-50 text-amber-700 border-amber-200"   },
  "molto alto":{ label: "Rischio molto alto", cls: "bg-red-50 text-red-700 border-red-200"         },
};

const TOPICI_FARMACI = [
  {
    classe: "I", nome: "Idrocortisone", brand: "Locoidon 1%, Farmicort 1%",
    concentrazione: "0.5–2.5%", formulazioni: ["crema", "unguento", "lozione"],
    indicazioni: ["Dermatite seborroica", "Prurito lieve", "Zona perioculare", "Genitali", "Bambini"],
    controindicazioni: ["Rosacea", "Acne", "Infezioni cutanee attive"],
    note: "Unico sicuro per zona perioculare, genitali e bambini < 2 anni. Emivita breve, effetti sistemici minimi.",
    rischio: "basso",
  },
  {
    classe: "I", nome: "Desametasone", brand: "Auxiloson 0.1%",
    concentrazione: "0.1%", formulazioni: ["crema", "gocce auricolari"],
    indicazioni: ["Dermatite lieve", "Eczema auricolare"],
    controindicazioni: ["Uso prolungato su ampie superfici"],
    note: "Uso topico limitato. Formulazione auricolare utile in otite esterna.",
    rischio: "basso",
  },
  {
    classe: "II", nome: "Triamcinolone acetonide 0.025%", brand: "Triamvirtu 0.025%",
    concentrazione: "0.025%", formulazioni: ["crema", "unguento"],
    indicazioni: ["Eczema lieve-moderato", "Dermatite da contatto"],
    controindicazioni: ["Viso", "Pieghe cutanee"],
    note: "A bassa concentrazione ben tollerato. Evitare uso prolungato sul viso.",
    rischio: "basso",
  },
  {
    classe: "II", nome: "Fluocinolone acetonide 0.01%", brand: "Synalar 0.01%",
    concentrazione: "0.01%", formulazioni: ["crema", "soluzione"],
    indicazioni: ["Dermatite atopica lieve", "Psoriasi cuoio capelluto (soluzione)"],
    controindicazioni: ["Bambini piccoli", "Viso prolungato"],
    note: "Soluzione utile per cuoio capelluto. Non aumentare la concentrazione senza rivalutazione.",
    rischio: "basso",
  },
  {
    classe: "III", nome: "Betametasone valerato 0.1%", brand: "Beben, Betnovate",
    concentrazione: "0.1%", formulazioni: ["crema", "unguento", "lozione", "schiuma"],
    indicazioni: ["Psoriasi", "Eczema moderato-severo", "Lichen planus", "Dermatite da contatto severa"],
    controindicazioni: ["Viso (uso prolungato)", "Pieghe occlusive", "Bambini < 1 anno"],
    note: "Tra i piu usati in reumatologia per manifestazioni cutanee di LES e dermatomiosite. Schiuma indicata per cuoio capelluto.",
    rischio: "medio",
  },
  {
    classe: "III", nome: "Triamcinolone acetonide 0.1%", brand: "Triamvirtu 0.1%, Kenacort topico",
    concentrazione: "0.1%", formulazioni: ["crema", "unguento", "pasta oromucosale"],
    indicazioni: ["Eczema", "Psoriasi", "Afte orali", "Lichen planus orale"],
    controindicazioni: ["Viso prolungato", "Infezioni fungine"],
    note: "Pasta oromucosale (Kenacort in orabase) per afte e lichen orale. Utile nella sindrome di Sjogren con manifestazioni mucose.",
    rischio: "medio",
  },
  {
    classe: "III", nome: "Fluocinolone acetonide 0.025%", brand: "Synalar 0.025%",
    concentrazione: "0.025%", formulazioni: ["crema", "unguento", "gocce"],
    indicazioni: ["Psoriasi", "Dermatite atopica moderata", "Eczema cronico"],
    controindicazioni: ["Rosacea", "Dermatite periorale", "Gravidanza (uso prolungato)"],
    note: "Gocce per condotto uditivo. Attenzione all'uso in zone occluse.",
    rischio: "medio",
  },
  {
    classe: "III", nome: "Mometasone furoato 0.1%", brand: "Elocon",
    concentrazione: "0.1%", formulazioni: ["crema", "unguento", "lozione"],
    indicazioni: ["Psoriasi", "Eczema moderato-severo", "Lichen sclerosus genitale (adulto)"],
    controindicazioni: ["Rosacea", "Acne", "Infezioni virali cutanee"],
    note: "Profilo rischio-beneficio favorevole per la classe. Monosomministrazione giornaliera. Lozione per cuoio capelluto.",
    rischio: "medio",
  },
  {
    classe: "IV", nome: "Betametasone dipropionato 0.05%", brand: "Diprosone",
    concentrazione: "0.05%", formulazioni: ["crema", "unguento", "lozione"],
    indicazioni: ["Psoriasi a placche", "Lichen planus severo", "Eczema cronico refrattario"],
    controindicazioni: ["Viso", "Genitali", "Bambini", "Uso > 4 settimane senza rivalutazione"],
    note: "Alta potenza con buon profilo sistemico se usato correttamente. Evitare occlusione prolungata.",
    rischio: "alto",
  },
  {
    classe: "IV", nome: "Fluocinonide 0.05%", brand: "Topsym",
    concentrazione: "0.05%", formulazioni: ["crema", "unguento", "gel"],
    indicazioni: ["Psoriasi severa", "Lichen planus", "Lupus eritematoso discoide (LED)"],
    controindicazioni: ["Viso", "Pieghe cutanee occluse", "Gravidanza"],
    note: "Particolarmente utile nel lupus eritematoso discoide in associazione con antimalarici.",
    rischio: "alto",
  },
  {
    classe: "IV", nome: "Desametasone 0.25%", brand: "Viaderm (combo)",
    concentrazione: "0.25%", formulazioni: ["crema"],
    indicazioni: ["Eczema infetto (formulazione combinata)", "Dermatite da contatto severa"],
    controindicazioni: ["Uso prolungato", "Zona perioculare"],
    note: "Spesso in formulazione combinata con antibiotico/antimicotico. Solo a breve termine.",
    rischio: "alto",
  },
  {
    classe: "V", nome: "Clobetasolo propionato 0.05%", brand: "Dermovate, Clobesol",
    concentrazione: "0.05%", formulazioni: ["crema", "unguento", "schiuma", "shampoo"],
    indicazioni: ["Psoriasi severa refrattaria", "Lichen sclerosus genitale", "Pemfigo/Pemfigoide (topico)", "Alopecia areata"],
    controindicazioni: ["Viso", "Pieghe", "Bambini", "Gravidanza", "Oltre 50 g/settimana"],
    note: "Il piu potente disponibile. Massimo 2 settimane consecutive, max 50 g/sett. Rischio soppressione surrenalica, atrofia, strie. In reumatologia utile per lichen sclerosus e manifestazioni cutanee severe.",
    rischio: "molto alto",
  },
  {
    classe: "V", nome: "Betametasone dipropionato potenziato 0.05%", brand: "Diprolene",
    concentrazione: "0.05%", formulazioni: ["unguento", "gel"],
    indicazioni: ["Psoriasi a placche recalcitrante", "Lichen planus ipertrofico"],
    controindicazioni: ["Viso", "Pieghe", "Bambini", "Gravidanza"],
    note: "Formulazione a veicolazione potenziata. Ultrapotente come clobetasolo; usare con le stesse restrizioni.",
    rischio: "molto alto",
  },
];

const NOTE_GENERALI_TOPICI = [
  "Unguento > crema per penetrazione (pelle secca/ipercheratotica). Crema per zone umide o in pieghe.",
  "Regola delle 2 settimane: rivalutare dopo 2 settimane per le classi IV–V.",
  "Regola dell'unita dito (FTU): 1 FTU ≈ 0.5 g copre palmo + dita. Guida alla quantita da applicare.",
  "Evitare occlusione prolungata con classi IV–V (aumenta l'assorbimento sistemico).",
  "Solo classe I per zona perioculare (rischio glaucoma e cataratta con classi superiori).",
  "Bambini: preferire classe I–II, formulazioni diluite, cicli brevi.",
  "Soppressione surrenalica possibile con uso prolungato di classe V su ampie superfici.",
];

function TopiciTab() {
  const [activeClasse, setActiveClasse] = useState("III");
  const [expandedRow, setExpandedRow]   = useState(null);
  const [showNote, setShowNote]         = useState(false);

  const classeConfig = TOPICI_CLASSI.find(c => c.id === activeClasse);
  const filtered     = TOPICI_FARMACI.filter(f => f.classe === activeClasse);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TOPICI_CLASSI.map(c => (
          <button
            key={c.id}
            onClick={() => { setActiveClasse(c.id); setExpandedRow(null); }}
            className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-lg border text-xs font-medium transition-colors ${
              activeClasse === c.id ? c.activeCls : "border-gray-200 text-gray-500 bg-white hover:border-gray-300"
            }`}
          >
            <span className="font-bold">{c.label}</span>
            <span className="font-normal opacity-80">{c.sublabel}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${classeConfig.activeCls}`}>
          <span className={`w-2 h-2 rounded-full ${classeConfig.dotCls}`} />
          {classeConfig.label} — {classeConfig.sublabel}
        </div>
        <button
          onClick={() => setShowNote(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#0A2540] border border-gray-200 rounded px-2.5 py-1 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          {showNote ? "Nascondi note" : "Note generali"}
        </button>
      </div>

      {showNote && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-1.5">
          {NOTE_GENERALI_TOPICI.map((n, i) => (
            <p key={i} className="text-xs text-blue-900 leading-relaxed">{n}</p>
          ))}
        </div>
      )}

      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Farmaco</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Brand</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Conc.</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Formulazioni</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Rischio</th>
                <th className="px-4 py-2.5 w-6" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const isOpen  = expandedRow === f.nome;
                const rCfg    = TOPICI_RISCHIO_CFG[f.rischio] || TOPICI_RISCHIO_CFG.basso;
                return (
                  <React.Fragment key={f.nome}>
                    <tr
                      className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors align-top ${isOpen ? "bg-blue-50/30" : ""}`}
                      onClick={() => setExpandedRow(isOpen ? null : f.nome)}
                    >
                      <td className="px-4 py-3 font-semibold text-[#0A2540]">{f.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{f.brand}</td>
                      <td className="px-4 py-3 font-mono text-gray-700">{f.concentrazione}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {f.formulazioni.map(fm => (
                            <span key={fm} className="inline-block px-1 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">
                              {fm}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${rCfg.cls}`}>
                          {rCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-gray-200 bg-blue-50/20">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-1.5">Indicazioni</div>
                              <ul className="space-y-0.5">
                                {f.indicazioni.map(i => (
                                  <li key={i} className="flex gap-1.5 text-xs text-gray-700">
                                    <span className="text-teal-600 font-bold mt-0.5">›</span>{i}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-1.5">Controindicazioni</div>
                              <ul className="space-y-0.5">
                                {f.controindicazioni.map(c => (
                                  <li key={c} className="flex gap-1.5 text-xs text-gray-700">
                                    <span className="text-red-500 font-bold mt-0.5">×</span>{c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-1.5">Note cliniche</div>
                              <p className="text-xs text-gray-700 leading-relaxed">{f.note}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Classificazione per potenza anti-infiammatoria topica. La potenza reale dipende da concentrazione,
          veicolo, sede di applicazione e integrita della barriera cutanea. Il giudizio clinico rimane indispensabile.
        </span>
      </div>
    </div>
  );
}

export default function SteroidCalc() {
  const [tab, setTab] = useState("tabella");

  const tabs = [
    { id: "tabella",     label: "Tabella di riferimento" },
    { id: "calcolatore", label: "Calcolatore"             },
    { id: "topici",      label: "Steroide topico"         },
  ];

  return (
    <div className="space-y-6 fade-in">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">Calcolatore</div>
        <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tighter text-[#0A2540]">
          Steroido-equivalenza
        </h1>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Dosi equi-efficaci anti-infiammatorie e calcolatore di conversione tra steroidi sistemici.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
              tab === t.id
                ? "border-[#0A2540] text-[#0A2540] bg-gray-50"
                : "border-transparent text-gray-600 hover:text-[#0A2540] hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tabella"     && <Tabella />}
      {tab === "calcolatore" && <Calcolatore />}
      {tab === "topici"      && <TopiciTab />}

      {tab !== "topici" && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-900">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Le equivalenze si riferiscono all'attivita anti-infiammatoria sistemica e sono stime approssimative.
            Non tengono conto della farmacocinetica individuale, della via di somministrazione, dell'attivita
            mineralcorticoide (rilevante in caso di sospensione o patologia surrenalica) e della durata della terapia.
            Il giudizio clinico rimane indispensabile.
          </span>
        </div>
      )}
    </div>
  );
}
