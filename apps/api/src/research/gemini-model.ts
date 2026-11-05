// Owner-selected Gemini model. No lower-version Google model fallback is allowed.
export const CAPELA_GEMINI_MODEL = "gemini-3.8-flash";
export function isPinnedGeminiVersion(value: string) {
  return /^(?:publishers\/google\/models\/)?gemini-3\.8-flash(?:-[0-9][a-zA-Z0-9.-]*)?$/.test(value);
}
