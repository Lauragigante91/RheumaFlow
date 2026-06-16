export function buildTerapiaUscita({ refertoText, ricostruito } = {}) {
  const ref = (refertoText || "").trim();
  if (ref) return ref;
  const rec = (ricostruito || "").trim();
  if (rec) return `(ricostruito)\n${rec}`;
  return null;
}
