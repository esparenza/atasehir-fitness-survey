import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendText } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/phone";
import { analyzeConversation, generateChatReply, END_TOKEN, HistoryItem } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REJECT_RE = /müsait\s*değilim|musait\s*degilim|ilgilenmiyorum/i;
const RESTART_RE = /^(anket|yeniden|sıfırla|sifirla|tekrar|başla|basla|evet|başlayalım|baslayalim)$/i;
const REJECT_REPLY =
  "Anlayışınız için teşekkürler 🙏 Fikriniz bizim için değerli, dilediğiniz zaman 'anket' yazarak katılabilirsiniz. İyi antrenmanlar! 💪";
const COMPLETED_INFO_REPLY =
  "Mesajınız yönetici panelimize iletildi 🙏 Memnuniyet anketini baştan başlatmak isterseniz *yeniden* yazabilirsiniz. İyi antrenmanlar! 💪";
const FALLBACK_REPLY = "Şu an mesajınızı işleyemiyorum 🙈 Birazdan tekrar yazar mısınız?";

// --- GET: Meta webhook doğrulaması ---
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (
    p.get("hub.mode") === "subscribe" &&
    p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface WaMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  button?: { text?: string; payload?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  profileName?: string;
}

function extractText(m: WaMessage): { text: string | null; isButton: boolean } {
  if (m.type === "text") return { text: m.text?.body ?? null, isButton: false };
  if (m.type === "button") return { text: m.button?.text ?? m.button?.payload ?? null, isButton: true };
  if (m.type === "interactive") {
    const t = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
    return { text: t, isButton: true };
  }
  return { text: null, isButton: false };
}

// --- POST: gelen mesajlar ---
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages: WaMessage[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const val = change?.value;
      const contacts: any[] = val?.contacts ?? [];
      const nameByWaId = new Map<string, string>();
      for (const c of contacts) {
        if (c?.wa_id && c?.profile?.name) {
          nameByWaId.set(String(c.wa_id).replace(/\D/g, ""), String(c.profile.name).trim());
        }
      }
      for (const m of val?.messages ?? []) {
        const cleanFrom = String(m.from ?? "").replace(/\D/g, "");
        messages.push({ ...m, profileName: nameByWaId.get(cleanFrom) });
      }
    }
  }

  // Meta'nın tekrar denemelerini engellemek için hata olsa da 200 döneriz.
  for (const m of messages) {
    try {
      await handleMessage(m);
    } catch (err) {
      console.error("[webhook] mesaj işlenemedi:", err);
    }
  }
  return NextResponse.json({ ok: true });
}

async function safeSendText(phone: string, text: string) {
  try {
    await sendText(phone, text);
  } catch (err) {
    console.error("[webhook] WhatsApp mesaj gönderilemedi:", err);
  }
}

