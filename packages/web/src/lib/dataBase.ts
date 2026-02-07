const normalizeBaseUrl = (value: string) => {
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const getRuntimeBaseUrl = () => {
  if (typeof globalThis !== "undefined") {
    const runtime = (globalThis as typeof globalThis & { __DATA_BASE_URL__?: string })
      .__DATA_BASE_URL__;
    if (typeof runtime === "string" && runtime) return runtime;
  }
  return normalizeBaseUrl(import.meta.env.PUBLIC_DATA_BASE_URL ?? "");
};

export const setDataBaseUrl = (value: string) => {
  if (typeof globalThis === "undefined") return;
  const normalized = normalizeBaseUrl(value ?? "");
  (globalThis as typeof globalThis & { __DATA_BASE_URL__?: string }).__DATA_BASE_URL__ =
    normalized;
};

export const withDataBase = (path: string, overrideBase?: string) => {
  const baseUrl = normalizeBaseUrl(overrideBase ?? getRuntimeBaseUrl());
  if (!baseUrl) return path;
  if (!path) return baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const strippedPath = normalizedPath.startsWith("/data/")
    ? normalizedPath.slice("/data".length)
    : normalizedPath;
  return `${baseUrl}${strippedPath}`;
};
