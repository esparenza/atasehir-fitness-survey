"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Dumbbell, FlaskConical, Loader2, RefreshCw, Search,
  Sparkles, Star, Users, Droplets, UserCheck, ChevronRight,
} from "lucide-react";
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { MemberRow, SurveyStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { MOCK_MEMBERS } from "@/lib/mock";
import { computeStats } from "@/lib/stats";
import UploadPanel from "./UploadPanel";
import ChatDrawer from "./ChatDrawer";

type Filter = "tum" | "kritik" | "tamamlandi" | "devam";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "tum", label: "Tümü" },
  { key: "kritik", label: "Sadece Kritik Şikayetler" },
  { key: "tamamlandi", label: "Tamamlananlar" },
  { key: "devam", label: "Devam Edenler" },
];

const scoreColor = (s: number) =>
  s >= 8 ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
  : s >= 5 ? "bg-amber-500/15 text-amber-400 ring-amber-500/30"
  : "bg-red-500/15 text-red-400 ring-red-500/30";

const statusColor: Record<SurveyStatus, string> = {
  bekliyor: "text-zinc-400 bg-zinc-500/10",
  davet_gonderildi: "text-sky-400 bg-sky-500/10",
  devam_ediyor: "text-amber-300 bg-amber-500/10",
  tamamlandi: "text-emerald-400 bg-emerald-500/10",
  reddetti: "text-zinc-500 bg-zinc-500/10",
};

const sentimentUi = {
  pozitif: { label: "😊 Pozitif", cls: "text-emerald-400" },
  notr: { label: "😐 Nötr", cls: "text-amber-300" },
  negatif: { label: "😟 Negatif", cls: "text-red-400" },
};

