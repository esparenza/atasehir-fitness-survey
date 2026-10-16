import type { MemberRow } from "./types";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function computeStats(members: MemberRow[]) {
  const reached = members.filter((m) => m.survey_status !== "bekliyor");
  const completed = members.filter((m) => m.survey_status === "tamamlandi");
  const an = members.flatMap((m) => (m.analysis ? [m.analysis] : []));
  return {
    reached: reached.length,
    completed: completed.length,
    completionRate: reached.length ? Math.round((completed.length / reached.length) * 100) : 0,
    overall: avg(an.map((a) => a.overall_score)),
    equipment: avg(an.map((a) => a.equipment_score)),
    hygiene: avg(an.map((a) => a.hygiene_score)),
    staff: avg(an.map((a) => a.staff_score)),
    critical: an.filter((a) => a.critical_alert).length,
    pending: members.filter((m) => m.survey_status === "bekliyor").length,
    sentiments: {
      pozitif: an.filter((a) => a.sentiment === "pozitif").length,
      notr: an.filter((a) => a.sentiment === "notr").length,
      negatif: an.filter((a) => a.sentiment === "negatif").length,
    },
  };
}
