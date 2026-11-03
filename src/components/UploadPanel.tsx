"use client";

import { useRef, useState } from "react";
import { UploadCloud, Send, Loader2, FileSpreadsheet, UserPlus, Square } from "lucide-react";

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
  const [dailyLimit, setDailyLimit] = useState(100);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [addingSingle, setAddingSingle] = useState(false);
  const [singleName, setSingleName] = useState("");
  const [singlePhone, setSinglePhone] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const input = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);

  async function addSingle(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!singleName.trim() || !singlePhone.trim()) return;
    if (demo) {
      setNotice({ kind: "ok", text: "Demo modu: Örnek veri modunu kapatıp gerçek üye ekleyebilirsiniz." });
      return;
    }
    setAddingSingle(true);
    try {
      const res = await fetch("/api/members/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: singleName.trim(), phone_number: singlePhone.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Üye eklenemedi");
      setNotice({
        kind: "ok",
        text: d.added ? `"${singleName.trim()}" başarıyla eklendi.` : "Bu numara zaten kayıtlı.",
      });
      setSingleName("");
      setSinglePhone("");
      onChanged();
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "Hata" });
    } finally {
      setAddingSingle(false);
    }
  }

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
    const targetCount = Math.min(pending, Math.max(1, Number(dailyLimit) || 100));
    if (!confirm(`Bekleyen ${pending} üyeden sıradaki ${targetCount} kişiye WhatsApp anket daveti gönderilsin mi?`)) return;

    setStarting(true);
    stopRef.current = false;
    setProgress({ sent: 0, total: targetCount });

    let totalSent = 0;
    const allFailed: { phone: string; error: string }[] = [];

    try {
      while (totalSent + allFailed.length < targetCount && !stopRef.current) {
        const batchSize = Math.min(10, targetCount - (totalSent + allFailed.length));
        const res = await fetch("/api/campaign/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: batchSize }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Kampanya başlatılamadı");

        totalSent += d.sent ?? 0;
        if (Array.isArray(d.failed)) allFailed.push(...d.failed);
        setProgress({ sent: totalSent, total: targetCount });
        onChanged();

        // Hiç gönderilemediyse (örn. token hatası) veya bekleyen kalmadıysa döngüyü kır
        if ((d.sent ?? 0) === 0 || (d.remaining ?? 0) === 0) break;
      }

      const remainingAfter = Math.max(0, pending - totalSent);
      setNotice({
        kind: allFailed.length && totalSent === 0 ? "err" : "ok",
        text: `${totalSent} davet başarıyla gönderildi${
          allFailed.length ? `, ${allFailed.length} başarısız (${allFailed[0].error})` : ""
        }${remainingAfter > 0 ? `. Kalan bekleyen üye: ${remainingAfter}.` : "."}`,
      });
    } catch (e) {
      setNotice({ kind: "err", text: e instanceof Error ? e.message : "Hata" });
    } finally {
      setStarting(false);
      setProgress(null);
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

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-ink-900 px-3 py-1.5 text-xs text-zinc-400">
            <span>Günlük Gönderim Limiti:</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Math.max(1, Number(e.target.value) || 100))}
              disabled={starting}
              className="w-16 rounded-lg border border-white/10 bg-ink-800 px-2 py-1 text-center font-semibold text-brand outline-none focus:border-brand"
            />
          </div>
          <div className="flex gap-2">
            <button
              id="start-campaign"
              onClick={start}
              disabled={starting || (!demo && pending === 0)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 font-semibold text-ink-950 shadow-[0_0_30px_-8px_#c6ff3d] transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {starting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              <span className="text-left text-sm leading-tight">
                {starting && progress
                  ? `Gönderiliyor: ${progress.sent} / ${progress.total}`
                  : `Sıradaki ${Math.min(pending || dailyLimit, dailyLimit)} Üyeye`}
                <br />
                <span className="text-xs font-normal opacity-75">
                  Anketi Başlat (Bekleyen: {pending})
                </span>
              </span>
            </button>
            {starting && (
              <button
                type="button"
                onClick={() => {
                  stopRef.current = true;
                }}
                title="Gönderimi Durdur"
                className="flex items-center justify-center rounded-xl border border-red-500/40 bg-red-500/15 px-3 text-red-300 transition hover:bg-red-500/25"
              >
                <Square size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={addSingle} className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <UserPlus size={14} className="text-brand" /> Hızlı Üye Ekle:
        </span>
        <input
          type="text"
          value={singleName}
          onChange={(e) => setSingleName(e.target.value)}
          placeholder="Ad Soyad"
          className="w-44 rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-brand/60"
        />
        <input
          type="tel"
          value={singlePhone}
          onChange={(e) => setSinglePhone(e.target.value)}
          placeholder="Telefon (05xx...)"
          className="w-44 rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-brand/60"
        />
        <button
          type="submit"
          disabled={addingSingle || !singleName.trim() || !singlePhone.trim()}
          className="flex items-center gap-1.5 rounded-xl border border-brand/40 bg-brand/10 px-3.5 py-2 text-xs font-medium text-brand transition hover:bg-brand/20 disabled:opacity-40"
        >
          {addingSingle ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
          Ekle
        </button>
      </form>
      {notice && (
        <p className={`mt-3 text-sm ${notice.kind === "ok" ? "text-brand" : "text-red-400"}`}>{notice.text}</p>
      )}
    </section>
  );
}
