import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendText } from "@/lib/whatsapp";
import { analyzeConversation, generateChatReply, END_TOKEN, HistoryItem } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REJECT_RE = /müsait\s*değilim|musait\s*degilim|ilgilenmiyorum/i;
const REJECT_REPLY =
  "Anlayışınız için teşekkürler 🙏 Fikriniz bizim için değerli, dilediğiniz zaman bize yazabilirsiniz. İyi antrenmanlar! 💪";
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
      for (const m of change?.value?.messages ?? []) messages.push(m);
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

async function handleMessage(m: WaMessage) {
  const db = getAdminClient();
  const digits = m.from.replace(/\D/g, "");
  const last10 = digits.slice(-10);

  // Son 10 haneye göre ara (905xx, 05xx, 5xx fark etmeksizin eşleşir)
  let { data: member } = await db
    .from("members")
    .select("id, full_name, survey_status")
    .ilike("phone_number", `%${last10}`)
    .maybeSingle();

  // Eğer veritabanında yoksa otomatik üye olarak kaydet ve anketi başlat
  if (!member) {
    const stdPhone = last10.startsWith("5") ? "90" + last10 : digits;
    const { data: newMember, error: createErr } = await db
      .from("members")
      .insert({ full_name: "WhatsApp Üyesi", phone_number: stdPhone, survey_status: "devam_ediyor" })
      .select("id, full_name, survey_status")
      .single();
    if (createErr || !newMember) {
      console.error("[webhook] yeni üye oluşturulamadı:", createErr);
      return;
    }
    member = newMember;
  }
  const phone = member.phone_number || digits;

  // Anket kapanmışsa tekrar işlem yapma
  if (member.survey_status === "tamamlandi" || member.survey_status === "reddetti") return;

  const { text, isButton } = extractText(m);
  if (!text) {
    await sendText(phone, "Şimdilik sadece yazılı mesajları okuyabiliyorum 😊 Fikrini yazar mısın?");
    return;
  }

  // Tekrar teslim edilen mesajları (aynı wa id) atla
  const { error: insErr } = await db
    .from("messages")
    .insert({ member_id: member.id, sender: "user", content: text, wa_message_id: m.id });
  if (insErr) {
    if (insErr.code === "23505") return;
    throw insErr;
  }

  // Şablondaki "müsait değilim / ilgilenmiyorum" butonu
  if (REJECT_RE.test(text) && (isButton || member.survey_status === "davet_gonderildi")) {
    await db.from("members").update({ survey_status: "reddetti" }).eq("id", member.id);
    await sendText(phone, REJECT_REPLY);
    await db.from("messages").insert({ member_id: member.id, sender: "bot", content: REJECT_REPLY });
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
    reply = await generateChatReply(history);
  } catch (err) {
    console.error("[webhook] Gemini hatası:", err);
    await sendText(phone, FALLBACK_REPLY);
    return;
  }
  if (!reply) {
    await sendText(phone, FALLBACK_REPLY);
    return;
  }

  const finished = reply.includes(END_TOKEN);
  const clean = reply.split(END_TOKEN).join("").replace(/`/g, "").trim();

  await sendText(phone, clean);
  await db.from("messages").insert({ member_id: member.id, sender: "bot", content: clean });

  if (!finished) return;

  await db.from("members").update({ survey_status: "tamamlandi" }).eq("id", member.id);

  const fullHistory: HistoryItem[] = [...history, { sender: "bot", content: clean }];
  const analysis = await analyzeConversation(fullHistory);
  const { error } = await db.from("survey_analyses").insert({ member_id: member.id, ...analysis });
  if (error) console.error("[webhook] analiz kaydedilemedi:", error);
}