async function handleMessage(m: WaMessage) {
  const db = getAdminClient();
  const digits = m.from.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const stdPhone = normalizePhone(digits) || (last10.startsWith("5") ? "90" + last10 : digits);

  // Son 10 haneye göre ara (.limit(1) ile olası çift kayıtlarda hata fırlatmasını önle)
  const { data: foundList } = await db
    .from("members")
    .select("id, full_name, phone_number, survey_status")
    .ilike("phone_number", `%${last10}`)
    .order("created_at", { ascending: false })
    .limit(1);

  let member = foundList?.[0] ?? null;

  // Eğer veritabanında yoksa otomatik üye olarak kaydet ve anketi başlat
  if (!member) {
    const initialName = m.profileName || "WhatsApp Üyesi";
    const { data: newMember, error: createErr } = await db
      .from("members")
      .insert({ full_name: initialName, phone_number: stdPhone, survey_status: "devam_ediyor" })
      .select("id, full_name, phone_number, survey_status")
      .single();
    if (createErr || !newMember) {
      console.error("[webhook] yeni üye oluşturulamadı:", createErr);
      return;
    }
    member = newMember;
  } else if (member.full_name === "WhatsApp Üyesi" && m.profileName) {
    await db.from("members").update({ full_name: m.profileName }).eq("id", member.id);
    member.full_name = m.profileName;
  }

  const phone = member.phone_number || stdPhone;

  const { text, isButton } = extractText(m);
  if (!text) {
    await safeSendText(phone, "Şimdilik sadece yazılı mesajları okuyabiliyorum 😊 Fikrini yazar mısın?");
    return;
  }

  const trimmed = text.trim();

  // Anket daha önce tamamlanmış veya reddedilmişse:
  if (member.survey_status === "tamamlandi" || member.survey_status === "reddetti") {
    // Eğer üye şablon butonuna bastıysa veya 'yeniden / anket / başla' yazdıysa anketi sıfırlayıp yeniden başlat
    if (isButton || RESTART_RE.test(trimmed)) {
      await db.from("messages").delete().eq("member_id", member.id);
      await db.from("survey_analyses").delete().eq("member_id", member.id);
      await db.from("members").update({ survey_status: "devam_ediyor" }).eq("id", member.id);
      member.survey_status = "devam_ediyor";
    } else {
      // Yine de mesajı kaydet ki yönetici panelde görebilsin ve bilgi yanıtı dön
      const { error: closedInsErr } = await db
        .from("messages")
        .insert({ member_id: member.id, sender: "user", content: trimmed, wa_message_id: m.id });
      if (closedInsErr?.code === "23505") return;
      await db.from("messages").insert({ member_id: member.id, sender: "bot", content: COMPLETED_INFO_REPLY });
      await safeSendText(phone, COMPLETED_INFO_REPLY);
      return;
    }
  }

  // Tekrar teslim edilen mesajları (aynı wa id) atla
  const { error: insErr } = await db
    .from("messages")
    .insert({ member_id: member.id, sender: "user", content: trimmed, wa_message_id: m.id });
  if (insErr) {
    if (insErr.code === "23505") return;
    throw insErr;
  }

  // Şablondaki "müsait değilim / ilgilenmiyorum" butonu
  if (REJECT_RE.test(trimmed) && (isButton || member.survey_status === "davet_gonderildi")) {
    await db.from("members").update({ survey_status: "reddetti" }).eq("id", member.id);
    await db.from("messages").insert({ member_id: member.id, sender: "bot", content: REJECT_REPLY });
    await safeSendText(phone, REJECT_REPLY);
    return;
  }

  if (member.survey_status !== "devam_ediyor") {
    await db.from("members").update({ survey_status: "devam_ediyor" }).eq("id", member.id);
  }

  const { data: rows, error: histErr } = await db
    .from("messages")
    .select("sender, content")
    .eq("member_id", member.id)
    .order("created_at", { ascending: true });
  if (histErr) throw histErr;
  const history = (rows ?? []) as HistoryItem[];

  let reply: string;
  try {
    reply = await generateChatReply(history, member.full_name);
  } catch (err) {
    console.error("[webhook] Gemini hatası:", err);
    await safeSendText(phone, FALLBACK_REPLY);
    return;
  }
  if (!reply) {
    await safeSendText(phone, FALLBACK_REPLY);
    return;
  }

  const finished = reply.includes(END_TOKEN);
  const clean = reply.split(END_TOKEN).join("").replace(/`/g, "").trim();

  // Önce veritabanına kaydet ki konuşma geçmişi asla bozulmasın, ardından WhatsApp'a gönder
  await db.from("messages").insert({ member_id: member.id, sender: "bot", content: clean });
  await safeSendText(phone, clean);

  if (!finished) return;

  await db.from("members").update({ survey_status: "tamamlandi" }).eq("id", member.id);

  try {
    const fullHistory: HistoryItem[] = [...history, { sender: "bot", content: clean }];
    const analysis = await analyzeConversation(fullHistory);
    const { error } = await db.from("survey_analyses").insert({ member_id: member.id, ...analysis });
    if (error) console.error("[webhook] analiz kaydedilemedi:", error);
  } catch (anErr) {
    console.error("[webhook] analiz üretilemedi:", anErr);
  }
}
