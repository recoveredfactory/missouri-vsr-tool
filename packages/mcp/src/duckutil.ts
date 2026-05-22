// DuckDB's node-api returns list-typed values as `{ items: T[] }`. Recursively
// unwrap those, convert BigInts to Numbers (or strings when out of safe
// range), and walk into nested objects.
export const normalize = (value: unknown): unknown => {
  if (typeof value === "bigint") {
    return value > BigInt(Number.MAX_SAFE_INTEGER) ||
      value < BigInt(Number.MIN_SAFE_INTEGER)
      ? value.toString()
      : Number(value);
  }
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (
      "items" in obj &&
      Array.isArray(obj.items) &&
      Object.keys(obj).length === 1
    ) {
      return obj.items.map(normalize);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = normalize(v);
    return out;
  }
  return value;
};
