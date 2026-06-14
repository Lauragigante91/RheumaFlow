export function buildProfilePayload(fvOnly, aprAnalysis, comorbiditiesForReferto) {
  const payload = { ...fvOnly };
  if (aprAnalysis) {
    payload.comorbidities = comorbiditiesForReferto || {};
  } else {
    delete payload.comorbidities;
  }
  return payload;
}
