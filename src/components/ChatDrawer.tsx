"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Phone, Loader2, AlertTriangle, CheckCheck, RotateCcw, Send } from "lucide-react";
import type { ChatMessage, MemberRow } from "@/lib/types";
import { getMockMessages } from "@/lib/mock";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function ChatDrawer({
  member,
  demo,
  onClose,
  onUpdated,
}: {
  member: MemberRow;
  demo: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [simInput, setSimInput] = useState("");
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const fetchMessages = useCallback(async () => {
    if (demo) {
      setMessages(getMockMessages(member.id));
      return;
    }
    try {
      const r = await fetch(`/api/members/${member.id}/messages`, { cache: "no-store" });
      const d = await r.json();
      setMessages(d.messages ?? []);
    } catch {
      // sessizce geç
    }
  }, [member.id, demo]);

  useEffect(() => {
    setMessages(null);
    prevCountRef.current = 0;
    fetchMessages();
    if (demo) return;
    const timer = setInterval(fetchMessages, 4000);
    return () => clearInterval(timer);
  }, [fetchMessages, demo]);

  useEffect(() => {
    const count = messages?.length ?? 0;
    if (count > prevCountRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = count;
  }, [messages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleReset() {
    if (demo) return;
    if (!confirm(`${member.full_name} için sohbet geçmişi ve analiz sıfırlansın mı?`)) return;
    setResetting(true);
    try {
      await fetch(`/api/members/${member.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      await fetchMessages();
      onUpdated?.();
    } finally {
      setResetting(false);
    }
  }

  async function handleSimulate(e: React.FormEvent) {
    e.preventDefault();
    const txt = simInput.trim();
    if (!txt || sending || demo) return;
    setSending(true);
    setSimInput("");
    try {
      await fetch(`/api/members/${member.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate", content: txt }),
      });
      await fetchMessages();
      onUpdated?.();
    } finally {
      setSending(false);
    }
  }

  const a = member.analysis;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md animate-slideIn flex-col border-l border-white/10 bg-ink-900 shadow-2xl">
        <header className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20 font-display font-semibold text-brand">
            {member.full_name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white">{member.full_name}</p>
            <p className="flex items-center gap-1 text-xs text-zinc-400">
              <Phone size={11} /> +{member.phone_number}
            </p>
          </div>
          {!demo && (
            <button
              onClick={handleReset}
              disabled={resetting}
              title="Anketi ve mesajları sıfırla (yeniden test et)"
              className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              {resetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              Sıfırla
            </button>
          )}
          <button
            id="close-chat-drawer"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </header>

        {a && (
          <div className="border-b border-white/10 bg-ink-800 px-4 py-3 text-sm">
            {a.critical_alert && (
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-400">
                <AlertTriangle size={14} /> KRİTİK UYARI
              </p>
            )}
            <p className="text-zinc-300">{a.summary}</p>
          </div>
        )}

        <div className="wa-bg flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {messages === null ? (
            <div className="flex justify-center pt-10 text-zinc-500">
              <Loader2 className="animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <p className="pt-10 text-center text-sm text-zinc-500">Henüz yazışma yok.</p>
          ) : (
            messages.map((m) => {
              const bot = m.sender === "bot";
              return (
                <div key={m.id} className={`flex ${bot ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-xl px-3 py-2 text-sm shadow ${
                      bot ? "rounded-tr-sm bg-[#005c4b] text-white" : "rounded-tl-sm bg-[#202c33] text-zinc-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/50">
                      {fmt(m.created_at)}
                      {bot && <CheckCheck size={12} className="text-sky-400" />}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
        {!demo ? (
          <form onSubmit={handleSimulate} className="flex items-center gap-2 bg-[#202c33] px-3 py-2.5">
            <input
              type="text"
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              disabled={sending}
              placeholder="Üye adına test mesajı yazın..."
              className="flex-1 rounded-xl border border-white/10 bg-[#2a3942] px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-400 focus:border-brand/60"
            />
            <button
              type="submit"
              disabled={sending || !simInput.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-ink-950 transition hover:bg-brand-dark disabled:opacity-40"
              title="Test mesajı gönder"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </form>
        ) : (
          <p className="bg-[#202c33] px-4 py-2 text-center text-[11px] text-zinc-500">
            Örnek veri modu · Gerçek test için örnek veri modunu kapatın
          </p>
        )}
      </aside>
    </div>
  );
}
