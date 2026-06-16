export function buildTerapiaUscita({ originalText, regimen, exitText } = {}) {
  const original = (originalText || "").trim();
  if (original) return original;
  const exit = (exitText || "").trim();
  if (exit) return exit;
  const reg = (regimen || "").trim();
  if (reg) return `${reg}\n\n(invariata)`;
  return null;
}
