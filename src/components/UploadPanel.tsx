"use client";

import { useRef, useState } from "react";
import { UploadCloud, Send, Loader2, FileSpreadsheet } from "lucide-react";

type Notice = { kind: "ok" | "err"; text: string } | null;

export default function UploadPanel({
  demo,
  pending,
  onChanged,
}: {
  demo: boolean;
  pending: number;
  onChanged: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setNotice(null);
    if (demo) {
      setNotice({ kind: "ok", text: `Demo modu: "${file.name}" gerçekte işlenmedi.` });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/members/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Yükleme başarısız");
      setNotice({
        kind: "ok",
        text: `${d.added} yeni üye eklendi, ${d.skipped} zaten kayıtlı${d.invalid ? `, ${d.invalid} geçersiz satır atlandı` : ""}.`,
      });
      onChanged();
    } catch (e) {
      setNotice({ kind: "err", text: e instanceof Error ? e.message : "Hata" });
    } finally {
      setUploading(false);
    }
  }

  async function start() {
    setNotice(null);
    if (demo) {
      setNotice({ kind: "ok", text: "Demo modu: kampanya gerçekte başlatılmadı." });
      return;
    }
    if (!confirm(`${pending} bekleyen üyeye WhatsApp anket daveti gönderilsin mi?`)) return;
    setStarting(true);
    try {
      const res = await fetch("/api/campaign/start", { method: "POST", body: "{}" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Kampanya başlatılamadı");
      setNotice({
        kind: d.failed?.length ? "err" : "ok",
        text: `${d.sent} davet gönderildi${d.failed?.length ? `, ${d.failed.length} başarısız (${d.failed[0].error})` : ""}${
          d.remaining ? `. ${d.remaining} üye kaldı, tekrar başlatın.` : "."
        }`,
      });
      onChanged();
    } catch (e) {
      setNotice({ kind: "err", text: e instanceof Error ? e.message : "Hata" });
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="card p-5" aria-labelledby="campaign-title">
      <h2 id="campaign-title" className="mb-4 font-display text-lg font-semibold text-white">
        Üye Yükleme & Kampanya
      </h2>
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div
          id="csv-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          onClick={() => input.current?.click()}
          className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-5 py-6 transition ${
            drag ? "border-brand bg-brand/10" : "border-white/10 hover:border-brand/50 hover:bg-white/[0.02]"
          }`}
        >
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx,.xls"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <Loader2 className="animate-spin text-brand" size={32} />
          ) : (
            <UploadCloud className="text-brand" size={32} />
          )}
          <div>
            <p className="font-medium text-white">CSV / Excel dosyasını sürükleyip bırakın</p>
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <FileSpreadsheet size={12} /> Sütunlar: İsim, Telefon (05xx / +90 5xx / 905xx kabul edilir)
            </p>
          </div>
        </div>

        <button
          id="start-campaign"
          onClick={start}
          disabled={starting || (!demo && pending === 0)}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-4 font-semibold text-ink-950 shadow-[0_0_30px_-8px_#c6ff3d] transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {starting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          <span className="text-left leading-tight">
            Bekleyen Üyelere WhatsApp
            <br />
            Anketini Başlat <span className="opacity-60">({pending})</span>
          </span>
        </button>
      </div>
      {notice && (
        <p className={`mt-3 text-sm ${notice.kind === "ok" ? "text-brand" : "text-red-400"}`}>{notice.text}</p>
      )}
    </section>
  );
}
