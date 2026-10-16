import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { sendTemplate } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DELAY_MS = 1500; // her mesaj arası bekleme (ban riskini azaltır)
const BATCH_SIZE = 10; // her N mesajda uzun mola
const BATCH_PAUSE_MS = 5000;
const DEFAULT_LIMIT = 50; // tek istekte (Vercel süre sınırı için) en fazla

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Body: { memberIds?: string[], limit?: number }
 * memberIds yoksa durumu 'bekliyor' olan üyelere gönderilir.
 * Kalan üye varsa response.remaining > 0 döner; paneldeki buton tekrar çağrılabilir.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body?.limit) || DEFAULT_LIMIT, 200);
  const db = getAdminClient();

  let q = db
    .from("members")
    .select("id, full_name, phone_number")
    .eq("survey_status", "bekliyor")
    .order("created_at", { ascending: true });
  if (Array.isArray(body?.memberIds) && body.memberIds.length) q = q.in("id", body.memberIds);

  const { data: all, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const targets = (all ?? []).slice(0, limit);
  let sent = 0;
  const failed: { phone: string; error: string }[] = [];

  for (let i = 0; i < targets.length; i++) {
    const m = targets[i];
    try {
      const firstName = m.full_name.trim().split(/\s+/)[0] || "Üyemiz";
      await sendTemplate(m.phone_number, firstName);
      await db.from("members").update({ survey_status: "davet_gonderildi" }).eq("id", m.id);
      sent++;
    } catch (e) {
      failed.push({ phone: m.phone_number, error: e instanceof Error ? e.message : String(e) });
    }
    if (i < targets.length - 1) {
      await sleep((i + 1) % BATCH_SIZE === 0 ? BATCH_PAUSE_MS : DELAY_MS);
    }
  }

  return NextResponse.json({
    sent,
    failed,
    remaining: (all ?? []).length - targets.length,
  });
}
