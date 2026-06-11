/**
 * ExamsSection — Lab results grid
 *
 * Dynamic two-level header:  Panel group row  ↕  Parameter column row
 * All keys present in ANY record are shown (not just KNOWN_PARAMS whitelist).
 * Unknown keys are grouped under "Altro" at the right.
 */
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { labExamsApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Plus, ArrowUpDown, Trash2, Edit, Camera, Search, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import ItalianDatePicker from "../shared/ItalianDatePicker";
import { LAB_PANELS, LAB_PANEL_KEYS } from "../../lib/labPanels";
import LabImportFromImageDialog from "./LabImportFromImageDialog";

// ─── Known parameter catalogue (source of truth for labels / units / refs) ───
// Keys MUST match what the parser saves (param_key from labValueExtractor.js).
// This is NOT a whitelist — unknown keys appear dynamically in "Altro".

const KNOWN_PARAMS = [
  // Emocromo
  { key: "hb",                      label: "Hb",          unit: "g/dL",     type: "number", panel: "emocromo",         refMin: 12,  refMax: 17   },
  { key: "mcv",                      label: "MCV",         unit: "fL",       type: "number", panel: "emocromo",         refMin: 80,  refMax: 100  },
  { key: "wbc",                      label: "WBC",         unit: "×10⁹/L",   type: "number", panel: "emocromo",         refMin: 4,   refMax: 10   },
  { key: "neutrophils",              label: "N",           unit: "×10⁹/L",   type: "number", panel: "emocromo"                                    },
  { key: "lymphocytes",              label: "Ly",          unit: "×10⁹/L",   type: "number", panel: "emocromo"                                    },
  { key: "eosinophils",              label: "Eo",          unit: "×10⁹/L",   type: "number", panel: "emocromo"                                    },
  { key: "monocytes",                label: "Mo",          unit: "×10⁹/L",   type: "number", panel: "emocromo"                                    },
  { key: "plt",                      label: "Plt",         unit: "×10⁹/L",   type: "number", panel: "emocromo",         refMin: 150, refMax: 450  },
  // Fase acuta
  { key: "ves",                      label: "VES",         unit: "mm/h",     type: "number", panel: "fase_acuta",                 refMax: 30   },
  { key: "crp",                      label: "PCR",         unit: "mg/dL",    type: "number", panel: "fase_acuta",                 refMax: 0.5  },
  { key: "ferritin",                 label: "Ferritina",   unit: "ng/mL",    type: "number", panel: "fase_acuta"                                  },
  { key: "fibrinogeno",              label: "Fibrinogeno", unit: "mg/dL",    type: "number", panel: "fase_acuta",        refMin: 200, refMax: 400  },
  { key: "saa",                      label: "SAA",         unit: "mg/L",     type: "number", panel: "fase_acuta"                                  },
  // Funzione renale/epatica
  { key: "creatinine",               label: "Creat",       unit: "mg/dL",    type: "number", panel: "funzione",                   refMax: 1.2  },
  { key: "egfr",                     label: "eGFR",        unit: "mL/min",   type: "number", panel: "funzione"                                    },
  { key: "ast",                      label: "GOT",         unit: "U/L",      type: "number", panel: "funzione",                   refMax: 40   },
  { key: "alt",                      label: "GPT",         unit: "U/L",      type: "number", panel: "funzione",                   refMax: 40   },
  { key: "ggt",                      label: "γGT",         unit: "U/L",      type: "number", panel: "funzione",                   refMax: 60   },
  { key: "ldh",                      label: "LDH",         unit: "U/L",      type: "number", panel: "funzione"                                    },
  { key: "urato",                    label: "Ac. urico",   unit: "mg/dL",    type: "number", panel: "funzione",                   refMax: 7    },
  { key: "albumin",                  label: "Albumina",    unit: "g/dL",     type: "number", panel: "funzione",         refMin: 3.5, refMax: 5.0  },
  { key: "vitd",                     label: "Vit. D",      unit: "ng/mL",    type: "number", panel: "funzione",         refMin: 30               },
  { key: "proteine_totali",          label: "Prot. tot.",  unit: "g/dL",     type: "number", panel: "funzione",         refMin: 6.0, refMax: 8.3  },
  // Muscolo
  { key: "ck",                       label: "CPK",         unit: "U/L",      type: "number", panel: "muscolo",                    refMax: 200  },
  { key: "aldolase",                 label: "Aldolasi",    unit: "U/L",      type: "number", panel: "muscolo"                                     },
  { key: "mioglobina",               label: "Mioglobina",  unit: "ng/mL",    type: "number", panel: "muscolo"                                     },
  // Urine
  { key: "proteinuria",              label: "Proteinuria", unit: "g/24h",    type: "number", panel: "urine",                      refMax: 0.15 },
  { key: "upcr",                     label: "UPCR",        unit: "mg/g",     type: "number", panel: "urine"                                       },
  { key: "proteinuria_24h",          label: "Prot. 24h",   unit: "g/24h",    type: "number", panel: "urine",                      refMax: 0.15 },
  { key: "albuminuria",              label: "Albumin. 24h",unit: "mg/24h",   type: "number", panel: "urine"                                       },
  { key: "uacr",                     label: "UACR",        unit: "mg/g",     type: "number", panel: "urine"                                       },
  { key: "esame_urine",              label: "Es. urine",   unit: "",         type: "text",   panel: "urine"                                       },
  { key: "leucocituria",             label: "Leucocituria",unit: "",         type: "qual",   panel: "urine"                                       },
  { key: "hematuria",                label: "Ematuria",    unit: "",         type: "qual",   panel: "urine"                                       },
  { key: "urinary_casts",            label: "Cilindri",    unit: "",         type: "qual",   panel: "urine"                                       },
  { key: "sedimento_note",           label: "Sedimento",   unit: "",         type: "text",   panel: "urine"                                       },
  // Elettroforesi
  { key: "albumina_pct",             label: "Alb.",        unit: "%",        type: "number", panel: "elettroforesi",    refMin: 55,  refMax: 68   },
  { key: "alfa1_glob",               label: "α1-glob",     unit: "%",        type: "number", panel: "elettroforesi",    refMin: 1,   refMax: 5    },
  { key: "alfa2_glob",               label: "α2-glob",     unit: "%",        type: "number", panel: "elettroforesi",    refMin: 7,   refMax: 12   },
  { key: "beta1_glob",               label: "β1-glob",     unit: "%",        type: "number", panel: "elettroforesi"                               },
  { key: "beta2_glob",               label: "β2-glob",     unit: "%",        type: "number", panel: "elettroforesi"                               },
  { key: "gamma_glob",               label: "γ-glob",      unit: "%",        type: "number", panel: "elettroforesi",    refMin: 11,  refMax: 22   },
  // Metabolismo Fe
  { key: "iron",                     label: "Sideremia",   unit: "μg/dL",    type: "number", panel: "marziale",         refMin: 60,  refMax: 170  },
  { key: "transferrina",             label: "Transf.",     unit: "mg/dL",    type: "number", panel: "marziale",         refMin: 200, refMax: 360  },
  { key: "saturazione_transferrina", label: "Sat. Tf",     unit: "%",        type: "number", panel: "marziale",         refMin: 16,  refMax: 45   },
  // Complemento
  { key: "c3",                       label: "C3",          unit: "mg/dL",    type: "number", panel: "complemento",      refMin: 90,  refMax: 180  },
  { key: "c4",                       label: "C4",          unit: "mg/dL",    type: "number", panel: "complemento",      refMin: 10,  refMax: 40   },
  { key: "c1q",                      label: "C1q",         unit: "mg/dL",    type: "number", panel: "complemento",      refMin: 14,  refMax: 30   },
  { key: "ch50",                     label: "CH50",        unit: "U/mL",     type: "number", panel: "complemento",      refMin: 60,  refMax: 144  },
  // Immunoglobuline
  { key: "igg",                      label: "IgG",         unit: "mg/dL",    type: "number", panel: "immunoglobuline",  refMin: 700, refMax: 1600 },
  { key: "iga",                      label: "IgA",         unit: "mg/dL",    type: "number", panel: "immunoglobuline",  refMin: 70,  refMax: 400  },
  { key: "igm",                      label: "IgM",         unit: "mg/dL",    type: "number", panel: "immunoglobuline",  refMin: 40,  refMax: 230  },
  { key: "crioglobuline",            label: "Crioglobuline",unit: "",        type: "qual",   panel: "immunoglobuline"                              },
  // Autoanticorpi
  { key: "fr",                       label: "FR",          unit: "UI/mL",    type: "number", panel: "autoanticorpi",              refMax: 14   },
  { key: "acpa_anti_ccp",            label: "ACPA",        unit: "U/mL",     type: "number", panel: "autoanticorpi",              refMax: 17   },
  { key: "ana_titolo",               label: "ANA titolo",  unit: "",         type: "text",   panel: "autoanticorpi"                               },
  { key: "ana_pattern",              label: "ANA pattern", unit: "",         type: "text",   panel: "autoanticorpi"                               },
  { key: "anti_dsdna",               label: "dsDNA",       unit: "UI/mL",    type: "number", panel: "autoanticorpi"                               },
  { key: "anca_pr3",                 label: "PR3-ANCA",    unit: "UI/mL",    type: "number", panel: "autoanticorpi"                               },
  { key: "anca_mpo",                 label: "MPO-ANCA",    unit: "UI/mL",    type: "number", panel: "autoanticorpi"                               },
  { key: "anti_sm",                  label: "Anti-Sm",     unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_rnp",                 label: "Anti-RNP",    unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_ssa_ro",              label: "SSA/Ro",      unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_ssb_la",              label: "SSB/La",      unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_scl70",               label: "Scl-70",      unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_centromero",          label: "ACA",         unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_rnap3",               label: "RNA-pol III", unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_pmscl",               label: "PM/Scl",      unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_ku",                  label: "Anti-Ku",     unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_jo1",                 label: "Jo-1",        unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_mi2",                 label: "Mi-2",        unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_mda5",                label: "MDA5",        unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_tif1g",               label: "TIF1γ",       unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_nxp2",                label: "NXP2",        unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_srp",                 label: "SRP",         unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_hmgcr",               label: "HMGCR",       unit: "",         type: "qual",   panel: "autoanticorpi"                               },
  { key: "anti_mcv",                 label: "Anti-MCV",    unit: "U/mL",     type: "number", panel: "autoanticorpi"                               },
  // Antifosfolipidi
  { key: "lac",                      label: "LAC",         unit: "",         type: "qual",   panel: "antifosfolipidi"                             },
  { key: "acl_igg",                  label: "aCL IgG",     unit: "GPL/mL",   type: "number", panel: "antifosfolipidi"                             },
  { key: "acl_igm",                  label: "aCL IgM",     unit: "MPL/mL",   type: "number", panel: "antifosfolipidi"                             },
  { key: "b2gp1_igg",                label: "β2GP1 IgG",   unit: "U/mL",     type: "number", panel: "antifosfolipidi"                             },
  { key: "b2gp1_igm",                label: "β2GP1 IgM",   unit: "U/mL",     type: "number", panel: "antifosfolipidi"                             },
  // Sierologie
  { key: "hbsag",                    label: "HBsAg",       unit: "",         type: "qual",   panel: "sierologie"                                  },
  { key: "anti_hbs",                 label: "Anti-HBs",    unit: "",         type: "qual",   panel: "sierologie"                                  },
  { key: "anti_hbc",                 label: "Anti-HBc",    unit: "",         type: "qual",   panel: "sierologie"                                  },
  { key: "anti_hcv",                 label: "Anti-HCV",    unit: "",         type: "qual",   panel: "sierologie"                                  },
  { key: "anti_hiv",                 label: "Anti-HIV",    unit: "",         type: "qual",   panel: "sierologie"                                  },
  { key: "tb_qft",                   label: "TB (QFT)",    unit: "",         type: "qual",   panel: "sierologie"                                  },
  // Metabolismo osseo
  { key: "bap",                      label: "BAP",         unit: "U/L",      type: "number", panel: "metabolismo_osseo",          refMax: 43   },
  { key: "ctx",                      label: "β-CTX",       unit: "ng/mL",    type: "number", panel: "metabolismo_osseo",          refMax: 0.57 },
];

const KNOWN_PARAMS_MAP = new Map(KNOWN_PARAMS.map(p => [p.key, p]));

const PANEL_ORDER = [
  "emocromo", "fase_acuta", "funzione", "muscolo", "urine",
  "elettroforesi", "marziale", "complemento", "immunoglobuline",
  "autoanticorpi", "antifosfolipidi", "sierologie", "metabolismo_osseo", "altro",
];

const PANEL_LABELS = {
  emocromo:          "Emocromo",
  fase_acuta:        "Fase acuta",
  funzione:          "Funzione renale/epatica",
  muscolo:           "Muscolo",
  urine:             "Urine",
  elettroforesi:     "Elettroforesi",
  marziale:          "Metabolismo Fe",
  complemento:       "Complemento",
  immunoglobuline:   "Immunoglobuline",
  autoanticorpi:     "Autoanticorpi",
  antifosfolipidi:   "Antifosfolipidi",
  sierologie:        "Sierologie",
  metabolismo_osseo: "Metabolismo osseo",
  altro:             "Altro",
};

const PANEL_COLORS = {
  emocromo:          { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  fase_acuta:        { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  funzione:          { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  muscolo:           { bg: "#faf5ff", border: "#e9d5ff", text: "#7e22ce" },
  urine:             { bg: "#fefce8", border: "#fde68a", text: "#a16207" },
  elettroforesi:     { bg: "#f8fafc", border: "#e2e8f0", text: "#475569" },
  marziale:          { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  complemento:       { bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e" },
  immunoglobuline:   { bg: "#eef2ff", border: "#c7d2fe", text: "#4338ca" },
  autoanticorpi:     { bg: "#fff1f2", border: "#fecdd3", text: "#be123c" },
  antifosfolipidi:   { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
  sierologie:        { bg: "#f7fee7", border: "#d9f99d", text: "#4d7c0f" },
  metabolismo_osseo: { bg: "#ecfdf5", border: "#6ee7b7", text: "#065f46" },
  altro:             { bg: "#f9fafb", border: "#e5e7eb", text: "#6b7280" },
};

// ─── Qualitative display shorthands ──────────────────────────────────────────
// Keys: canonical English (from status field) + Italian strings (from qualitative field)
const QUAL_SHORT = {
  // English canonical (status field)
  negative:            "Neg",
  positive_low:        "Pos(b)",
  positive:            "Pos",
  borderline:          "Border",
  normal:              "NN",
  // Italian strings saved by the parser (qualitative field)
  negativo:            "Neg",
  negativi:            "Neg",
  positivo:            "Pos",
  "debolmente positivo": "Pos(b)",
  "nei limiti":        "NN",
  "nei limiti normali": "NN",
  "nella norma":       "NN",
  "non consumato":     "NN",
  "non consumati":     "NN",
  normale:             "NN",
  normali:             "NN",
};
const QUAL_COLOR = {
  // English canonical
  positive:            "#dc2626",
  positive_low:        "#b45309",
  negative:            "#15803d",
  borderline:          "#6b7280",
  normal:              "#15803d",
  // Italian
  negativo:            "#15803d",
  negativi:            "#15803d",
  positivo:            "#dc2626",
  "debolmente positivo": "#b45309",
  "nei limiti":        "#15803d",
  "nei limiti normali": "#15803d",
  "nella norma":       "#15803d",
  "non consumato":     "#15803d",
  "non consumati":     "#15803d",
  normale:             "#15803d",
  normali:             "#15803d",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function hasValue(v) { return v !== null && v !== undefined && v !== ""; }
function oor(col, rawVal) {
  if (col.type !== "number") return false;
  const n = Number(rawVal);
  if (isNaN(n)) return false;
  if (col.refMax != null && n > col.refMax) return "high";
  if (col.refMin != null && n < col.refMin) return "low";
  return false;
}

// ─── Table cell ──────────────────────────────────────────────────────────────
function Cell({ col, valObj }) {
  if (!valObj) return <span style={{ color: "#d1d5db", fontSize: "11px" }}>—</span>;

  // Determine qual key from multiple sources
  const qualKey =
    (valObj.status && QUAL_SHORT[valObj.status]     ? valObj.status     : null) ||
    (valObj.qualitative && QUAL_SHORT[valObj.qualitative] ? valObj.qualitative : null) ||
    (col.type === "qual" && valObj.value && QUAL_SHORT[valObj.value] ? valObj.value : null);

  if (qualKey) {
    return (
      <span style={{ fontSize: "11px", fontWeight: 600, color: QUAL_COLOR[qualKey] || "#6b7280" }}>
        {QUAL_SHORT[qualKey]}
      </span>
    );
  }

  if (!hasValue(valObj.value)) return <span style={{ color: "#d1d5db", fontSize: "11px" }}>—</span>;
  const raw = valObj.value;

  if (col.type === "text") {
    return (
      <span title={raw} style={{
        fontSize: "11px", color: "#374151",
        maxWidth: "84px", display: "inline-block",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}>{raw}</span>
    );
  }

  const flag = oor(col, raw);
  return (
    <span style={{
      fontFamily: "monospace", fontSize: "12px",
      fontWeight: flag ? 700 : 500,
      color: flag === "high" ? "#dc2626" : flag === "low" ? "#2563eb" : "#111827",
    }}>
      {raw}{flag === "high" ? "↑" : flag === "low" ? "↓" : ""}
    </span>
  );
}

// ─── Entry form row ───────────────────────────────────────────────────────────
const QUAL_OPTIONS = [
  { value: "negative",     label: "Negativo" },
  { value: "positive_low", label: "Positivo (basso titolo)" },
  { value: "positive",     label: "Positivo" },
  { value: "borderline",   label: "Borderline" },
];

function isOutOfRange(test, value) {
  if (value == null || value === "" || isNaN(Number(value))) return false;
  const v = Number(value);
  if (test.refMax != null && v > test.refMax) return "high";
  if (test.refMin != null && v < test.refMin) return "low";
  return false;
}

function TestRow({ test, value, onChange }) {
  const v = value?.value ?? "";
  const outOfRange = test.type === "number" ? isOutOfRange(test, v) : false;
  const refLine = test.refMin != null && test.refMax != null
    ? `${test.refMin}–${test.refMax}`
    : test.refMax != null ? `< ${test.refMax}` : test.refMin != null ? `> ${test.refMin}` : null;

  return (
    <div className="grid grid-cols-12 gap-2 items-center border border-gray-200 rounded-md p-2.5">
      <div className="col-span-12 md:col-span-5">
        <div className="text-sm font-medium">{test.label}</div>
        {refLine && <div className="text-[10px] text-gray-500">vn: {refLine} {test.unit}</div>}
      </div>
      <div className="col-span-7 md:col-span-4">
        {test.type === "qual" ? (
          <select
            className="w-full h-9 border border-gray-200 rounded-md px-2 text-sm"
            value={v || ""}
            onChange={(e) => onChange("value", e.target.value)}
          >
            <option value="">--</option>
            {QUAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : test.type === "text" ? (
          <Input type="text" value={v} onChange={(e) => onChange("value", e.target.value)} placeholder={test.placeholder || ""} />
        ) : (
          <Input
            type="number" step="any" value={v}
            onChange={(e) => onChange("value", e.target.value)}
            placeholder={test.placeholder}
            className={outOfRange ? "border-red-400 text-red-700" : ""}
          />
        )}
      </div>
      <div className="col-span-3 md:col-span-2 text-xs text-gray-500">{test.unit}</div>
      <div className="col-span-2 md:col-span-1 flex justify-end">
        {outOfRange === "high" && <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">↑</Badge>}
        {outOfRange === "low"  && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">↓</Badge>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExamsSection({ patient }) {
  const [exams,        setExams]        = useState([]);
  const [open,         setOpen]         = useState(false);
  const [ocrImportOpen,setOcrImportOpen]= useState(false);
  const [editing,      setEditing]      = useState(null);
  const [date,         setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [activePanel,  setActivePanel]  = useState(LAB_PANEL_KEYS[0]);
  const [values,       setValues]       = useState({});
  const [notes,        setNotes]        = useState("");
  const [sortOrder,    setSortOrder]    = useState("desc");
  // Grid controls
  const [searchQuery,  setSearchQuery]  = useState("");
  const [hiddenPanels, setHiddenPanels] = useState(new Set());
  const [showEmpty,    setShowEmpty]    = useState(false);

  const load = useCallback(async () => {
    if (!patient?.id) return;
    const data = await labExamsApi.listByPatient(patient.id);
    setExams(data);
  }, [patient?.id]);
  useEffect(() => { load(); }, [load]);

  // ── Dialog helpers ────────────────────────────────────────────────────────
  const openNew = () => {
    setEditing(null);
    setDate(new Date().toISOString().slice(0, 10));
    setValues({});
    setNotes("");
    setActivePanel(LAB_PANEL_KEYS[0]);
    setOpen(true);
  };
  const openEdit = (exam) => {
    setEditing(exam);
    setDate(exam.date);
    setValues(exam.values || {});
    setNotes(exam.notes || "");
    setActivePanel(exam.panel || LAB_PANEL_KEYS[0]);
    setOpen(true);
  };

  const save = async () => {
    const cleanedValues = Object.fromEntries(
      Object.entries(values).filter(([_, v]) => v?.value !== "" && v?.value != null)
    );
    if (Object.keys(cleanedValues).length === 0) { toast.error("Compila almeno un valore"); return; }
    try {
      const payload = { patient_id: patient.id, date, panel: activePanel, values: cleanedValues, notes };
      if (editing) { await labExamsApi.update(editing.id, payload); toast.success("Aggiornato"); }
      else          { await labExamsApi.create(payload);            toast.success("Esame salvato"); }
      setOpen(false);
      load();
    } catch { toast.error("Errore nel salvataggio"); }
  };

  const removeExam = async (exam) => {
    if (!window.confirm("Eliminare questo referto?")) return;
    await labExamsApi.remove(exam.id);
    toast.success("Eliminato");
    load();
  };
  const removeDate = async (date, ids) => {
    if (!window.confirm(`Eliminare tutti i referti del ${fmtDate(date)}?`)) return;
    await Promise.all(ids.map(id => labExamsApi.remove(id)));
    toast.success("Referti eliminati");
    load();
  };
  const updateValue = (key, field, value) => {
    setValues((p) => ({ ...p, [key]: { ...(p[key] || {}), [field]: value } }));
  };

  // ── Merge records by date ─────────────────────────────────────────────────
  const mergedByDate = useMemo(() => {
    const m = {};
    exams.forEach(exam => {
      const d = exam.date || "0000";
      if (!m[d]) m[d] = { _ids: [], _exams: [] };
      m[d]._ids.push(exam.id);
      m[d]._exams.push(exam);
      Object.entries(exam.values || {}).forEach(([k, v]) => { m[d][k] = v; });
    });
    return m;
  }, [exams]);

  const sortedDates = useMemo(() =>
    Object.keys(mergedByDate).filter(d => d !== "0000")
      .sort((a, b) => sortOrder === "desc" ? b.localeCompare(a) : a.localeCompare(b)),
    [mergedByDate, sortOrder]);

  // ── Dynamic column computation ────────────────────────────────────────────
  // Step 1: collect all keys actually present in any record
  const allPresentKeys = useMemo(() => {
    const keys = new Set();
    Object.values(mergedByDate).forEach(row => {
      Object.keys(row).forEach(k => { if (!k.startsWith("_")) keys.add(k); });
    });
    return keys;
  }, [mergedByDate]);

  // Step 2: build full column list — known params in defined order, then unknowns
  const allCols = useMemo(() => {
    const cols = [];
    const seen = new Set();
    for (const p of KNOWN_PARAMS) {
      if (showEmpty || allPresentKeys.has(p.key)) cols.push(p);
      seen.add(p.key);
    }
    const unknownKeys = Array.from(allPresentKeys).filter(k => !seen.has(k)).sort();
    for (const k of unknownKeys) {
      cols.push({ key: k, label: k, unit: "", type: "number", panel: "altro" });
    }
    return cols;
  }, [allPresentKeys, showEmpty]);

  // Step 3: search filter
  const filteredCols = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allCols;
    return allCols.filter(c => c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q));
  }, [allCols, searchQuery]);

  // Step 4: group by panel (only panels with ≥1 col)
  const panelGroups = useMemo(() => {
    const groups = {};
    for (const col of filteredCols) {
      const p = col.panel || "altro";
      if (!groups[p]) groups[p] = [];
      groups[p].push(col);
    }
    return PANEL_ORDER
      .filter(p => groups[p]?.length > 0)
      .map(p => ({ panelKey: p, label: PANEL_LABELS[p] || p, cols: groups[p] }));
  }, [filteredCols]);

  // Step 5: apply panel visibility toggle
  const visiblePanelGroups = useMemo(() =>
    panelGroups.filter(g => !hiddenPanels.has(g.panelKey)),
    [panelGroups, hiddenPanels]);

  const visibleCols = useMemo(() =>
    visiblePanelGroups.flatMap(g => g.cols),
    [visiblePanelGroups]);

  const togglePanel = (panelKey) => {
    setHiddenPanels(prev => {
      const next = new Set(prev);
      if (next.has(panelKey)) next.delete(panelKey);
      else next.add(panelKey);
      return next;
    });
  };

  const totalExams = exams.length;
  const hasAltered = useMemo(() =>
    sortedDates.some(d =>
      visibleCols.some(col => {
        const v = mergedByDate[d][col.key];
        return v && oor(col, v.value);
      })
    ), [sortedDates, visibleCols, mergedByDate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} data-testid="exams-section">

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <h2 className="font-heading font-bold text-xl tracking-tight">
          Esami di laboratorio
          {totalExams > 0 && (
            <span style={{ fontWeight: 400, fontSize: "13px", color: "#9ca3af", marginLeft: "8px" }}>
              ({sortedDates.length} date · {totalExams} referti)
            </span>
          )}
        </h2>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <Button variant="outline" onClick={() => setOcrImportOpen(true)}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" data-testid="import-lab-ocr-btn">
            <Camera className="w-4 h-4 mr-2" /> Importa da foto / PDF
          </Button>
          <Button onClick={openNew} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="add-exam-btn">
            <Plus className="w-4 h-4 mr-2" /> Aggiungi esame
          </Button>
        </div>
      </div>

      <LabImportFromImageDialog open={ocrImportOpen} onOpenChange={setOcrImportOpen} patient={patient} onImported={load} />

      {exams.length === 0 ? (
        <Card className="border-gray-200 shadow-sm p-10 text-center text-gray-500 text-sm">
          Nessun esame registrato. Clicca "Aggiungi esame" o importa da PDF/foto.
        </Card>
      ) : (
        <>
          {/* ── Grid controls ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "0 0 200px" }}>
              <Search size={13} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cerca parametro…"
                style={{
                  paddingLeft: "26px", paddingRight: "8px", height: "30px",
                  width: "100%", border: "1px solid #d1d5db", borderRadius: "6px",
                  fontSize: "12px", outline: "none",
                }}
              />
            </div>

            {/* Toggle empty */}
            <button
              type="button"
              onClick={() => setShowEmpty(v => !v)}
              title={showEmpty ? "Nascondi colonne vuote" : "Mostra colonne vuote"}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "4px 9px", height: "30px",
                border: "1px solid #d1d5db", borderRadius: "6px",
                background: showEmpty ? "#f0f9ff" : "#fff",
                fontSize: "11px", color: "#374151", cursor: "pointer", fontWeight: 500,
              }}
            >
              {showEmpty ? <Eye size={13} /> : <EyeOff size={13} />}
              {showEmpty ? "Nascondi vuote" : "Mostra vuote"}
            </button>

            {/* Sort */}
            <button
              type="button"
              onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "4px 9px", height: "30px",
                border: "1px solid #d1d5db", borderRadius: "6px",
                background: "#fff", fontSize: "11px", color: "#374151", cursor: "pointer", fontWeight: 500,
              }}
            >
              <ArrowUpDown size={13} />
              {sortOrder === "desc" ? "Recenti prima" : "Vecchi prima"}
            </button>

            <span style={{ color: "#d1d5db", fontSize: "12px" }}>|</span>

            {/* Panel toggles */}
            {panelGroups.map(g => {
              const c = PANEL_COLORS[g.panelKey] || PANEL_COLORS.altro;
              const hidden = hiddenPanels.has(g.panelKey);
              return (
                <button
                  key={g.panelKey}
                  type="button"
                  onClick={() => togglePanel(g.panelKey)}
                  title={hidden ? `Mostra ${g.label}` : `Nascondi ${g.label}`}
                  style={{
                    padding: "3px 8px", height: "26px",
                    border: `1px solid ${hidden ? "#e5e7eb" : c.border}`,
                    borderRadius: "5px",
                    background: hidden ? "#f9fafb" : c.bg,
                    fontSize: "10px", fontWeight: 600,
                    color: hidden ? "#9ca3af" : c.text,
                    cursor: "pointer", opacity: hidden ? 0.6 : 1,
                    textDecoration: hidden ? "line-through" : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          {/* ── Grid table ── */}
          <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
              <thead>
                {/* Row 1 — Panel group headers */}
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th
                    rowSpan={2}
                    style={{
                      position: "sticky", left: 0, zIndex: 3,
                      background: "#f8fafc",
                      padding: "8px 12px", textAlign: "left",
                      fontSize: "10px", fontWeight: 700, color: "#6b7280",
                      textTransform: "uppercase", letterSpacing: "0.08em",
                      borderRight: "2px solid #e5e7eb", minWidth: "96px",
                      verticalAlign: "middle",
                    }}
                  >
                    Data
                  </th>
                  {visiblePanelGroups.map(g => {
                    const c = PANEL_COLORS[g.panelKey] || PANEL_COLORS.altro;
                    return (
                      <th
                        key={g.panelKey}
                        colSpan={g.cols.length}
                        style={{
                          padding: "5px 8px", textAlign: "center",
                          background: c.bg,
                          borderLeft: `2px solid ${c.border}`,
                          fontSize: "10px", fontWeight: 700,
                          color: c.text, letterSpacing: "0.04em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {g.label}
                      </th>
                    );
                  })}
                  <th rowSpan={2} style={{ minWidth: "56px", borderLeft: "1px solid #f1f5f9" }} />
                </tr>
                {/* Row 2 — Column headers */}
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                  {visibleCols.map((col, ci) => {
                    const panelKey = col.panel || "altro";
                    const c = PANEL_COLORS[panelKey] || PANEL_COLORS.altro;
                    const isFirstInPanel = ci === 0 ||
                      (visibleCols[ci - 1]?.panel || "altro") !== panelKey;
                    return (
                      <th
                        key={col.key}
                        style={{
                          padding: "5px 7px", textAlign: "center",
                          minWidth: col.type === "text" || col.type === "qual" ? "72px" : "58px",
                          maxWidth: col.type === "text" ? "100px" : "80px",
                          borderLeft: isFirstInPanel ? `2px solid ${c.border}` : "1px solid #f1f5f9",
                        }}
                      >
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#374151", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                          {col.label}
                        </div>
                        {col.unit && (
                          <div style={{ fontSize: "9px", color: "#9ca3af", fontWeight: 400 }}>{col.unit}</div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedDates.map((d, i) => {
                  const row = mergedByDate[d];
                  return (
                    <tr
                      key={d}
                      style={{
                        background: i % 2 === 0 ? "#fff" : "#fafafa",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      {/* Sticky date cell */}
                      <td style={{
                        position: "sticky", left: 0, zIndex: 1,
                        background: i % 2 === 0 ? "#fff" : "#fafafa",
                        padding: "8px 12px",
                        fontSize: "12px", fontWeight: 600, color: "#0A2540",
                        borderRight: "2px solid #e5e7eb", whiteSpace: "nowrap",
                      }}>
                        {fmtDate(d)}
                      </td>

                      {/* Value cells */}
                      {visibleCols.map((col, ci) => {
                        const panelKey = col.panel || "altro";
                        const c = PANEL_COLORS[panelKey] || PANEL_COLORS.altro;
                        const isFirstInPanel = ci === 0 ||
                          (visibleCols[ci - 1]?.panel || "altro") !== panelKey;
                        return (
                          <td
                            key={col.key}
                            style={{
                              padding: "7px 7px", textAlign: "center",
                              borderLeft: isFirstInPanel ? `2px solid ${c.border}` : "1px solid #f1f5f9",
                              verticalAlign: "middle",
                            }}
                          >
                            <Cell col={col} valObj={row[col.key]} />
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td style={{ padding: "4px 6px", borderLeft: "1px solid #f1f5f9", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "2px", justifyContent: "center" }}>
                          <button type="button" title="Modifica" onClick={() => openEdit(row._exams[0])}
                            style={{ width: "26px", height: "26px", borderRadius: "5px", border: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <Edit size={12} color="#6b7280" />
                          </button>
                          <button type="button" title="Elimina data" onClick={() => removeDate(d, row._ids)}
                            style={{ width: "26px", height: "26px", borderRadius: "5px", border: "1px solid #fee2e2", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <Trash2 size={12} color="#dc2626" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: "14px", fontSize: "10px", color: "#9ca3af", flexWrap: "wrap", alignItems: "center" }}>
            <span><span style={{ color: "#dc2626", fontWeight: 700 }}>↑</span> sopra range</span>
            <span><span style={{ color: "#2563eb", fontWeight: 700 }}>↓</span> sotto range</span>
            <span style={{ color: "#d1d5db" }}>— non rilevato</span>
            <span style={{ marginLeft: "auto" }}>
              {visibleCols.length} parametri visibili · {allPresentKeys.size} nei referti
            </span>
          </div>
        </>
      )}

      {/* ── Entry dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading font-black tracking-tight">
              {editing ? "Modifica esame" : "Nuovo esame"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Data</Label>
              <ItalianDatePicker value={date} onChange={setDate} testid="exam-date" />
            </div>
          </div>

          <Tabs value={activePanel} onValueChange={setActivePanel}>
            <TabsList className="flex flex-wrap gap-1 h-auto mb-3">
              {LAB_PANEL_KEYS.map((k) => (
                <TabsTrigger key={k} value={k} data-testid={`panel-tab-${k}`} className="text-xs">
                  {LAB_PANELS[k].label}
                </TabsTrigger>
              ))}
            </TabsList>
            {LAB_PANEL_KEYS.map((k) => (
              <TabsContent key={k} value={k} className="space-y-2">
                {LAB_PANELS[k].tests.map((t) => (
                  <TestRow key={t.key} test={t} value={values[t.key]} onChange={(field, v) => updateValue(t.key, field, v)} />
                ))}
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-4">
            <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Note</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="exam-notes" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" onClick={save} data-testid="save-exam-btn">
              {editing ? "Aggiorna" : "Salva esame"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
