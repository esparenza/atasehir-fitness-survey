import { NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Analysis, MemberRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, members: [] });
  }
  const db = getAdminClient();
  const [{ data: members, error }, { data: analyses, error: aErr }] = await Promise.all([
    db.from("members").select("*").order("created_at", { ascending: false }),
    db.from("survey_analyses").select("*").order("created_at", { ascending: false }),
  ]);
  if (error || aErr) {
    return NextResponse.json({ error: (error ?? aErr)!.message }, { status: 500 });
  }

  const latest = new Map<string, Analysis>();
  for (const a of analyses ?? []) if (!latest.has(a.member_id)) latest.set(a.member_id, a);

  const rows: MemberRow[] = (members ?? []).map((m) => ({
    ...m,
    analysis: latest.get(m.id) ?? null,
  }));
  return NextResponse.json({ configured: true, members: rows });
}
