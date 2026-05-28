import { z } from "zod";

import { getProgram287gSnapshot } from "../db.js";
import {
  errorResult,
  inputSchemaFromZod,
  registerTool,
  textResult,
} from "./registry.js";

const SUPPORT_TYPES = [
  "Task Force Model",
  "Jail Enforcement Model",
  "Warrant Service Officer",
] as const;

const List287gInput = z.object({
  support_type: z
    .enum(SUPPORT_TYPES)
    .optional()
    .describe(
      "Filter to agencies whose agreements include this 287(g) model. An agency holding multiple agreement types appears under each. Omit to return every active participant.",
    ),
  county: z
    .string()
    .optional()
    .describe(
      "Case-insensitive exact-match filter on Missouri county (e.g. 'St. Louis County', 'Greene County').",
    ),
});

type List287gArgs = z.infer<typeof List287gInput>;

// The big-print methodology caveat. The user audience is journalists who
// will copy these names into stories — they need to understand that this
// is a point-in-time photograph of the ICE list, not a continuous record
// of who has ever participated. Surfaced in every response.
const AS_OF_CAVEATS = [
  "This list is a single point-in-time snapshot of ICE's published Participating Agencies file. It reflects who was ACTIVE on the snapshot date — nothing more.",
  "Agencies that signed AND terminated between snapshots are invisible here. If a department dropped out yesterday, we still have no record of that.",
  "Conversely, an agency that signed after the snapshot date does not appear yet. Always cite the snapshot_date when reporting these numbers.",
  "support_type counts can sum to more than n_participants because some agencies hold multiple agreement types (e.g. both Task Force Model and Jail Enforcement Model).",
];

const METHOD_EXPLAINER =
  "Active 287(g) participants are agencies with a current Memorandum of Agreement (MOA) signed with ICE under one of three program models: Task Force Model (TFM), Jail Enforcement Model (JEM), or Warrant Service Officer (WSO). This list is parsed from ICE's published Participating Agencies file (XLSX) on the snapshot date. ICE itself only publishes who is ACTIVE, so this server cannot tell you who has ever participated — only who participated on that snapshot date. https://www.ice.gov/identify-and-arrest/287g";

const handler = async (raw: unknown) => {
  const parsed = List287gInput.safeParse(raw);
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${parsed.error.message}`);
  }
  const args: List287gArgs = parsed.data;

  const snap = await getProgram287gSnapshot();

  const countyFilter = args.county?.toLowerCase().trim();
  let filtered = snap.participants;
  if (args.support_type) {
    const t = args.support_type;
    filtered = filtered.filter((p) => p.agreements.some((a) => a.support_type === t));
  }
  if (countyFilter) {
    filtered = filtered.filter((p) => (p.county ?? "").toLowerCase() === countyFilter);
  }

  return textResult(
    JSON.stringify(
      {
        snapshot_date: snap.snapshot_date,
        snapshot_source:
          `ICE Participating Agencies file (${snap.snapshot_filename}) — https://www.ice.gov/identify-and-arrest/287g`,
        n_participants_total: snap.n_participants,
        n_participants_matching: filtered.length,
        filters: {
          support_type: args.support_type ?? null,
          county: args.county ?? null,
        },
        support_type_counts_all_participants: snap.support_type_counts,
        as_of_caveats: AS_OF_CAVEATS,
        method_explainer: METHOD_EXPLAINER,
        participants: filtered,
      },
      null,
      2,
    ),
  );
};

registerTool({
  name: "list_287g_participants",
  description:
    "Returns Missouri law-enforcement agencies that are ACTIVE 287(g) participants as of ICE's most-recent published snapshot. Each entry carries the support model(s) (Task Force, Jail Enforcement, Warrant Service Officer), MOA signed_date, and MOA PDF URL. Always surface the snapshot_date and the as_of_caveats — this is a point-in-time list, not a complete history. Agencies that have terminated between snapshots are NOT visible. Filter by support_type or county for narrower lookups.",
  inputSchema: inputSchemaFromZod(List287gInput),
  handler,
});
