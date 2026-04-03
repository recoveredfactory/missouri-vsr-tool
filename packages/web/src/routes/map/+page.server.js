import { withDataBase } from "$lib/dataBase";

export async function load({ fetch }) {
  const dataBaseUrl = import.meta.env.PUBLIC_DATA_BASE_URL ?? "";

  try {
    const response = await fetch(
      withDataBase("/dist/statewide_slug_baselines.json", dataBaseUrl)
    );
    if (!response.ok) throw new Error(`${response.status}`);
    const baselines = await response.json();
    return { baselines };
  } catch {
    return { baselines: [] };
  }
}
