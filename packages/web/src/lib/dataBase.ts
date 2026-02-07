const normalizeBaseUrl = (value: string) => {
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const getBaseUrl = (overrideBase?: string) =>
  normalizeBaseUrl(overrideBase ?? (import.meta.env.PUBLIC_DATA_BASE_URL ?? ""));

export const withDataBase = (path: string, overrideBase?: string) => {
  const baseUrl = getBaseUrl(overrideBase);
  if (!baseUrl) return path;
  if (!path) return baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const strippedPath = normalizedPath.startsWith("/data/")
    ? normalizedPath.slice("/data".length)
    : normalizedPath;
  return `${baseUrl}${strippedPath}`;
};
