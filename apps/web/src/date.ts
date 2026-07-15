export function toDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string) {
  return new Date(value).toISOString();
}

export function startOfLocalDayIso(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}

export function endOfLocalDayIso(date: string) {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

export function todayDateInputValue() {
  return toDateTimeLocalValue(new Date()).slice(0, 10);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));
}
