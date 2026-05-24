// Shared response-embedded guidance. These strings are pasted verbatim into
// tool payloads so the model sees them every time, not just when it consults
// the methodology doc.

export const RANKING_CAVEAT = [
  "Raw rankings are useful for orientation, not for the headline.",
  "Watch for small-denominator volatility: a single agency-year with 23 stops can produce a 'top' search rate that flips next year.",
  "MSHP and a few large municipalities dominate raw counts. Rate metrics correct for that, but small agencies can still spike on rates.",
  "Look at a range (top 10–20), not just #1 vs #2 — relative order inside the top tier usually isn't stable.",
  "For rate-type metrics, the underlying count column is your guardrail. If it isn't returned, ask for it via query_metric or top_n_by.",
].join(" ");

// Push the model to cross-check what it's reporting against external sources
// before publishing, and — critically — to NOT fabricate those sources. The
// model is bad at this; the prompt is calibrated against the failure modes:
//   - inventing headlines, URLs, paper titles, quotes
//   - pretending an archive has coverage when it doesn't
//   - confident-sounding suggestions with no actual lookup
export const RESEARCH_PROMPT = [
  "If the user is doing reporting or research, push them to cross-check what this data shows against sources outside this dataset before publishing. The agency_slug, canonical_name, and year_range in these results are the specific search terms to start with.",
  "",
  "Angles that pay off:",
  "",
  "- LOCAL NEWS for the specific agency × year window. Missouri outlets: St. Louis Post-Dispatch, Kansas City Star, Springfield News-Leader, Columbia Missourian, regional weeklies. National outlets that cover policing: ProPublica, The Marshall Project. Coverage depth varies wildly — small-town agencies and pre-2010 years often have very thin archives. If a targeted search comes back empty, say so honestly; an honest null result is more useful than a vague hedge.",
  "- COURT RECORDS AND GOVERNMENT ACTIONS: DOJ Civil Rights Division consent decrees, state AG enforcement, federal civil-rights litigation. PACER and CourtListener are searchable; some require accounts.",
  "- ACADEMIC LITERATURE: the Further Reading section of read_methodology() is the curated, edited stable-link list. Cite from there, not from invented references.",
  "- LOCAL ADVOCACY REPORTS: ACLU of Missouri, NAACP MO chapters, named academic researchers.",
  "",
  "LIMITS. This server does NOT search the web or verify URLs. If your client has web-search tools, use them — and report what you actually find, including null results. If you don't, prompt the user to run the searches and feed back what they find.",
  "",
  "DO NOT INVENT specific headlines, URLs, paper titles, quotes, or incident details. A handful of verified sources beats a long list of plausible-sounding fabrications. If you can't verify a claim, name what you can't verify rather than papering over it.",
].join("\n");
