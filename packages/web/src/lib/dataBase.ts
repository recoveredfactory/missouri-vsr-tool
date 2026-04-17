const normalizeBaseUrl = (value: string) => {
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const defaultDevBaseUrl = "https://data.vsr.recoveredfactory.net";
const defaultDevReleasePath = "/releases/v2";

const getBaseUrl = (overrideBase?: string) => {
  const envBase = normalizeBaseUrl(overrideBase ?? (import.meta.env.PUBLIC_DATA_BASE_URL ?? ""));
  if (envBase) return envBase;
  return import.meta.env.DEV ? defaultDevBaseUrl : "";
};

const getReleasePath = () =>
  normalizeBaseUrl(import.meta.env.PUBLIC_DATA_RELEASE_PATH ?? (import.meta.env.DEV ? defaultDevReleasePath : ""));

export const withDataBase = (path: string, overrideBase?: string) => {
  const baseUrl = getBaseUrl(overrideBase);
  if (!baseUrl) return path;
  if (!path) return baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const strippedPath = normalizedPath.startsWith("/data/")
    ? normalizedPath.slice("/data".length)
    : normalizedPath;
  return `${baseUrl}${getReleasePath()}${strippedPath}`;
};
