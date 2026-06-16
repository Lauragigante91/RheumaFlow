export function buildTerapiaUscita({ regimen, exitText } = {}) {
  const exit = (exitText || "").trim();
  if (exit) return exit;
  const reg = (regimen || "").trim();
  if (reg) return `${reg}\n\n(invariata)`;
  return null;
}
