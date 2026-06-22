/**
 * pdfLabExtractor — estrae il corpo clinico da un PDF (pdfjs-dist v5).
 *
 * 100% browser — nessun dato lascia il dispositivo.
 *
 * STRATEGIA LAYOUT — interval merging con item.width reale
 * ─────────────────────────────────────────────────────────
 * I referti AUSL Bologna hanno una spalla sinistra (equipe medica, logo,
 * contatti) che pdfjs estrae mescolandola con il corpo clinico.
 *
 * Tecnica: per ogni item si calcola [leftEdge, rightEdge] usando la
 * larghezza reale (item.width da pdfjs). Si fondono gli intervalli
 * sovrapposti e si cerca il primo GAP nella metà sinistra del foglio.
 * Quel gap è il confine tra la spalla e il corpo clinico.
 *
 * FALLBACK — se il filtro rimuove troppo testo si usa il grezzo.
 */

const Y_TOLERANCE  = 3;   // pt — deltaY < soglia → stessa riga
const X_GAP_SPACE  = 8;   // pt — gap X > soglia → spazio doppio nella riga

const MIN_FILTERED_WORDS = 60;
const MIN_FILTERED_RATIO = 0.30;

// ── Conteggio parole ─────────────────────────────────────────────────────────
function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Rilevamento confine spalla/corpo via interval merging ────────────────────
/**
 * Usa la larghezza REALE di ogni item (item.width da pdfjs) per costruire
 * gli intervalli di copertura X. Fonde gli intervalli sovrapposti e cerca
 * il primo gap > 0pt nella fascia [10%, 45%] della larghezza pagina.
 *
 * @param {import('pdfjs-dist').TextItem[]} items
 * @param {number} pageWidth
 * @returns {number}  X di taglio (0 = nessuna spalla rilevata)
 */
function detectSidebarBoundary(items, pageWidth) {
  const valid = items.filter(it => it.str && it.str.trim() !== "");
  if (valid.length < 8) return 0;

  // [leftEdge, rightEdge] usando item.width reale
  const intervals = valid.map(it => [
    it.transform[4],
    it.transform[4] + (it.width > 0 ? it.width : 0.5),
  ]).sort((a, b) => a[0] - b[0]);

  // Fondi intervalli sovrapposti o adiacenti (tolleranza 1pt)
  const merged = [];
  for (const [l, r] of intervals) {
    if (merged.length > 0 && l <= merged[merged.length - 1][1] + 1) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r);
    } else {
      merged.push([l, r]);
    }
  }

  // Cerca il primo gap nella fascia [10%, 45%] della larghezza pagina
  const minBound = pageWidth * 0.10;
  const maxBound = pageWidth * 0.45;

  for (let i = 1; i < merged.length; i++) {
    const gapLeft  = merged[i - 1][1]; // right edge del cluster sinistro
    const gapRight = merged[i][0];     // left edge del cluster destro
    const gapSize  = gapRight - gapLeft;

    if (gapLeft >= minBound && gapRight <= maxBound && gapSize > 0) {
      return gapRight;
    }
  }

  return 0;
}

// ── Ricostruzione righe dal layout fisico ─────────────────────────────────────
function buildLinesFromItems(items) {
  if (!items.length) return [];

  const filtered = items.filter(it => it.str && it.str.trim() !== "");
  const sorted   = [...filtered].sort(
    (a, b) => (b.transform[5] - a.transform[5]) || (a.transform[4] - b.transform[4])
  );

  const rows = [];
  let currentRow = null;
  let currentY   = null;

  for (const item of sorted) {
    const y = item.transform[5];
    const x = item.transform[4];
    if (currentY === null || Math.abs(y - currentY) > Y_TOLERANCE) {
      currentRow = [{ x, text: item.str, width: item.width || 0 }];
      currentY   = y;
      rows.push(currentRow);
    } else {
      currentRow.push({ x, text: item.str, width: item.width || 0 });
    }
  }

  return rows.map(row => {
    row.sort((a, b) => a.x - b.x);
    let line = "";
    for (let i = 0; i < row.length; i++) {
      if (i === 0) {
        line += row[i].text;
      } else {
        // Usa la larghezza reale se disponibile, altrimenti stima 5pt/char
        const prevWidth = row[i - 1].width > 0
          ? row[i - 1].width
          : row[i - 1].text.length * 5;
        const gap = row[i].x - (row[i - 1].x + prevWidth);
        line += (gap > X_GAP_SPACE ? "  " : "") + row[i].text;
      }
    }
    return line.trim();
  }).filter(Boolean);
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function extractTextFromPdf(file, onProgress) {
  const pdfjsLib = await import("pdfjs-dist");

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `${window.location.origin}/pdf.worker.min.mjs`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const rawLines      = [];
  const filteredLines = [];
  let   sidebarCutX   = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(Math.round(((pageNum - 1) / pdf.numPages) * 90));

    const page        = await pdf.getPage(pageNum);
    const viewport    = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items       = textContent.items || [];

    if (pageNum === 1) {
      sidebarCutX = detectSidebarBoundary(items, viewport.width);
    }

    // Grezzo — tutte le zone
    rawLines.push(...buildLinesFromItems(items));

    // Filtrato — solo corpo (x >= sidebarCutX se rilevato)
    const bodyItems = sidebarCutX > 0
      ? items.filter(it => it.transform[4] >= sidebarCutX)
      : items;
    filteredLines.push(...buildLinesFromItems(bodyItems));

    if (pageNum < pdf.numPages) {
      rawLines.push("");
      filteredLines.push("");
    }
  }

  onProgress?.(100);

  const rawText      = rawLines.join("\n");
  const filteredText = filteredLines.join("\n");
  const rawWc        = wordCount(rawText);
  const filteredWc   = wordCount(filteredText);
  const ratio        = rawWc > 0 ? filteredWc / rawWc : 0;

  if (sidebarCutX > 0 && (filteredWc < MIN_FILTERED_WORDS || ratio < MIN_FILTERED_RATIO)) {
    return rawText;
  }

  return filteredText;
}
