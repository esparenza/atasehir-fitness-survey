import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAME_KEYS = ["isim", "ad", "adsoyad", "adisoyadi", "name", "fullname", "uye", "üye"];
const PHONE_KEYS = ["telefon", "tel", "telefonnumarasi", "gsm", "cep", "phone", "phonenumber", "numara"];

const norm = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 400 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
  }

  let rows: unknown[][];
  try {
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", raw: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  } catch {
    return NextResponse.json({ error: "Dosya okunamadı (CSV/XLSX bekleniyor)." }, { status: 400 });
  }
  if (!rows.length) return NextResponse.json({ error: "Dosya boş." }, { status: 400 });

  // Başlık satırı varsa sütunları ondan bul; yoksa 1. sütun isim, 2. sütun telefon.
  const header = rows[0].map((c) => norm(String(c)));
  let nameIdx = header.findIndex((h) => NAME_KEYS.includes(h));
  let phoneIdx = header.findIndex((h) => PHONE_KEYS.includes(h));
  let start = 1;
  if (nameIdx < 0 || phoneIdx < 0) {
    nameIdx = 0;
    phoneIdx = 1;
    start = normalizePhone(rows[0][1]) ? 0 : 1;
  }

  const byPhone = new Map<string, { full_name: string; phone_number: string }>();
  let invalid = 0;
  for (const r of rows.slice(start)) {
    const name = String(r[nameIdx] ?? "").trim();
    const phone = normalizePhone(r[phoneIdx]);
    if (!name && !r[phoneIdx]) continue; // boş satır
    if (!name || !phone) {
      invalid++;
      continue;
    }
    byPhone.set(phone, { full_name: name, phone_number: phone });
  }
  const list = Array.from(byPhone.values());
  if (!list.length) {
    return NextResponse.json({ error: "Geçerli kayıt bulunamadı.", invalid }, { status: 400 });
  }

  const db = getAdminClient();
  // Mevcut üyelerin durumunu bozmamak için sadece yeni numaralar eklenir.
  const { data: inserted, error } = await db
    .from("members")
    .upsert(list, { onConflict: "phone_number", ignoreDuplicates: true })
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const added = inserted?.length ?? 0;
  return NextResponse.json({ total: list.length, added, skipped: list.length - added, invalid });
}
