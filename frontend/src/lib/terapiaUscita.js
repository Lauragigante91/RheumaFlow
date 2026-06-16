export function buildTerapiaUscita({ regimen, modifica } = {}) {
  const mod = (modifica || "").trim();
  if (mod) return mod;
  const reg = (regimen || "").trim();
  if (reg) return `${reg}\n\n(invariata)`;
  return null;
}
