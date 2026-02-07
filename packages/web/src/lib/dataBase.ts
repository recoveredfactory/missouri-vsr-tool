const rawBaseUrl = import.meta.env.PUBLIC_DATA_BASE_URL ?? "";

const normalizeBaseUrl = (value: string) => {
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

export const dataBaseUrl = normalizeBaseUrl(rawBaseUrl);

export const withDataBase = (path: string) => {
  if (!dataBaseUrl) return path;
  if (!path) return dataBaseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${dataBaseUrl}${normalizedPath}`;
};
