import { withDataBase } from "$lib/dataBase";

export async function load({ fetch }) {
  const manifestResponse = await fetch(withDataBase("/data/dist/manifest.json"));
  const manifest = manifestResponse.ok ? await manifestResponse.json() : null;
  return { isEmbed: true, manifest };
}
