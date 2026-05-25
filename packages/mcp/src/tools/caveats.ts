// Shared response-embedded guidance. These strings are pasted verbatim into
// tool payloads so the model sees them every time, not just when it consults
// the methodology doc.

export const RANKING_CAVEAT = [
  "Raw rankings are useful for orientation, not for the headline.",
  "Watch for small-denominator volatility: a single agency-year with 23 stops can produce a 'top' search rate that flips next year.",
  "MSHP and a few large municipalities dominate raw counts. Rate metrics correct for that, but small agencies can still spike on rates.",
  "Look at a range (top 10–20), not just #1 vs #2 — relative order inside the top tier usually isn't stable.",
  "For rate-type metrics, the underlying count column is your guardrail. If it isn't returned, ask for it via query_metric or top_n_by.",
  "Every per-agency row in this response includes total_stops_in_window so you can self-judge volatility. Treat any row with the low_volume_warning flag set with EXPLICIT skepticism in your answer — don't quote its rank without saying it's small.",
].join(" ");

// Volume thresholds for the orthogonal min_total_stops filter and the per-row
// low_volume_warning flag. These are journalism-quality calibrations, not
// statistical minimums: 500 stops in a 5-year window is ~1 stop every 4 days
// (knocks out micros); 2500 is roughly the floor below which per-race shares
// stop being directly quotable.
export const DEFAULT_MIN_TOTAL_STOPS = 500;
export const LOW_VOLUME_WARNING_THRESHOLD = 2500;

// Prepended to a tool description when it accepts the min_total_stops knob.
// The strong language is intentional — see the SERVER_INSTRUCTIONS for
// matching guidance pushing the LLM to ask the user before running.
export const MIN_TOTAL_STOPS_DESCRIPTION = `Orthogonal filter on the agency's total stop volume in the year window — independent of any metric-specific denominator. Defaults to ${DEFAULT_MIN_TOTAL_STOPS} (~1 stop every 4 days in a 5-year window, knocks out micros). BEFORE calling this tool, if the user has not already specified a volume floor anywhere in the conversation, you SHOULD pause and ask them: "Do you want to restrict to agencies of a certain stop volume? Smaller agencies produce highly volatile values. Common journalism thresholds: 2500 (excludes the smallest), 5000 (small-to-medium and up), 10000 (medium and up), or no floor for a complete-distribution view." Set to 0 for no floor.`;

export interface AgencyVolumeFlags {
  total_stops_in_window: number;
  low_volume_warning: boolean;
}

// Compute a per-row low-volume flag from a stop count in the window.
export const flagsFor = (stopsInWindow: number): AgencyVolumeFlags => ({
  total_stops_in_window: stopsInWindow,
  low_volume_warning: stopsInWindow < LOW_VOLUME_WARNING_THRESHOLD,
});

// Render a LOUD, response-level warning string when some of the returned
// agencies are below the warning threshold. Returns null if everyone is
// safely above the threshold.
export const buildLowVolumeSummary = (
  agencies: Array<{ canonical_name?: unknown; total_stops_in_window: number }>,
): string | null => {
  const low = agencies.filter(
    (a) => a.total_stops_in_window < LOW_VOLUME_WARNING_THRESHOLD,
  );
  if (low.length === 0) return null;
  const names = low
    .slice(0, 8)
    .map((a) => `${String(a.canonical_name ?? "?")} (${a.total_stops_in_window} stops)`)
    .join("; ");
  const moreCount = low.length > 8 ? ` … and ${low.length - 8} more` : "";
  return [
    `⚠️ LOW-VOLUME WARNING: ${low.length} of ${agencies.length} agencies in this response filed FEWER THAN ${LOW_VOLUME_WARNING_THRESHOLD} total stops in the window.`,
    `Their per-race shares and rates are HIGHLY VOLATILE — a handful of stops can shift the share by tens of percentage points.`,
    `Do NOT lead with these agencies. If you quote them, name them as low-volume and pair the figure with the raw count.`,
    `Low-volume agencies returned: ${names}${moreCount}.`,
    `To exclude them entirely, re-run with min_total_stops=${LOW_VOLUME_WARNING_THRESHOLD} (or higher: 5000 / 10000 are common journalism thresholds).`,
  ].join(" ");
};

// Push the model to cross-check what it's reporting against external sources
// before publishing, and — critically — to NOT fabricate those sources. The
// model is bad at this; the prompt is calibrated against the failure modes:
//   - inventing headlines, URLs, paper titles, quotes
//   - pretending an archive has coverage when it doesn't
//   - confident-sounding suggestions with no actual lookup
export const RESEARCH_PROMPT = [
  "If the user is doing reporting or research, push them to cross-check what this data shows against sources outside this dataset before publishing. The agency_slug, canonical_name, and year_range in these results are the specific search terms to start with.",
  "",
  "Starting points — not an exhaustive list. Any trustworthy outlet, group, or document counts:",
  "",
  "- COURT RECORDS AND GOVERNMENT ACTIONS — high-value and often underused. DOJ Civil Rights Division consent decrees, state AG enforcement, federal civil-rights litigation, settlements. PACER and CourtListener are searchable (some require accounts); Missouri state court records are on Casenet.",
  "- FOIA / SUNSHINE-LAW REQUESTS to the agency itself OR to the Missouri Attorney General's office (the AG receives the underlying filings and may have correspondence, audit notes, or unpublished agency comments). Records on disciplinary actions, internal stop-data reviews, training materials, and policies are typically obtainable but not online — they have to be asked for.",
  "- ADVOCACY AND CIVIL-RIGHTS GROUPS working on Missouri policing: ACLU of Missouri, NAACP Missouri chapters, Empower Missouri. They publish reports, file litigation, and often have institutional memory on specific agencies.",
  "- LOCAL NEWS for the specific agency × year window. Print: St. Louis Post-Dispatch, Kansas City Star, Springfield News-Leader, Columbia Missourian, regional weeklies. Public media is usually strong: STLPR / St. Louis Public Radio, KCUR, KBIA, KSMU. National outlets that cover policing: ProPublica, The Marshall Project. Coverage depth varies wildly — small-town agencies and pre-2010 years often have very thin archives. If a targeted search comes back empty, say so honestly; an honest null result is more useful than a vague hedge.",
  "- ACADEMIC LITERATURE AND REFORM CONTEXT: the Further Reading section of read_methodology() is the curated, edited stable-link list. It includes Missouri-specific context — Ferguson DOJ investigation (2015), Missouri SB 5 / RSMo 479.359 (the post-Ferguson municipal court revenue cap), ArchCity Defenders' 'muny shuffle' research, the Missouri State Auditor's municipal audits, DOJ Civil Rights Division pattern-or-practice cases, and the Missouri Sunshine Law. If you reference any of these in your answer, LINK to the entry in Further Reading rather than naming it without a URL. Do not write reporting context like 'covered extensively after Ferguson 2014' or 'SB 5 capped traffic-fine revenue' without the actual link.",
  "",
  "LIMITS. This server does NOT search the web or verify URLs. If your client has web-search tools, use them — and report what you actually find, including null results. If you don't, prompt the user to run the searches and feed back what they find. Also encourage them to file FOIA requests where the answer they need isn't online; that's often the most important thing they can do.",
  "",
  "DO NOT INVENT specific headlines, URLs, paper titles, quotes, or incident details. A handful of verified sources beats a long list of plausible-sounding fabrications. If you can't verify a claim, name what you can't verify rather than papering over it.",
].join("\n");
