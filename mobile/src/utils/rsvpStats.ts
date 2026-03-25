/**
 * Coerce API RSVP aggregates (snake_case; sometimes string numbers) for list UIs.
 */
export type RsvpStatsNormalized = {
  accepted: number;
  declined: number;
  maybe: number;
  invited: number;
  no_response: number;
  proposed_new_time: number;
  total: number;
};

function num(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function normalizeRsvpStats(raw: unknown): RsvpStatsNormalized | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const out: RsvpStatsNormalized = {
    accepted: num(s.accepted),
    declined: num(s.declined),
    maybe: num(s.maybe),
    invited: num(s.invited),
    no_response: num(s.no_response),
    proposed_new_time: num(s.proposed_new_time),
    total: num(s.total),
  };
  if (out.total === 0 && out.accepted + out.declined + out.maybe + out.invited + out.no_response > 0) {
    out.total = out.accepted + out.declined + out.maybe + out.invited + out.no_response;
  }
  return out;
}

/** Invitees who have not accepted or declined (includes maybe / no response / invited). */
export function pendingInviteCount(stats: {
  total: number;
  accepted: number;
  declined: number;
}): number {
  return Math.max(0, stats.total - stats.accepted - stats.declined);
}
