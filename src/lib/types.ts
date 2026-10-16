export type SurveyStatus =
  | "bekliyor"
  | "davet_gonderildi"
  | "devam_ediyor"
  | "tamamlandi"
  | "reddetti";

export type Sentiment = "pozitif" | "notr" | "negatif";

export interface Analysis {
  overall_score: number;
  equipment_score: number;
  hygiene_score: number;
  staff_score: number;
  sentiment: Sentiment;
  summary: string;
  critical_alert: boolean;
  created_at: string;
}

export interface MemberRow {
  id: string;
  full_name: string;
  phone_number: string;
  survey_status: SurveyStatus;
  created_at: string;
  analysis: Analysis | null;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  content: string;
  created_at: string;
}

export interface DashboardPayload {
  configured: boolean;
  members: MemberRow[];
}

export const STATUS_LABELS: Record<SurveyStatus, string> = {
  bekliyor: "Bekliyor",
  davet_gonderildi: "Davet Gönderildi",
  devam_ediyor: "Devam Ediyor",
  tamamlandi: "Tamamlandı",
  reddetti: "Reddetti",
};
