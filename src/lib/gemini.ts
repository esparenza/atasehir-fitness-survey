import { GoogleGenAI, Type } from "@google/genai";
import type { Sentiment } from "./types";

const MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash"];
export const END_TOKEN = "[ANKET_BITTI]";

export const CHAT_SYSTEM_PROMPT = `Sen Ataşehir Fitness'ın samimi, enerjik ve çözüm odaklı üye ilişkileri asistanısın. Üyeyle WhatsApp üzerinden konuşuyorsun.
Kurallar:
- Mesajların kısa, doğal, samimi ve ölçülü emoji destekli olsun (robot gibi uzun paragraflar yazma, en fazla 2-3 kısa cümle kur).
- Eğer konuşma geçmişinde üyeye zaten selam verdiysen tekrar "Merhaba ben Ataşehir Fitness asistanıyım" diyerek baştan tanışma, doğrudan sohbete devam et.
- Amacın üyeyi sıkmadan şu 3 konuda fikrini öğrenmek:
  1) Ekipmanların yeterliliği ve salon düzeni
  2) Soyunma odaları, duşlar ve genel temizlik
  3) Eğitmenlerin ve resepsiyonun ilgisi
- Soruları TEK TEK sor. Aynı mesajda birden fazla soru sorma.
- Üye bir cevabında birden fazla konudan bahsettiyse o konuyu tekrar sorma, yalnızca konuşulmayan konuya geç.
- 3 konunun tamamı hakkında fikir aldığında veya üye sohbeti sonlandırmak istediğinde yeni soru sorma; samimi şekilde teşekkür et ve cevabının en sonuna gizli belirteç olarak mutlaka ${END_TOKEN} ekle.`;

function ai() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY eksik.");
  return new GoogleGenAI({ apiKey });
}

export interface HistoryItem {
  sender: "user" | "bot";
  content: string;
}

/**
 * Gemini API ilk mesajın 'user' olmasını ve rollerin sırayla (user/model) gitmesini ister.
 * - İlk mesaj 'bot' ise (örn. kampanya daveti), başına sentetik bir başlangıç ekleriz ki bot kendi davetini görsün.
 * - Arka arkaya gelen aynı rollü mesajları (örn. üyenin üst üste yazdığı 2 mesaj) tek blokta birleştiririz.
 */
export function toContents(history: HistoryItem[]) {
  const valid = history.filter((m) => m.content && m.content.trim().length > 0);
  if (valid.length === 0) {
    return [{ role: "user", parts: [{ text: "Merhaba" }] }];
  }

  const merged: { role: "user" | "model"; text: string }[] = [];

  if (valid[0].sender === "bot") {
    merged.push({ role: "user", text: "Merhaba, anket davetinizi aldım." });
  }

  for (const m of valid) {
    const role = m.sender === "user" ? "user" : "model";
    const cleanText = m.content.replace(END_TOKEN, "").trim();
    if (!cleanText) continue;

    const last = merged[merged.length - 1];
    if (last && last.role === role) {
      last.text += `\n${cleanText}`;
    } else {
      merged.push({ role, text: cleanText });
    }
  }

  // Son mesajın 'user' olduğundan emin ol
  if (merged.length === 0 || merged[merged.length - 1].role !== "user") {
    merged.push({ role: "user", text: "Devam edelim." });
  }

  return merged.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
}

async function generateWithFallback(params: {
  contents: any;
  config: Record<string, any>;
}) {
  const client = ai();
  let lastErr: unknown;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await client.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        if (res.text && res.text.trim()) return res;
      } catch (err: any) {
        lastErr = err;
        const status = err?.status ?? err?.code;
        // 503 (Yoğunluk) veya 429 (Limit) durumunda kısa bekleyip tekrar / yedek modeli dene
        if (status === 503 || status === 429) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
        break;
      }
    }
  }
  throw lastErr ?? new Error("Gemini yanıt üretemedi.");
}

export async function generateChatReply(
  history: HistoryItem[],
  memberName?: string
): Promise<string> {
  const cleanName =
    memberName && memberName !== "WhatsApp Üyesi" ? memberName.trim().split(/\s+/)[0] : null;
  const nameInstruction = cleanName
    ? `\nÜyenin adı: ${cleanName}. Uygun yerlerde ismiyle samimi şekilde hitap et.`
    : "";

  const res = await generateWithFallback({
    contents: toContents(history),
    config: {
      systemInstruction: CHAT_SYSTEM_PROMPT + nameInstruction,
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 0 },
    },
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

  const res = await generateWithFallback({
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
      thinkingConfig: { thinkingBudget: 0 },
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

  let p: Record<string, any> = {};
  try {
    p = JSON.parse(res.text ?? "{}");
  } catch {
    p = {};
  }
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
