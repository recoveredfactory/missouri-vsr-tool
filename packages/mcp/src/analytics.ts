// Server-side Umami analytics for tool dispatch.
//
// Privacy posture (see read_methodology() for the user-facing version):
//   - We send one event per tools/call to Umami's /api/send endpoint.
//   - Event payload: { tool, duration_ms, error_class, stage }. No tool
//     arguments, no agency identifiers from the result, no client IP,
//     no MCP session ID — nothing that could fingerprint a user or their
//     pre-publication research.
//   - We deliberately do NOT also send a pageview. Custom events are the
//     only record; the Pages dashboard stays empty by design. Reason:
//     pageviews would suggest browser-like "session traffic" semantics
//     that don't apply to a tool-call API, and they'd double the analytics
//     request volume for no extra signal.
//   - We send a constant User-Agent so Umami's own visitor-fingerprinting
//     collapses all MCP events into one synthetic "visitor". The dashboard
//     gets aggregate counts; it cannot distinguish 100 users × 1 call from
//     1 user × 100 calls. The "Mozilla/5.0" prefix is required to clear
//     Umami's isbot filter — a bare "missouri-vsr-mcp/1.0" was getting
//     silently dropped (Umami returns `{"beep":"boop"}` for filtered hits).
//   - Fire-and-forget: never awaited, never throws into the caller, never
//     logs the payload on failure. If Umami is down, we lose the event
//     and move on — we explicitly chose NOT to dual-log to CloudWatch.

const UMAMI_HOST = process.env.MCP_UMAMI_HOST || "cloud.umami.is";
const UMAMI_WEBSITE_ID = process.env.MCP_UMAMI_WEBSITE_ID || "";
const STAGE = process.env.SST_STAGE || "unknown";

// Synthetic hostname per stage so the Umami dashboard groups prod and
// staging traffic separately even though they share a website ID.
const SYNTHETIC_HOSTNAME =
  STAGE === "prod" || STAGE === "production"
    ? "mcp.vsr.recoveredfactory.net"
    : "mcp-staging.vsr.recoveredfactory.net";

export interface ToolCallEvent {
  tool: string;
  durationMs: number;
  errorClass: string | null;
}

export const trackToolCall = (event: ToolCallEvent): void => {
  if (!UMAMI_WEBSITE_ID) return;

  const body = JSON.stringify({
    type: "event",
    payload: {
      website: UMAMI_WEBSITE_ID,
      hostname: SYNTHETIC_HOSTNAME,
      url: `/mcp/${event.tool}`,
      name: "mcp_tool_call",
      data: {
        tool: event.tool,
        duration_ms: event.durationMs,
        error_class: event.errorClass ?? "ok",
        stage: STAGE,
      },
      language: "en",
      screen: "0x0",
    },
  });

  fetch(`https://${UMAMI_HOST}/api/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Constant UA so Umami treats all MCP traffic as one visitor.
      // Must start with "Mozilla/5.0" — Umami's isbot filter drops anything
      // that doesn't look browser-shaped, even though the rest of this UA
      // is openly self-identifying as an MCP client.
      "User-Agent": "Mozilla/5.0 (MCP) missouri-vsr-mcp/1.0",
    },
    body,
  }).catch((err: unknown) => {
    // Error class only, never the payload — re-logging the payload would
    // re-create the very side-channel we set up Umami-only to avoid.
    const cls =
      err instanceof Error ? err.name : typeof err;
    console.error("umami_send_failed", cls);
  });
};
