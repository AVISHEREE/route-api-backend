export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isValidDateString(value) {
  if (!isNonEmptyString(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function isObject(value) {
  return value !== null && typeof value === "object";
}

export function isArray(value) {
  return Array.isArray(value);
}
