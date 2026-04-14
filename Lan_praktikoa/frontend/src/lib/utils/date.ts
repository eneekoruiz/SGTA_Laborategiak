/**
 * Converts a game date object into a compact HUD-safe string.
 *
 * Why: date formatting logic is shared by multiple views and should not be
 * duplicated in component scripts.
 */
export function formatGameDate(date: { year: number; month: number }): string {
  return `${date.year}/${String(date.month).padStart(2, '0')}`;
}
