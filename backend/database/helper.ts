export function toMySqlTimestamp(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid run timestamp: ${value}`);
  }

  return date.toISOString().slice(0, 23).replace("T", " ");
}