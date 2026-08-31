const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatDate(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : dateFormatter.format(date);
}

export function formatDateTime(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : `${dateTimeFormatter.format(date)} UTC`;
}
