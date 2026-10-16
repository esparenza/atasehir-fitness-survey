import type { Analysis, ChatMessage, MemberRow, SurveyStatus } from "./types";

const day = 86_400_000;
const ago = (d: number, h = 0) => new Date(Date.now() - d * day - h * 3_600_000).toISOString();

type Seed = [string, string, SurveyStatus, [number, number, number, number]?, string?, boolean?];

const SEEDS: Seed[] = [
  ["Ahmet Yılmaz", "905551110001", "tamamlandi", [9, 9, 9, 10], "Üye salondan çok memnun; özellikle eğitmen Can'ın ilgisini övüyor. Ekipman ve temizlikte sorun yok.", false],
  ["Elif Demir", "905551110002", "tamamlandi", [6, 5, 7, 7], "Yoğun saatlerde squat rack ve koşu bandı yetersiz kalıyor. Diğer konularda genel olarak memnun.", false],
  ["Burak Kaya", "905551110003", "tamamlandi", [2, 4, 1, 2], "Duşlarda sıcak su sorunu ve soyunma odası hijyeninden çok şikayetçi. Üyeliğini yenilemeyi düşünmüyor.", true],
  ["Zeynep Arslan", "905551110004", "tamamlandi", [8, 8, 9, 7], "Temizlikten çok memnun, resepsiyon biraz daha güler yüzlü olabilir.", false],
  ["Mehmet Çelik", "905551110005", "tamamlandi", [10, 10, 9, 10], "Salon düzeni ve ekipman kalitesine tam puan veriyor, arkadaşlarına tavsiye ediyor.", false],
  ["Selin Aydın", "905551110006", "tamamlandi", [5, 6, 4, 6], "Soyunma dolapları yetersiz ve havalandırma kötü. Eğitmenler ilgili.", false],
  ["Can Öztürk", "905551110007", "tamamlandi", [3, 3, 5, 2], "Eğitmenlerin ilgisizliğinden ve bozuk ekipmanların uzun süre tamir edilmemesinden şikayetçi; başka salona geçmeyi düşünüyor.", true],
  ["Deniz Şahin", "905551110008", "tamamlandi", [7, 7, 8, 6], "Genel olarak memnun, grup dersleri çeşitlenirse daha iyi olur.", false],
  ["Merve Koç", "905551110009", "devam_ediyor"],
  ["Emre Polat", "905551110010", "devam_ediyor"],
  ["Ayşe Güneş", "905551110011", "davet_gonderildi"],
  ["Oğuz Tan", "905551110012", "reddetti"],
  ["Büşra Erdem", "905551110013", "bekliyor"],
  ["Kerem Aksoy", "905551110014", "bekliyor"],
  ["Gizem Yıldız", "905551110015", "bekliyor"],
];

export const MOCK_MEMBERS: MemberRow[] = SEEDS.map(([name, phone, status, sc, summary, crit], i) => {
  const analysis: Analysis | null = sc
    ? {
        overall_score: sc[0],
        equipment_score: sc[1],
        hygiene_score: sc[2],
        staff_score: sc[3],
        sentiment: sc[0] >= 8 ? "pozitif" : sc[0] >= 5 ? "notr" : "negatif",
        summary: summary!,
        critical_alert: !!crit,
        created_at: ago(i % 6),
      }
    : null;
  return {
    id: `mock-${i + 1}`,
    full_name: name,
    phone_number: phone,
    survey_status: status,
    created_at: ago(7 + i),
    analysis,
  };
});


const CHATS: Record<string, [ChatMessage["sender"], string][]> = {
  "mock-3": [
    ["user", "Evet, başlayalım"],
    ["bot", "Harika Burak! 🙌 Önce ekipmanlarla başlayalım: Salondaki aletleri ve genel düzeni nasıl buluyorsun?"],
    ["user", "Aletler idare eder ama bazıları hep bozuk"],
    ["bot", "Anladım, bozuk aletlerin antrenmanı aksatması can sıkıcı 😕 Not aldım! Peki soyunma odaları, duşlar ve temizlik nasıl?"],
    ["user", "Berbat. Duşlarda sıcak su yok, soyunma odası kokuyor. Ücret ödüyoruz neden böyle?"],
    ["bot", "Haklısın, bu kabul edilemez 🙏 Yönetimimize hemen iletiyorum. Son olarak eğitmenler ve resepsiyonun ilgisi nasıl?"],
    ["user", "Onlar da ilgisiz. Açıkçası üyeliğimi yenilemeyi düşünmüyorum"],
    ["bot", "Geri bildirimin için çok teşekkürler Burak 💪 Seninle ilgilenmek için ekibimiz en kısa sürede iletişime geçecek."],
  ],
  "mock-1": [
    ["user", "Evet, başlayalım"],
    ["bot", "Süper Ahmet! 💪 Ekipmanlar ve salon düzeni sence nasıl?"],
    ["user", "Çok iyi, aletler yeni ve yer geniş"],
    ["bot", "Müthiş! 🔥 Peki soyunma odaları, duşlar ve temizlik?"],
    ["user", "Tertemiz, sorun yok"],
    ["bot", "Harika 😊 Son soru: eğitmenler ve resepsiyon ilgisi nasıl?"],
    ["user", "Can hoca çok ilgili, teşekkürler"],
    ["bot", "Bunu Can'a ileteceğim 🙌 Zaman ayırdığın için teşekkürler Ahmet, iyi antrenmanlar!"],
  ],
  "mock-9": [
    ["user", "Evet, başlayalım"],
    ["bot", "Merhaba Merve! 😊 Ekipmanlar ve salon düzeni hakkında ne düşünüyorsun?"],
    ["user", "Akşamları çok kalabalık oluyor"],
  ],
};

export function getMockMessages(id: string): ChatMessage[] {
  const chat =
    CHATS[id] ??
    ([
      ["user", "Evet, başlayalım"],
      ["bot", "Merhaba! 😊 Ekipmanlar ve salon düzeni hakkında ne düşünüyorsun?"],
      ["user", "Genel olarak iyi"],
      ["bot", "Süper! Soyunma odaları ve temizlik nasıl? 🚿"],
    ] as [ChatMessage["sender"], string][]);
  return chat.map(([sender, content], i) => ({
    id: `${id}-${i}`,
    sender,
    content,
    created_at: new Date(Date.now() - day + i * 120_000).toISOString(),
  }));
}
