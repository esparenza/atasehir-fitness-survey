import { GoogleGenAI, Type } from "@google/genai";
import type { Sentiment } from "./types";

const MODEL = "gemini-2.5-flash";
export const END_TOKEN = "[ANKET_BITTI]";

export const CHAT_SYSTEM_PROMPT = `Sen Ataşehir Fitness'ın samimi, enerjik ve çözüm odaklı üye ilişkileri asistanısın. Üyeyle WhatsApp üzerinden konuşuyorsun. Mesajların kısa, samimi ve emoji destekli olsun (robot gibi uzun paragraflar yazma). Amacın üyeyi sıkmadan şu 3 konuda fikrini öğrenmek: 1) Ekipmanların yeterliliği ve salon düzeni, 2) Soyunma odaları, duşlar ve genel temizlik, 3) Eğitmenlerin ve resepsiyonun ilgisi. Soruları tek tek sor, üye cevap verdikçe empati kurarak diğer soruya geç. 3 konuyu da öğrendiğinde veya üye sohbeti bitirmek istediğinde teşekkür et ve cevabının sonuna gizli bir belirteç olarak \`${END_TOKEN}\` ekle.`;

function ai() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY eksik.");
  return new GoogleGenAI({ apiKey });
}

export interface HistoryItem {
  sender: "user" | "bot";
  content: string;
}

/** Gemini ilk içeriğin 'user' olmasını ister; baştaki bot (davet) mesajlarını atar. */
function toContents(history: HistoryItem[]) {
  const items = [...history];
  while (items.length && items[0].sender === "bot") items.shift();
  return items.map((m) => ({
    role: m.sender === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
}

export async function generateChatReply(history: HistoryItem[]): Promise<string> {
  const res = await ai().models.generateContent({
    model: MODEL,
    contents: toContents(history),
    config: { systemInstruction: CHAT_SYSTEM_PROMPT, temperature: 0.8 },
  });
  return (res.text ?? "").trim();
}

export interface AnalysisResult {
  overall_score: number;
  equipment_score: number;
  hygiene_score: number;
  staff_score: number;
  sentiment: Sentiment;
  summary: string;
  critical_alert: boolean;
}

const clamp = (n: unknown) => Math.min(10, Math.max(1, Math.round(Number(n) || 5)));

export async function analyzeConversation(history: HistoryItem[]): Promise<AnalysisResult> {
  const transcript = history
    .map((m) => `${m.sender === "user" ? "ÜYE" : "ASİSTAN"}: ${m.content.replace(END_TOKEN, "").trim()}`)
    .join("\n");

  const res = await ai().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Aşağıda bir spor salonu üyesi ile memnuniyet anketi asistanı arasındaki WhatsApp konuşması var. Konuşmayı analiz et.
- Puanlar 1-10 arası tam sayı. Üye bir konuya değinmediyse genel tona göre makul tahmin yap.
- sentiment: pozitif, notr veya negatif.
- summary: yönetici için Türkçe 2-3 cümlelik özet.
- critical_alert: üye salonu bırakmayı düşünüyorsa veya çok ciddi bir şikayeti varsa true.

KONUŞMA:
${transcript}`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overall_score: { type: Type.INTEGER },
          equipment_score: { type: Type.INTEGER },
          hygiene_score: { type: Type.INTEGER },
          staff_score: { type: Type.INTEGER },
          sentiment: { type: Type.STRING, enum: ["pozitif", "notr", "negatif"] },
          summary: { type: Type.STRING },
          critical_alert: { type: Type.BOOLEAN },
        },
        required: [
          "overall_score",
          "equipment_score",
          "hygiene_score",
          "staff_score",
          "sentiment",
          "summary",
          "critical_alert",
        ],
        propertyOrdering: [
          "overall_score",
          "equipment_score",
          "hygiene_score",
          "staff_score",
          "sentiment",
          "summary",
          "critical_alert",
        ],
      },
    },
  });

  const p = JSON.parse(res.text ?? "{}");
  const sentiment: Sentiment = ["pozitif", "notr", "negatif"].includes(p.sentiment)
    ? p.sentiment
    : "notr";
  return {
    overall_score: clamp(p.overall_score),
    equipment_score: clamp(p.equipment_score),
    hygiene_score: clamp(p.hygiene_score),
    staff_score: clamp(p.staff_score),
    sentiment,
    summary: String(p.summary ?? ""),
    critical_alert: Boolean(p.critical_alert),
  };
}
