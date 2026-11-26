export function now() {
  return new Date().toISOString();
}

export function normalizeTimestamp(value: string | Date | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          /(?:Z|[+-]\d{2}:?\d{2})$/.test(value.trim())
            ? value
            : `${value.trim().replace(" ", "T")}Z`,
        );
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function elapsedSince(timestamp: string) {
  const timestampMs = Date.parse(timestamp);
  return Number.isFinite(timestampMs)
    ? Math.max(0, Date.now() - timestampMs)
    : 0;
}

export function percentile(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);

  const index = (percentile / 100) * (sorted.length - 1);

  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;

  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

export function toBigIntMilliseconds(value: number) {
  return BigInt(Math.round(value));
}
