import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { analyzeConversation, END_TOKEN, generateChatReply, HistoryItem } from "@/lib/gemini";
import { sendText } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ messages: [] });
  const { data, error } = await getAdminClient()
    .from("messages")
    .select("id, sender, content, created_at")
    .eq("member_id", params.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 400 });
  }
  const db = getAdminClient();
  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  // 1) Anketi Sıfırla
  if (action === "reset") {
    await db.from("messages").delete().eq("member_id", params.id);
    await db.from("survey_analyses").delete().eq("member_id", params.id);
    const { error } = await db
      .from("members")
      .update({ survey_status: "bekliyor" })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, survey_status: "bekliyor" });
  }

  // 2) Panelden Test / Simülasyon Mesajı Gönder (Üye ağzından yazıp AI cevabını üretir)
  if (action === "simulate") {
    const text = String(body?.content ?? "").trim();
    if (!text) return NextResponse.json({ error: "Mesaj boş olamaz." }, { status: 400 });

    const { data: member } = await db
      .from("members")
      .select("id, full_name, phone_number, survey_status")
      .eq("id", params.id)
      .single();
    if (!member) return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });

    await db.from("messages").insert({
      member_id: member.id,
      sender: "user",
      content: text,
    });

    if (member.survey_status !== "devam_ediyor") {
      await db.from("members").update({ survey_status: "devam_ediyor" }).eq("id", member.id);
    }

    const { data: rows } = await db
      .from("messages")
      .select("sender, content")
      .eq("member_id", member.id)
      .order("created_at", { ascending: true });

    const history = (rows ?? []) as HistoryItem[];
    const reply = await generateChatReply(history, member.full_name);
    const finished = reply.includes(END_TOKEN);
    const clean = reply.split(END_TOKEN).join("").replace(/`/g, "").trim();

    await db.from("messages").insert({
      member_id: member.id,
      sender: "bot",
      content: clean,
    });

    if (body?.sendWhatsapp && member.phone_number) {
      try {
        await sendText(member.phone_number, clean);
      } catch (e) {
        console.warn("[simulate] WhatsApp gönderimi atlandı/başarısız:", e);
      }
    }

    let newStatus = "devam_ediyor";
    if (finished) {
      newStatus = "tamamlandi";
      await db.from("members").update({ survey_status: "tamamlandi" }).eq("id", member.id);
      const fullHistory: HistoryItem[] = [...history, { sender: "bot", content: clean }];
      const analysis = await analyzeConversation(fullHistory);
      await db.from("survey_analyses").insert({ member_id: member.id, ...analysis });
    }

    return NextResponse.json({ ok: true, survey_status: newStatus, reply: clean });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}
