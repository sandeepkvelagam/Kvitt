/**
 * Compact display strings for GameThreadChat metadata (date + optional time).
 */

export type GameWhenFields = {
  status?: string;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** Normalize API shapes (snake_case + occasional camelCase). */
function iso(
  g: GameWhenFields & Record<string, unknown>,
  snake: keyof GameWhenFields,
  camel: string
): string | null | undefined {
  const a = g[snake];
  if (a != null && String(a).trim() !== "") return a as string;
  const b = g[camel];
  if (b != null && String(b).trim() !== "") return String(b);
  return null;
}

function parseDate(iso: string | undefined | null): Date | null {
  if (iso == null || String(iso).trim() === "") return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** English-style ordinal: 1st, 2nd, 3rd, 4th, 11th, 12th, … */
export function ordinalDay(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

/**
 * Pick the primary instant for "when" display per game status, then format:
 * `Fri 12th Mar '26` and optionally ` · 7:30 PM` in local time.
 */
export function formatGameWhenDisplay(game: GameWhenFields): string | null {
  const g = game as GameWhenFields & Record<string, unknown>;
  const st = game.status || "";

  const scheduled = iso(g, "scheduled_at", "scheduledAt");
  const started = iso(g, "started_at", "startedAt");
  const ended = iso(g, "ended_at", "endedAt");
  const created = iso(g, "created_at", "createdAt");
  const updated = iso(g, "updated_at", "updatedAt");

  let raw: string | null | undefined;
  let d: Date | null = null;

  if (st === "scheduled" && scheduled) {
    raw = scheduled;
    d = parseDate(raw);
  } else if (st === "active" && started) {
    raw = started;
    d = parseDate(raw);
  } else if ((st === "ended" || st === "settled") && ended) {
    raw = ended;
    d = parseDate(raw);
  } else {
    raw = scheduled || started || ended || created || updated;
    d = parseDate(raw);
  }

  if (!d) return null;

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const wd = weekdays[d.getDay()];
  const mo = months[d.getMonth()];
  const ord = ordinalDay(d.getDate());
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  let line = `${wd} ${ord} ${mo} '${yy}`;

  const hasLocalTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  const showTime = st === "scheduled" || hasLocalTime;

  if (showTime) {
    line += ` · ${d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return line;
}
