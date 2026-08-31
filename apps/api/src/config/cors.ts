export function allowedWebOrigins(value?: string) {
  const origins = (value ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set(origins)];
}
