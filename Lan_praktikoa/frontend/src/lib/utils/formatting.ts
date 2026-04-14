/**
 * Formats money values using a locale-aware integer formatter.
 *
 * Why: centralizing numeric formatting avoids subtle UI inconsistencies between
 * HUD, panels, and notifications during presentation and QA checks.
 */
export function formatMoney(value: number, locale = 'eu-ES'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}
