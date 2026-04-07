/**
 * Time formatting utilities.
 * All times display in the user's local timezone.
 * Falls back to America/New_York (ET) if detection fails.
 */

const DEFAULT_TZ = "America/New_York";

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/** "7:00 PM" */
export function formatGameTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: getTimezone(),
  });
}

/** "7:00 PM ET" */
export function formatGameTimeWithZone(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: getTimezone(),
  });
}

/** "Mon, Apr 7" */
export function formatGameDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: getTimezone(),
  });
}

/** "Monday, Apr 7" */
export function formatGameDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: getTimezone(),
  });
}

/** "Mon, Apr 7 · 7:00 PM ET" */
export function formatGameDateTime(iso: string): string {
  return `${formatGameDate(iso)} · ${formatGameTimeWithZone(iso)}`;
}

/** Returns "Today", "Tomorrow", or "Mon, Apr 7" */
export function formatDateLabel(iso: string): string {
  const tz = getTimezone();
  const now = new Date();
  const gameDate = new Date(iso);

  const nowDate = now.toLocaleDateString("en-US", { timeZone: tz });
  const gameLocalDate = gameDate.toLocaleDateString("en-US", { timeZone: tz });

  if (gameLocalDate === nowDate) return "Today";

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toLocaleDateString("en-US", { timeZone: tz });
  if (gameLocalDate === tomorrowDate) return "Tomorrow";

  return formatGameDate(iso);
}
