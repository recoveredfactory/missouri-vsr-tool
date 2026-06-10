import { loadInitialImpressions2025 } from "$lib/analysis/initialImpressions2025";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch }) => {
  const analysis = await loadInitialImpressions2025(fetch);
  return { analysis };
};