export default function Dashboard() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("tum");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MemberRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Veri alınamadı");
      setConfigured(d.configured);
      if (!d.configured) setDemo(true);
      setMembers(d.members ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata");
      setDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = demo ? MOCK_MEMBERS : members;
  const stats = useMemo(() => computeStats(data), [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data
      .filter((m) => {
        if (filter === "kritik") return m.analysis?.critical_alert;
        if (filter === "tamamlandi") return m.survey_status === "tamamlandi";
        if (filter === "devam") return m.survey_status === "devam_ediyor";
        return true;
      })
      .filter((m) => !q || m.full_name.toLowerCase().includes(q) || m.phone_number.includes(q))
      .sort((a, b) => Number(!!b.analysis?.critical_alert) - Number(!!a.analysis?.critical_alert));
  }, [data, filter, query]);

  const chartData = [
    { name: "Ekipman", value: +stats.equipment.toFixed(1) },
    { name: "Hijyen", value: +stats.hygiene.toFixed(1) },
    { name: "Eğitmen", value: +stats.staff.toFixed(1) },
  ];
  const pie = [
    { name: "Pozitif", value: stats.sentiments.pozitif, color: "#34d399" },
    { name: "Nötr", value: stats.sentiments.notr, color: "#fbbf24" },
    { name: "Negatif", value: stats.sentiments.negatif, color: "#f87171" },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-ink-950 shadow-[0_0_30px_-6px_#c6ff3d]">
            <Dumbbell size={26} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Ataşehir <span className="text-brand">Fitness</span>
            </h1>
            <p className="text-sm text-zinc-500">Üye Memnuniyet & Geri Bildirim Paneli</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="toggle-demo"
            onClick={() => setDemo((d) => !d)}
            disabled={!configured && demo}
            title={!configured ? "Supabase yapılandırılmadığı için demo verisi gösteriliyor" : ""}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
              demo ? "border-brand/50 bg-brand/10 text-brand" : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            <FlaskConical size={16} /> Örnek Veri Modu {demo ? "Açık" : "Kapalı"}
          </button>
          <button
            id="refresh"
            onClick={load}
            className="rounded-xl border border-white/10 p-2.5 text-zinc-400 transition hover:text-white"
            aria-label="Yenile"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          Veri alınamadı: {error} — örnek veri gösteriliyor.
        </p>
      )}

      {/* KPI */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Özet istatistikler">
        <Kpi
          icon={<Users size={18} />}
          title="Ulaşılan Üye"
          value={String(stats.reached)}
          sub={`Anket tamamlama: %${stats.completionRate} (${stats.completed} kişi)`}
          delay={0}
        />
        <Kpi
          icon={<Star size={18} />}
          title="Genel Memnuniyet"
          value={stats.overall ? stats.overall.toFixed(1) : "–"}
          suffix="/ 10"
          sub={`${stats.completed} tamamlanan anket`}
          delay={60}
        />
        <div className="card animate-fadeUp p-5 [animation-delay:120ms]">
          <p className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
            <Activity size={16} /> Kategori Ortalamaları
          </p>
          <div className="space-y-2.5">
            <Bar2 icon={<Dumbbell size={13} />} label="Ekipman" v={stats.equipment} />
            <Bar2 icon={<Droplets size={13} />} label="Hijyen" v={stats.hygiene} />
            <Bar2 icon={<UserCheck size={13} />} label="Eğitmen" v={stats.staff} />
          </div>
        </div>
        <button
          id="kpi-critical"
          onClick={() => setFilter("kritik")}
          className={`animate-fadeUp rounded-2xl border p-5 text-left transition [animation-delay:180ms] ${
            stats.critical
              ? "animate-pulseRing border-red-500/50 bg-gradient-to-br from-red-600/25 to-red-900/10 hover:from-red-600/35"
              : "border-white/[0.07] bg-ink-800/70"
          }`}
        >
          <p className="mb-2 flex items-center gap-2 text-sm text-red-300">
            <AlertTriangle size={16} /> Kritik Uyarı
          </p>
          <p className="font-display text-5xl font-bold text-white">{stats.critical}</p>
          <p className="mt-1 text-xs text-red-200/70">Acil ilgilenilmesi gereken mutsuz üye</p>
        </button>
      </section>

      {/* Charts */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-medium text-zinc-400">Kategori Bazlı Puan</h2>
          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" domain={[0, 10]} hide />
                <YAxis type="category" dataKey="name" stroke="#71717a" tickLine={false} axisLine={false} width={70} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,.04)" }} contentStyle={{ background: "#14171e", border: "1px solid #2a2f3b", borderRadius: 12 }} />
                <Bar dataKey="value" name="Ortalama" fill="#c6ff3d" radius={[0, 8, 8, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-medium text-zinc-400">Duygu Dağılımı</h2>
          <div className="flex h-44 items-center">
            <div className="h-full flex-1">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3} stroke="none">
                    {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#14171e", border: "1px solid #2a2f3b", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 pr-4 text-sm">
              {pie.map((p) => (
                <li key={p.name} className="flex items-center gap-2 text-zinc-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  {p.name} <b className="text-white">{p.value}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <UploadPanel demo={demo} pending={stats.pending} onChanged={load} />

      {/* Table */}
      <section className="card overflow-hidden" aria-labelledby="table-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-5">
          <h2 id="table-title" className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Sparkles size={18} className="text-brand" /> AI Özetleri & Analiz
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                id="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="İsim veya telefon ara"
                className="w-48 rounded-xl border border-white/10 bg-ink-900 py-2 pl-8 pr-3 text-sm outline-none placeholder:text-zinc-600 focus:border-brand/60"
              />
            </div>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                id={`filter-${f.key}`}
                onClick={() => setFilter(f.key)}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                  filter === f.key
                    ? f.key === "kritik" ? "bg-red-500 text-white" : "bg-brand text-ink-950"
                    : "border border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !demo ? (
          <div className="flex justify-center py-16 text-zinc-500"><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-500">Bu filtreye uygun üye yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  {["Üye", "Telefon", "Puan", "Duygu", "AI Özeti", "Durum", ""].map((h) => (
                    <th key={h} className="px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rows.map((m) => {
                  const a = m.analysis;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelected(m)}
                      className={`cursor-pointer transition hover:bg-white/[0.04] ${a?.critical_alert ? "bg-red-500/[0.05]" : ""}`}
                    >
                      <td className="px-5 py-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          {a?.critical_alert && (
                            <span title="Kritik uyarı" className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                              <AlertTriangle size={12} />
                            </span>
                          )}
                          {m.full_name}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-400">+{m.phone_number}</td>
                      <td className="px-5 py-4">
                        {a ? (
                          <span className={`inline-flex min-w-10 justify-center rounded-lg px-2.5 py-1 text-sm font-bold ring-1 ${scoreColor(a.overall_score)}`}>
                            {a.overall_score}
                          </span>
                        ) : <span className="text-zinc-600">–</span>}
                      </td>
                      <td className={`whitespace-nowrap px-5 py-4 ${a ? sentimentUi[a.sentiment].cls : "text-zinc-600"}`}>
                        {a ? sentimentUi[a.sentiment].label : "–"}
                      </td>
                      <td className="max-w-sm px-5 py-4 text-zinc-300">
                        {a ? <span className="line-clamp-2">{a.summary}</span> : <span className="text-zinc-600">Analiz bekleniyor</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${statusColor[m.survey_status]}`}>
                          {STATUS_LABELS[m.survey_status]}
                        </span>
                      </td>
                      <td className="px-3 text-zinc-600"><ChevronRight size={16} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && <ChatDrawer member={selected} demo={demo} onClose={() => setSelected(null)} />}
    </main>
  );
}

function Kpi({
  icon, title, value, suffix, sub, delay,
}: {
  icon: React.ReactNode; title: string; value: string; suffix?: string; sub: string; delay: number;
}) {
  return (
    <div className="card animate-fadeUp p-5" style={{ animationDelay: `${delay}ms` }}>
      <p className="mb-2 flex items-center gap-2 text-sm text-zinc-400">
        <span className="text-brand">{icon}</span> {title}
      </p>
      <p className="font-display text-5xl font-bold text-white">
        {value} {suffix && <span className="text-lg font-medium text-zinc-500">{suffix}</span>}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

function Bar2({ icon, label, v }: { icon: React.ReactNode; label: string; v: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">{icon} {label}</span>
        <b className="text-white">{v ? v.toFixed(1) : "–"}</b>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-600">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-dark to-brand transition-all duration-700" style={{ width: `${v * 10}%` }} />
      </div>
    </div>
  );
}
