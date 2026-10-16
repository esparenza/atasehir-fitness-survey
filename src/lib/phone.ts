/** Telefonu 905xxxxxxxxx formatına çevirir. Geçersizse null döner. */
export function normalizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("90") && d.length === 12) return d;
  if (d.startsWith("0") && d.length === 11) return "90" + d.slice(1);
  if (d.length === 10 && d.startsWith("5")) return "90" + d;
  // Excel'in bilimsel gösterimi vb. bozulmalar veya yabancı numaralar
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}
