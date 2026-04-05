import { useState, useRef, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const T = {
  navy:"#1E3A6E",navy2:"#1E3A6E",teal:"#3A6FD4",teal2:"#3A6FD4",
  wordmark:"#1A2233",
  tealLight:"#EBF2FD",tealMid:"#7EB3F5",bg:"#F6F7F5",card:"#FFFFFF",
  surface:"#EBF0EB",border:"#DDE3DD",border2:"#C8D0C8",text:"#3D4042",
  muted:"#6B7280",dim:"#9CA3AF",green:"#059669",greenLight:"#ECFDF5",
  amber:"#D97706",amberLight:"#FFFBEB",red:"#DC2626",redLight:"#FEF2F2",
  chart:["#3A6FD4","#1E3A6E","#D97706","#059669","#C77DFF","#FF85A1","#F97316","#06B6D4"],
  pipeline:["#C8F0ED","#90DDD8","#3A6FD4","#3A6FD4","#1E8A85","#0F5F5A","#1E3A6E"],
};

function SignalLogoMark({ size = 32 }) {
  const pad = Math.max(4, Math.round(size * 0.18));
  const svgSize = size - pad * 2;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#1E3A6E",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="14" width="4" height="6" rx="0.5" fill="#7EB3F5" />
        <rect x="10" y="10" width="4" height="10" rx="0.5" fill="#7EB3F5" />
        <rect x="17" y="4" width="4" height="16" rx="0.5" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

const SIGNAL_SYSTEM_PROMPT = `You are Signal — an expert talent analytics analyst specializing in recruiting and talent acquisition. You have deep expertise in TA metrics, recruiting operations, and pipeline management.

When analyzing a recruiting report, you always look for and comment on:
- Time to fill and how it compares to industry benchmarks (avg 30-45 days for tech roles)
- Pipeline conversion rates at each stage (application → screen → interview → offer → hire)
- Offer acceptance rates (below 85% is a red flag)
- Recruiter workload distribution and imbalance
- Roles that have been open too long (60+ days = critical)
- Source of hire effectiveness
- Interview-to-offer ratio (above 5:1 suggests screening issues)
- Any bottlenecks or drop-off points in the pipeline

Your response must always follow this exact structure:

PIPELINE SUMMARY
[2-3 sentence overview of the overall health of the pipeline]

KEY METRICS
[List the most important numbers you found, formatted cleanly]

RED FLAGS 🚩
[List any metrics that are concerning and explain why in plain language]

BRIGHT SPOTS ✓
[List what is working well]

WHAT TO DO NOW
[3-5 specific, prioritized action items. Be direct. Say exactly what needs to happen.]

Speak like a sharp, experienced TA leader presenting to a VP of People — confident, specific, and actionable. Never be vague. Never just restate the data without interpretation.`;

const CHART_PALETTE = { primary: "#0E7EA8", secondary: "#7EC8E3", dark: "#1A2A3A" };
const STEEL_BLUE = "#3D5A80";

function normalizeArrayField(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") {
    return v.split(/\n/).map((l) => l.replace(/^[-•*·\d.)\s]+/i, "").trim()).filter(Boolean);
  }
  return [];
}

function parseExecutiveBriefFromText(text) {
  if (!text || typeof text !== "string") return null;
  const t = text.replace(/\r\n/g, "\n");
  const grab = (startRe, endRes) => {
    const m = t.match(startRe);
    if (!m) return "";
    const rest = t.slice(m.index + m[0].length);
    let cut = rest.length;
    for (const endRe of endRes) {
      const n = rest.search(endRe);
      if (n >= 0 && n < cut) cut = n;
    }
    return rest.slice(0, cut).trim();
  };
  const ps = grab(/PIPELINE SUMMARY\s*/i, [/KEY METRICS/i, /RED FLAGS/i]);
  const km = grab(/KEY METRICS\s*/i, [/RED FLAGS/i, /BRIGHT SPOTS/i]);
  const rf = grab(/RED FLAGS\s*🚩?\s*/i, [/BRIGHT SPOTS/i, /WHAT TO DO/i]);
  const bs = grab(/BRIGHT SPOTS\s*✓?\s*/i, [/WHAT TO DO/i]);
  const wd = grab(/WHAT TO DO NOW\s*/i, []);
  const listFromBlock = (block) =>
    block
      ? block
          .split(/\n/)
          .map((l) => l.replace(/^[-•*·\d.)\s]+/, "").trim())
          .filter(Boolean)
      : [];
  if (!ps && !km && !rf) return null;
  return {
    pipelineSummary: ps || "",
    keyMetrics: listFromBlock(km),
    redFlags: listFromBlock(rf),
    brightSpots: listFromBlock(bs),
    whatToDoNow: listFromBlock(wd),
  };
}

function getExecutiveSectionsFromAnalysis(analysis) {
  if (!analysis) return null;
  const keyMetrics = normalizeArrayField(analysis.keyMetrics);
  const hasStructured =
    !!(analysis.pipelineSummary && String(analysis.pipelineSummary).trim()) ||
    keyMetrics.length > 0 ||
    normalizeArrayField(analysis.redFlags).length > 0 ||
    normalizeArrayField(analysis.brightSpots).length > 0 ||
    normalizeArrayField(analysis.whatToDoNow).length > 0;

  if (hasStructured) {
    return {
      pipelineSummary: String(analysis.pipelineSummary?.trim() || analysis.narrative || "").trim(),
      keyMetrics,
      redFlags: normalizeArrayField(analysis.redFlags),
      brightSpots: normalizeArrayField(analysis.brightSpots),
      whatToDoNow: normalizeArrayField(analysis.whatToDoNow),
    };
  }
  const parsed = parseExecutiveBriefFromText([analysis.narrative, ...(analysis.insights || [])].filter(Boolean).join("\n\n"));
  if (parsed && (parsed.pipelineSummary || parsed.keyMetrics.length)) return parsed;
  return {
    pipelineSummary: analysis.narrative || "",
    keyMetrics: (analysis.insights || []).slice(0, 8).map(String),
    redFlags: [],
    brightSpots: [],
    whatToDoNow: [],
  };
}

function findSourceCol(keys) {
  return keys.find((h) => /source|channel|referral|how\s*heard|candidate\s*source/i.test(h));
}

function extractStatCardsFromSections(sections, filteredData, data, recruiterColH, statusColH) {
  const cards = [];
  const metrics = sections?.keyMetrics || [];
  for (const line of metrics.slice(0, 5)) {
    const m = line.match(/^(.{1,42}?)[\s:–-]+(.+)$/);
    if (m) cards.push({ label: m[1].trim(), value: m[2].trim() });
    else if (line.length < 80) cards.push({ label: "Metric", value: line });
    if (cards.length >= 3) break;
  }
  if (cards.length < 3) {
    cards.push({ label: "Rows in view", value: String(filteredData.length) });
    if (cards.length < 3) cards.push({ label: "Total rows", value: String(data.length) });
    if (cards.length < 3 && recruiterColH) {
      const n = new Set(filteredData.map((r) => String(r[recruiterColH] ?? ""))).size;
      cards.push({ label: "Recruiters", value: String(n) });
    }
    if (cards.length < 3 && statusColH) {
      const open = filteredData.filter((r) => !/filled/i.test(String(r[statusColH] ?? ""))).length;
      cards.push({ label: "Open pipeline", value: String(open) });
    }
  }
  return cards.slice(0, 3);
}

function stripLeadingActionNumber(s) {
  return String(s ?? "").replace(/^\d+[.)]\s*/, "").trim();
}

/** Split a raw action line into a short title + 1–2 sentence explanation. */
function parseActionItemTitleDetail(raw) {
  const t = stripLeadingActionNumber(raw);
  if (!t) return { title: "", detail: "" };
  const em = t.match(/^(.{2,100}?)\s*[—–\-]\s+(.+)$/s);
  if (em) return { title: em[1].trim(), detail: em[2].trim().replace(/\s+/g, " ") };
  const col = t.match(/^([^:]{2,80}):\s+(.+)$/s);
  if (col) return { title: col[1].trim(), detail: col[2].trim().replace(/\s+/g, " ") };
  const dot = t.indexOf(". ");
  if (dot > 8 && dot < 160) {
    const head = t.slice(0, dot).trim();
    const tail = t.slice(dot + 1).trim();
    if (tail.length >= 12) return { title: head, detail: tail };
  }
  return { title: t, detail: "" };
}

function buildExportReportText(analysis, sections, fileName, filteredLen, totalLen, activeFilters) {
  const lines = [];
  const push = (s = "") => lines.push(s);
  const fe = Object.entries(activeFilters || {}).filter(([, v]) => v);
  push("SIGNAL REPORT");
  push("=".repeat(48));
  push(`Title: ${analysis?.title || "Untitled"}`);
  push(`Source file: ${fileName || "—"}`);
  push(`Generated: ${new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`);
  if (analysis?.reportType) push(`Report type: ${analysis.reportType}`);
  if (analysis?.ats && analysis.ats !== "unknown") push(`ATS (detected): ${analysis.ats}`);
  push(`Rows in view: ${filteredLen.toLocaleString()} (total ${totalLen.toLocaleString()})`);
  if (fe.length) push(`Active filters: ${fe.map(([k, v]) => `${k.replace(/Primary /i, "")}: ${v}`).join(" · ")}`);
  push("");
  const sec = sections || {};
  if (sec.pipelineSummary) {
    push("PIPELINE SUMMARY");
    push(sec.pipelineSummary);
    push("");
  }
  if (sec.keyMetrics?.length) {
    push("KEY METRICS");
    sec.keyMetrics.forEach((m) => push(`• ${m}`));
    push("");
  }
  if (sec.redFlags?.length) {
    push("RED FLAGS");
    sec.redFlags.forEach((m) => push(`• ${m}`));
    push("");
  }
  if (sec.brightSpots?.length) {
    push("BRIGHT SPOTS");
    sec.brightSpots.forEach((m) => push(`• ${m}`));
    push("");
  }
  if (sec.whatToDoNow?.length) {
    push("WHAT TO DO NOW");
    sec.whatToDoNow.forEach((m, i) => push(`${i + 1}. ${m}`));
    push("");
  }
  if (analysis?.narrative) {
    push("NARRATIVE (CHRO)");
    push(analysis.narrative);
    push("");
  }
  if (analysis?.insights?.length) {
    push("KEY SIGNALS");
    analysis.insights.forEach((m, i) => push(`${i + 1}. ${m}`));
    push("");
  }
  if (analysis?.suggestedQuestions?.length) {
    push("SUGGESTED QUESTIONS");
    analysis.suggestedQuestions.forEach((q, i) => push(`${i + 1}. ${q}`));
    push("");
  }
  push("—");
  push("Exported from Signal");
  return lines.join("\n");
}

function ExecutiveDashboardLeft({ sections }) {
  if (!sections) return null;
  const ps = sections.pipelineSummary || "";
  const km = sections.keyMetrics || [];
  const rf = sections.redFlags || [];
  const bs = sections.brightSpots || [];
  const sectionTitle = (label, color = T.muted) => (
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color, marginBottom: 10 }}>{label}</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: STEEL_BLUE, marginBottom: 10 }}>Pipeline summary</div>
        <p style={{ fontSize: 14, lineHeight: 1.72, color: T.text, margin: 0 }}>{ps || "—"}</p>
      </div>
      {km.length > 0 && (
        <div>
          {sectionTitle("Key metrics")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {km.map((line, i) => {
              const colon = line.indexOf("—") >= 0 ? "—" : line.indexOf(":") >= 0 ? ":" : null;
              let label = line;
              let val = "";
              if (colon) {
                const parts = line.split(colon);
                label = parts[0].trim();
                val = parts.slice(1).join(colon).trim();
              } else {
                const m = line.match(/^(.{1,48}?)[\s]+([\d%$,.\-+]+.*)$/);
                if (m) {
                  label = m[1].trim();
                  val = m[2].trim();
                }
              }
              return (
                <div
                  key={i}
                  style={{
                    background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
                    border: `1px solid ${CHART_PALETTE.secondary}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    boxShadow: "0 2px 8px rgba(14,126,168,0.06)",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: CHART_PALETTE.dark, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6, lineHeight: 1.35 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: CHART_PALETTE.primary, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{val || line}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {rf.length > 0 && (
        <div style={{ borderLeft: `4px solid ${T.red}`, paddingLeft: 14, background: T.redLight, borderRadius: "0 10px 10px 0", padding: "12px 14px 12px 16px" }}>
          {sectionTitle("Red flags", T.red)}
          <ul style={{ margin: 0, paddingLeft: 18, color: T.text, fontSize: 13, lineHeight: 1.65 }}>
            {rf.map((t, i) => (
              <li key={i} style={{ marginBottom: i < rf.length - 1 ? 6 : 0 }}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {bs.length > 0 && (
        <div style={{ borderLeft: `4px solid ${T.green}`, paddingLeft: 14, background: T.greenLight, borderRadius: "0 10px 10px 0", padding: "12px 14px 12px 16px" }}>
          {sectionTitle("Bright spots", T.green)}
          <ul style={{ margin: 0, paddingLeft: 18, color: T.text, fontSize: 13, lineHeight: 1.65 }}>
            {bs.map((t, i) => (
              <li key={i} style={{ marginBottom: i < bs.length - 1 ? 6 : 0 }}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ActionItemsPanel({ items, checkedMap, onToggle }) {
  if (!items?.length) return null;
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderLeft: `4px solid ${CHART_PALETTE.primary}`,
        borderRadius: 12,
        boxShadow: "0 1px 2px rgba(30,58,110,0.05), 0 8px 28px rgba(0,0,0,0.04)",
        overflow: "hidden",
        marginBottom: 22,
      }}
    >
      <div
        style={{
          padding: "16px 20px 14px",
          borderBottom: `1px solid ${T.border}`,
          background: "linear-gradient(180deg, rgba(14,126,168,0.06) 0%, transparent 100%)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: T.navy, letterSpacing: -0.3, marginBottom: 4 }}>Your next steps</div>
        <div style={{ fontSize: 13, color: T.muted, fontWeight: 500 }}>Based on Signal's analysis</div>
      </div>
      <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item, i) => {
          const { title, detail } = parseActionItemTitleDetail(item.raw);
          const done = !!checkedMap[i];
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "14px 16px",
                background: done ? T.surface : T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                opacity: done ? 0.88 : 1,
                transition: "opacity .15s, background .15s",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: CHART_PALETTE.primary,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: T.text,
                    lineHeight: 1.45,
                    marginBottom: detail ? 6 : 0,
                    textDecoration: done ? "line-through" : "none",
                  }}
                >
                  {title || item.raw}
                </div>
                {detail ? (
                  <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{detail}</div>
                ) : null}
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                  paddingTop: 2,
                }}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggle(i)}
                  aria-label={`Mark action ${i + 1} done`}
                  style={{
                    width: 20,
                    height: 20,
                    cursor: "pointer",
                    accentColor: CHART_PALETTE.primary,
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExecutiveDashboardCharts({ pipelineBar, sourceDonut, statCards, chartReady }) {
  const barRef = useRef(null);
  const donutRef = useRef(null);
  const barInst = useRef(null);
  const donutInst = useRef(null);

  useEffect(() => {
    if (!chartReady || typeof window === "undefined" || !window.Chart) return;
    const Chart = window.Chart;
    if (barInst.current) {
      barInst.current.destroy();
      barInst.current = null;
    }
    if (donutInst.current) {
      donutInst.current.destroy();
      donutInst.current = null;
    }
    if (pipelineBar?.labels?.length && barRef.current) {
      const ctx = barRef.current.getContext("2d");
      barInst.current = new Chart(ctx, {
        type: "bar",
        data: {
          labels: pipelineBar.labels,
          datasets: [
            {
              label: "Volume",
              data: pipelineBar.values,
              backgroundColor: CHART_PALETTE.primary,
              borderRadius: 6,
              maxBarThickness: 36,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: CHART_PALETTE.dark, maxRotation: 45, minRotation: 0, font: { size: 10 } }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: CHART_PALETTE.dark }, grid: { color: "rgba(26,42,58,0.08)" } },
          },
        },
      });
    }
    if (sourceDonut?.labels?.length && donutRef.current) {
      const ctx = donutRef.current.getContext("2d");
      const n = sourceDonut.labels.length;
      const bg = [CHART_PALETTE.primary, CHART_PALETTE.secondary, CHART_PALETTE.dark, "#5BA3C6", "#9FD4E8", "#2d4a5e"];
      donutInst.current = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: sourceDonut.labels,
          datasets: [{ data: sourceDonut.values, backgroundColor: bg.slice(0, n), borderWidth: 0, hoverOffset: 6 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: { position: "bottom", labels: { color: CHART_PALETTE.dark, boxWidth: 10, font: { size: 10 } } },
          },
        },
      });
    }
    return () => {
      barInst.current?.destroy();
      donutInst.current?.destroy();
      barInst.current = null;
      donutInst.current = null;
    };
  }, [chartReady, pipelineBar, sourceDonut]);

  const hasCharts = (pipelineBar?.labels?.length > 0) || (sourceDonut?.labels?.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {pipelineBar?.labels?.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${CHART_PALETTE.secondary}`, borderRadius: 12, padding: 12, boxShadow: "0 4px 20px rgba(14,126,168,0.08)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: CHART_PALETTE.dark, textTransform: "uppercase", marginBottom: 8 }}>Pipeline by stage</div>
          <div style={{ height: 200, position: "relative" }}>
            <canvas ref={barRef} />
          </div>
        </div>
      )}
      {sourceDonut?.labels?.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${CHART_PALETTE.secondary}`, borderRadius: 12, padding: 12, boxShadow: "0 4px 20px rgba(14,126,168,0.08)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: CHART_PALETTE.dark, textTransform: "uppercase", marginBottom: 8 }}>Source breakdown</div>
          <div style={{ height: 220, position: "relative" }}>
            <canvas ref={donutRef} />
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, maxWidth: "100%" }}
      >
        {statCards.map((c, i) => (
          <div
            key={i}
            style={{
              background: `linear-gradient(145deg, ${CHART_PALETTE.dark} 0%, #24364a 100%)`,
              borderRadius: 10,
              padding: "12px 14px",
              border: `1px solid rgba(126,200,227,0.35)`,
              boxShadow: "0 6px 16px rgba(26,42,58,0.2)",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: CHART_PALETTE.secondary, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{c.value}</div>
          </div>
        ))}
      </div>
      {!chartReady && <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: 8 }}>Loading charts…</div>}
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const STATUS_MAP = {"filled":"Filled","on hold":"On Hold"};
function normalizeStatus(v) {
  const s = String(v).toLowerCase().trim();
  if (STATUS_MAP[s]) return STATUS_MAP[s];
  if (s.includes("not act")) return "Open, not actively recruiting";
  if (s.includes("open") && s.includes("act")) return "Open, actively recruiting";
  return String(v).trim();
}
const CANONICAL_STATUSES = ["Open, actively recruiting","Open, not actively recruiting","On Hold","Filled"];
function isStatusCol(h) { return /update|status|state|disposition/i.test(h); }
function isRecruiterCol(h) { return /^recruiter$|primary.rec|sourcer|ta.partner|hiring.partner/i.test(h); }
function isDeptCol(h) { return /department|dept|division|department.head|business.unit/i.test(h); }
function isRoleCol(h) { return /job.req|requisition|position|role|title/i.test(h); }
function findOpenDateCol(keys) {
  return keys.find(h => /open.*date|date.*open|created|posted|req.*date|start\s*date|date\s*opened|open\s*since/i.test(h));
}
function findLocationCol(keys) {
  return keys.find(h => /location|city|office|site|region/i.test(h) && !/time|zone/i.test(h));
}
function findHMCol(keys) {
  return keys.find(h => /hiring\s*manager|hiring\.manager|hm\s*name|hiring\s*mgr|manager\s*name/i.test(h));
}
function parseCellDate(v) {
  if (v==null||v==="") return null;
  if (typeof v==="number" && v>30000 && v<60000) {
    const utc = new Date((v - 25569) * 86400 * 1000);
    return isNaN(utc.getTime()) ? null : utc;
  }
  if (typeof v==="number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}
function statusBadgeMeta(raw) {
  const s = String(raw ?? "").toLowerCase();
  if (/frozen/.test(s)) return { bg: T.surface, fg: T.dim, border: T.border2, label: String(raw || "Frozen").trim() || "Frozen" };
  if (/on hold|hold/.test(s) && !/active/.test(s)) return { bg: T.amberLight, fg: T.amber, border: T.amber, label: "On Hold" };
  if (/filled|closed|complete/.test(s)) return { bg: T.greenLight, fg: T.green, border: T.green, label: "Filled" };
  if (/active|open.*act|actively/.test(s)) return { bg: T.tealLight, fg: T.teal2, border: T.teal2, label: "Active" };
  if (/not act|passive/.test(s)) return { bg: T.surface, fg: T.muted, border: T.border, label: "Open" };
  return { bg: T.surface, fg: T.muted, border: T.border, label: String(raw || "—").trim() || "—" };
}
function isNumericCol(vals) { return vals.length > 0 && vals.filter(v=>typeof v==="number").length/vals.length > 0.75; }
function isTotalCol(h) { return /total|sum|grand/i.test(h); }
function shortStage(s) {
  return s.replace(/Recruiter Screen/i,"Screen").replace(/Hiring Manager Screen/i,"HM Screen")
    .replace(/Virtual Interview/i,"Virtual").replace(/Onsite Interview/i,"Onsite")
    .replace(/Final Round/i,"Final").replace(/Interview/i,"Int.");
}
function leaderboardStatusDots(active, hold, other, cap = 36) {
  const total = active + hold + other;
  if (!total) return [];
  let na = Math.round((active / total) * cap);
  let nh = Math.round((hold / total) * cap);
  let ng = Math.max(0, cap - na - nh);
  const arr = [];
  for (let i = 0; i < na; i++) arr.push("teal");
  for (let i = 0; i < nh; i++) arr.push("amber");
  for (let i = 0; i < ng; i++) arr.push("gray");
  return arr.slice(0, cap);
}

function uniqueVals(rows, col) {
  if (isStatusCol(col)) {
    const found = new Set(rows.map(r=>normalizeStatus(r[col]??"")));
    return CANONICAL_STATUSES.filter(s=>found.has(s));
  }
  return [...new Set(rows.map(r=>String(r[col]??"")))].filter(v=>v&&v!=="undefined"&&v!=="").sort();
}

function cleanData(headers, rows) {
  const vh = headers.filter(h => h && !h.match(/^Unnamed[:\s_]/i) && h.trim() && !h.match(/^Column\d+$/i));
  const vr = rows.filter(row => {
    const vals = Object.values(row);
    if (vals.every(v=>v===""||v==null)) return false;
    const first = String(Object.values(row)[0]??"").toLowerCase().trim();
    if (/^(grand\s+)?total$|^subtotal$|^sum$|^average$/.test(first)) return false;
    return true;
  }).map(row => {
    const out = {};
    vh.forEach(h => {
      let v = row[h];
      if (typeof v === "string") {
        const c = v.trim();
        const n = parseFloat(c.replace(/[$,%\s]/g,""));
        if (!isNaN(n) && c !== "") { out[h]=n; return; }
        out[h] = c;
      } else out[h] = v;
    });
    return out;
  });
  // Forward-fill blank categorical cells (Workday groups rows this way)
  const lastSeen = {};
  vr.forEach(row => {
    vh.forEach(h => {
      const v = row[h];
      const isEmpty = v===""||v==null||v===undefined;
      if (isEmpty) { if (lastSeen[h]!==undefined) row[h]=lastSeen[h]; }
      else if (typeof v==="string"&&v.trim()!=="") lastSeen[h]=v;
      else if (typeof v!=="number") lastSeen[h]=v;
    });
  });
  return { headers: vh, rows: vr };
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("Need header + data rows");
  function pr(line) {
    const cells=[]; let cell=""; let inQ=false;
    for (let i=0;i<line.length;i++) {
      const c=line[i];
      if(c==='"'){if(inQ&&line[i+1]==='"'){cell+='"';i++;}else inQ=!inQ;}
      else if(c===','&&!inQ){cells.push(cell.trim());cell="";}
      else cell+=c;
    }
    cells.push(cell.trim()); return cells;
  }
  const rh = pr(lines[0]).map(h=>h.replace(/^["']|["']$/g,"").trim());
  const rows = lines.slice(1).filter(l=>l.trim()).map(line=>{
    const vals=pr(line); const obj={};
    rh.forEach((h,i)=>{ const raw=(vals[i]??"").replace(/^["']|["']$/g,"").trim(); const n=parseFloat(raw.replace(/[$,%\s]/g,"")); obj[h]=!isNaN(n)&&raw!==""?n:raw; });
    return obj;
  });
  return cleanData(rh, rows);
}

function parseTSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const rh = lines[0].split("\t").map(h=>h.trim());
  const rows = lines.slice(1).filter(l=>l.trim()).map(line=>{
    const vals=line.split("\t"); const obj={};
    rh.forEach((h,i)=>{ const raw=(vals[i]??"").trim(); const n=parseFloat(raw.replace(/[$,%\s]/g,"")); obj[h]=!isNaN(n)&&raw!==""?n:raw; });
    return obj;
  });
  return cleanData(rh, rows);
}

function toCSVUrl(url) {
  const m=url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if(!m) return null;
  const gid=(url.match(/gid=(\d+)/)||[])[1]||"0";
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}

async function exportPDF(analysis, summaryCards, fileName, isPipelineReport, pipelineNumericCols, activeFilters, filteredCount, totalCount, filteredRows) {
  const doc = window._jsPDF && new window._jsPDF.jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  if (!doc) { alert("PDF library still loading — try again."); return; }
  const navy=[30,58,110], teal=[58,111,212], pageW=210, margin=20;
  doc.setFillColor(...navy); doc.rect(0,0,pageW,28,"F");
  doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(16);
  doc.text("Signal.", margin, 17);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(200,220,220);
  doc.text("Talent data, clearly.", margin, 23);
  doc.text(new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}), pageW-margin, 17, {align:"right"});
  let y = 40;
  doc.setTextColor(...navy); doc.setFont("helvetica","bold"); doc.setFontSize(18);
  doc.text(analysis.title||fileName, margin, y); y+=8;
  doc.setDrawColor(...teal); doc.setLineWidth(0.8); doc.line(margin,y,pageW-margin,y); y+=5;

  // Active filters banner
  const filterEntries = activeFilters ? Object.entries(activeFilters).filter(([,v])=>v) : [];
  if (filterEntries.length > 0) {
    doc.setFillColor(232,248,247);
    doc.roundedRect(margin, y, pageW-margin*2, 10, 1.5, 1.5, "F");
    doc.setTextColor(56,184,175);
    doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
    doc.text("FILTERED VIEW", margin+4, y+6.5);
    doc.setFont("helvetica","normal");
    const filterText = filterEntries.map(([k,v])=>`${k.replace(/Primary /i,"")}: ${v}`).join("  ·  ");
    doc.setTextColor(61,64,66);
    doc.text(filterText, margin+32, y+6.5);
    if (filteredCount !== totalCount) {
      doc.setTextColor(107,128,112);
      doc.text(`${filteredCount} of ${totalCount} rows`, pageW-margin, y+6.5, {align:"right"});
    }
    y+=14;
  } else { y+=3; }
    let briefText = analysis.narrative || "";
  let insightsList = Array.isArray(analysis.insights) ? analysis.insights : [];

  if (filterEntries.length > 0 && filteredRows && filteredRows.length > 0) {
    try {
      const apiRes = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 400,
          messages: [{
            role: "user",
            content: "Talent analytics expert. Write a 2-sentence summary and 3 bullet insights ONLY about these " + filteredRows.length + " rows. Active filter: " + filterEntries.map(([k,v]) => k + ": " + v).join(", ") + ". Data: " + JSON.stringify(filteredRows.slice(0, 40)) + ". Return JSON only: {\"brief\":\"...\",\"insights\":[\"...\",\"...\",\"...\"]}"
          }]
        })
      });
      const apiData = await apiRes.json();
      const parsed = JSON.parse(apiData.content[0].text.replace(/```json\n?|```/g, "").trim());
      briefText = parsed.brief;
      insightsList = parsed.insights;
    } catch(e) { console.error("PDF brief generation failed:", e); }
  }

  if (briefText) {
    doc.setFillColor(232,248,247); doc.roundedRect(margin,y,pageW-margin*2,30,2,2,"F");
    doc.setFillColor(...teal); doc.roundedRect(margin,y,3,30,1,1,"F");
    doc.setTextColor(...navy); doc.setFont("helvetica","bold"); doc.setFontSize(8);
    doc.text("THE BRIEF", margin+6, y+6);
    doc.setTextColor(61,64,66); doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.text(doc.splitTextToSize(briefText, pageW-margin*2-12).slice(0,3), margin+6, y+13); y+=38;
  }
  if (insightsList.length) {
    doc.setTextColor(...navy); doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.text("KEY SIGNALS", margin, y); y+=5;
    doc.setDrawColor(...navy); doc.setLineWidth(0.3); doc.line(margin,y,pageW-margin,y); y+=6;
    insightsList.forEach((ins,i)=>{
      const insLines=doc.splitTextToSize(ins,pageW-margin*2-14).slice(0,2);
      const insH=insLines.length>1?16:10;
      doc.setFillColor(i===0?232:235,i===0?248:240,i===0?247:235);
      doc.roundedRect(margin,y,pageW-margin*2,insH,1.5,1.5,"F");
      doc.setTextColor(i===0?56:107,i===0?184:128,i===0?175:112);
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text(String(i+1),margin+4,y+6.5);
      doc.setTextColor(61,64,66); doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
      doc.text(insLines,margin+10,y+6.5); y+=insH+3;
    }); y+=4;
  }
  if (summaryCards?.length) {
    doc.setTextColor(...navy); doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.text("SUMMARY", margin, y); y+=5;
    doc.setDrawColor(...navy); doc.setLineWidth(0.3); doc.line(margin,y,pageW-margin,y); y+=6;
    summaryCards.forEach(card=>{
      if(y>260){doc.addPage();y=20;}
      doc.setFillColor(245,246,245); doc.roundedRect(margin,y,pageW-margin*2,14,2,2,"F");
      const label = isPipelineReport ? card.label : card.recruiter;
      const sub = isPipelineReport ? `${card.roleCount} roles · ${card.total} candidates` : `${card.total} reqs`;
      doc.setTextColor(...navy); doc.setFont("helvetica","bold"); doc.setFontSize(9);
      doc.text(label, margin+4, y+5.5);
      doc.setTextColor(107,128,112); doc.setFont("helvetica","normal"); doc.setFontSize(8);
      doc.text(sub, margin+4, y+10.5); y+=17;
    });
  }
  doc.setFillColor(...navy); doc.rect(0,285,pageW,12,"F");
  doc.setTextColor(200,220,220); doc.setFont("helvetica","normal"); doc.setFontSize(7);
  doc.text("Generated by Signal · aribenezra.com", margin, 292);
  doc.text(fileName, pageW-margin, 292, {align:"right"});
  doc.save(`signal-${fileName.replace(/\.[^.]+$/,"")}-report.pdf`);
}

export default function Signal() {
  const [step, setStep] = useState("upload");
  const [tab, setTab] = useState("file");
  const [headers, setHeaders] = useState([]);
  const [data, setData] = useState([]);
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [gsUrl, setGsUrl] = useState("");
  const [pasteVal, setPasteVal] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [procMsg, setProcMsg] = useState("Reading your data...");
  const [activeFilters, setActiveFilters] = useState({});
  const [drillDown, setDrillDown] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFetchKey, setDrawerFetchKey] = useState(0);
  const [drawerAi, setDrawerAi] = useState("");
  const [drawerAiLoading, setDrawerAiLoading] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(true);
  const [viewMode, setViewMode] = useState("chart");
  const [vizView, setVizView] = useState("bar");
  const [donutGroupBy, setDonutGroupBy] = useState("recruiter");
  const [tableSort, setTableSort] = useState({ key: null, dir: "asc" });
  const [chartJsReady, setChartJsReady] = useState(false);
  const [actionItemChecked, setActionItemChecked] = useState({});
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportCopyFlash, setExportCopyFlash] = useState(false);

  const fileRef = useRef();
  const chatEndRef = useRef();
  const xlsxRef = useRef(null);
  const procInterval = useRef(null);

  useEffect(() => {
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload=()=>{xlsxRef.current=window.XLSX;}; document.head.appendChild(s);
    const p=document.createElement("script");
    p.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    p.onload=()=>{window._jsPDF=window.jspdf;}; document.head.appendChild(p);
  },[]);
  useEffect(() => {
    if (typeof window !== "undefined" && window.Chart) {
      setChartJsReady(true);
      return;
    }
    const c = document.createElement("script");
    c.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
    c.async = true;
    c.onload = () => setChartJsReady(true);
    document.head.appendChild(c);
  }, []);
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[chatMsgs]);
  useEffect(() => {
    if (!drawerOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);
  useEffect(() => {
    if (!drawerOpen || !drillDown?.rows?.length) return;
    let cancelled = false;
    setDrawerAi("");
    setDrawerAiLoading(true);
    const sample = drillDown.rows.slice(0, 45);
    const keys = Object.keys(sample[0] || {});
    const userContent = `Analyze this slice of the pipeline for "${drillDown.label}". Apply the Signal framework. If a metric or section cannot be supported from this slice alone, say so briefly and focus on what the data does show.\n\nColumns: ${keys.join(", ")}\nRows (${drillDown.rows.length} total, sample below):\n${JSON.stringify(sample)}`;
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: SIGNAL_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.error) { setDrawerAi("Could not load AI summary."); return; }
        const text = d?.content?.[0]?.text?.trim() || "Could not generate a summary.";
        setDrawerAi(text);
      })
      .catch(() => {
        if (!cancelled) setDrawerAi("Could not load AI summary — try again.");
      })
      .finally(() => {
        if (!cancelled) setDrawerAiLoading(false);
      });
    return () => { cancelled = true; };
  }, [drawerOpen, drawerFetchKey, drillDown?.label]);

  useEffect(() => {
    if (analysis) setActionItemChecked({});
  }, [analysis]);

  useEffect(() => {
    if (!exportModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setExportModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [exportModalOpen]);

  // ─── DERIVED: report type detection ──────────────────────────────────────
  const pipelineNumericCols = useMemo(()=>{
    if (!analysis||!headers.length) return [];
    return headers.filter(h=>{
      if (isTotalCol(h)) return false;
      const vals = data.map(r=>r[h]).filter(v=>v!==null&&v!==undefined&&v!=="");
      return isNumericCol(vals);
    });
  },[analysis, headers, data]);

  const isPipelineReport = useMemo(()=> pipelineNumericCols.length >= 3, [pipelineNumericCols]);

  // ─── DERIVED: filter columns ──────────────────────────────────────────────
  const filterCols = useMemo(()=>{
    if (!analysis) return [];
    const catCols = headers.filter(h=>{
      const vals = data.map(r=>r[h]).filter(v=>v!==null&&v!==undefined&&v!=="");
      if (!vals.length) return false;
      if (isNumericCol(vals)) return false;
      const unique = new Set(vals.map(String));
      return unique.size >= 2 && unique.size <= 15;
    });
    if (isPipelineReport) {
      const rec = catCols.find(h=>isRecruiterCol(h));
      const dept = catCols.find(h=>isDeptCol(h)&&h!==rec);
      const role = catCols.find(h=>isRoleCol(h)&&h!==rec&&h!==dept);
      return [rec,dept,role].filter(Boolean);
    }
    const rec = catCols.find(h=>isRecruiterCol(h));
    const status = catCols.find(h=>isStatusCol(h));
    const loc = catCols.find(h=>/location|city|office|site/i.test(h));
    return [rec,status,loc].filter(Boolean).slice(0,3);
  },[headers, data, analysis, isPipelineReport]);

  // ─── DERIVED: filtered data ───────────────────────────────────────────────
  const filteredData = useMemo(()=>{
    let d = [...data];
    Object.entries(activeFilters).forEach(([col,val])=>{
      if (!val) return;
      if (isStatusCol(col)) d=d.filter(r=>normalizeStatus(r[col]??"")===val);
      else d=d.filter(r=>String(r[col]??"")=== val);
    });
    return d;
  },[data, activeFilters]);

  const hasFilters = Object.values(activeFilters).some(Boolean);

  // ─── DERIVED: smart chart x-axis ─────────────────────────────────────────
  const chartXKey = useMemo(()=>{
    if (!analysis) return "";
    if (isPipelineReport) {
      const rec = headers.find(h=>isRecruiterCol(h));
      const dept = headers.find(h=>isDeptCol(h)&&h!==rec);
      const role = headers.find(h=>isRoleCol(h)&&h!==rec&&h!==dept);
      const activeRec = rec && activeFilters[rec];
      const activeDept = dept && activeFilters[dept];
      if ((activeRec||activeDept) && role) return role;
      if (rec) return rec;
      if (dept) return dept;
      return analysis.xKey;
    }
    const rec = headers.find(h=>isRecruiterCol(h));
    const status = headers.find(h=>isStatusCol(h));
    const activeRec = rec && activeFilters[rec];
    const activeStatus = status && activeFilters[status];
    if (activeRec && status) return status;
    if (activeStatus && rec) return rec;
    if (rec) return rec;
    return analysis.xKey;
  },[analysis, headers, activeFilters, isPipelineReport]);

  // ─── DERIVED: chart data ──────────────────────────────────────────────────
  const chartData = useMemo(()=>{
    if (!analysis||!filteredData.length) return [];
    const xk = chartXKey;
    if (isPipelineReport && pipelineNumericCols.length) {
      const groups = {};
      filteredData.forEach(row=>{
        const key = String(row[xk]||"Unknown");
        if (!groups[key]) { groups[key]={[xk]:key}; pipelineNumericCols.forEach(c=>{groups[key][shortStage(c)]=0;}); }
        pipelineNumericCols.forEach(c=>{ groups[key][shortStage(c)]+=(Number(row[c])||0); });
      });
      return Object.values(groups).sort((a,b)=>{
        const ta=pipelineNumericCols.reduce((s,c)=>s+(a[shortStage(c)]||0),0);
        const tb=pipelineNumericCols.reduce((s,c)=>s+(b[shortStage(c)]||0),0);
        return tb-ta;
      }).slice(0,15);
    }
    const groups = {};
    filteredData.forEach(row=>{
      const rawKey = isStatusCol(xk)?normalizeStatus(String(row[xk]||"")):String(row[xk]||"Unknown");
      if (!groups[rawKey]) groups[rawKey]={[xk]:rawKey,Count:0};
      groups[rawKey].Count+=1;
    });
    return Object.values(groups).sort((a,b)=>b.Count-a.Count).slice(0,20);
  },[filteredData, analysis, chartXKey, isPipelineReport, pipelineNumericCols]);

  const recruiterColH = useMemo(() => headers.find(isRecruiterCol), [headers]);
  const statusColH = useMemo(() => headers.find(isStatusCol), [headers]);
  const deptColH = useMemo(() => headers.find(h => isDeptCol(h) && h !== recruiterColH), [headers, recruiterColH]);

  const executiveSections = useMemo(() => getExecutiveSectionsFromAnalysis(analysis), [analysis]);

  const pipelineBarForDashboard = useMemo(() => {
    if (!analysis || !filteredData.length || !pipelineNumericCols.length) return null;
    const labels = pipelineNumericCols.map((c) => shortStage(c));
    const values = pipelineNumericCols.map((c) =>
      filteredData.reduce((s, r) => s + (Number(r[c]) || 0), 0)
    );
    if (values.every((v) => v === 0)) return null;
    return { labels, values };
  }, [analysis, filteredData, pipelineNumericCols]);

  const sourceDonutForDashboard = useMemo(() => {
    if (!analysis || !filteredData.length) return null;
    const srcCol = findSourceCol(headers);
    if (!srcCol) return null;
    const counts = {};
    filteredData.forEach((row) => {
      const k = String(row[srcCol] ?? "").trim() || "Unknown";
      counts[k] = (counts[k] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    if (sorted.length < 2) return null;
    return { labels: sorted.map(([l]) => l), values: sorted.map(([, v]) => v) };
  }, [analysis, filteredData, headers]);

  const dashboardStatCards = useMemo(() => {
    if (!executiveSections) return [];
    return extractStatCardsFromSections(executiveSections, filteredData, data, recruiterColH, statusColH).slice(0, 3);
  }, [executiveSections, filteredData, data, recruiterColH, statusColH]);

  const actionItemsForPanel = useMemo(() => {
    const raw = executiveSections?.whatToDoNow || [];
    return raw.map((r) => ({ raw: String(r) }));
  }, [executiveSections]);

  const exportReportText = useMemo(
    () =>
      buildExportReportText(analysis, executiveSections, fileName, filteredData.length, data.length, activeFilters),
    [analysis, executiveSections, fileName, filteredData.length, data.length, activeFilters]
  );

  const donutDataPack = useMemo(() => {
    if (!analysis || !filteredData.length) return { data: [], groupKey: null, dimensionLabel: "" };
    const rec = recruiterColH;
    const status = statusColH;
    const wantRec = donutGroupBy === "recruiter" && rec;
    const wantStatus = donutGroupBy === "status" && status;
    let groupKey = null;
    let dimensionLabel = "";
    if (wantRec) {
      groupKey = rec;
      dimensionLabel = "Recruiter";
    } else if (wantStatus || (!wantRec && status)) {
      groupKey = status;
      dimensionLabel = "Status";
    } else if (rec) {
      groupKey = rec;
      dimensionLabel = "Recruiter";
    } else if (status) {
      groupKey = status;
      dimensionLabel = "Status";
    } else {
      const xk = chartXKey;
      if (!xk || !chartData.length) return { data: [], groupKey: null, dimensionLabel: "" };
      const data = chartData.map((row) => {
        const name = String(row[xk] ?? "");
        let value = 0;
        if (isPipelineReport && pipelineNumericCols.length) {
          pipelineNumericCols.forEach((c) => { value += Number(row[shortStage(c)]) || 0; });
        } else {
          value = Number(row.Count) || 0;
        }
        return { name, value };
      }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
      return { data, groupKey: xk, dimensionLabel: String(xk).replace(/Primary /i, "") };
    }
    const counts = {};
    filteredData.forEach((row) => {
      const raw = groupKey ? row[groupKey] : "";
      const key = isStatusCol(groupKey) ? normalizeStatus(String(raw ?? "")) : String(raw ?? "Unknown");
      counts[key] = (counts[key] || 0) + 1;
    });
    const data = Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    return { data, groupKey, dimensionLabel };
  }, [analysis, filteredData, chartData, chartXKey, isPipelineReport, pipelineNumericCols, recruiterColH, statusColH, donutGroupBy]);

  const heatmapData = useMemo(() => {
    if (!filteredData.length) return null;
    const rec = recruiterColH || deptColH;
    const status = statusColH;
    if (rec && status) {
      const recruiters = [...new Set(filteredData.map((r) => String(r[rec] || "Unknown")))].sort();
      const statuses = [...new Set(filteredData.map((r) => normalizeStatus(String(r[status] ?? ""))))].sort();
      const counts = {};
      let max = 0;
      filteredData.forEach((row) => {
        const rr = String(row[rec] || "Unknown");
        const ss = normalizeStatus(String(row[status] ?? ""));
        const k = `${rr}\0${ss}`;
        counts[k] = (counts[k] || 0) + 1;
        max = Math.max(max, counts[k]);
      });
      return { type: "rec-status", recCol: rec, statusCol: status, recruiters, statuses, counts, max };
    }
    if (isPipelineReport && pipelineNumericCols.length && rec) {
      const recruiters = [...new Set(filteredData.map((r) => String(r[rec] || "Unknown")))].sort();
      const stages = pipelineNumericCols.map((c) => shortStage(c));
      const counts = {};
      let max = 0;
      filteredData.forEach((row) => {
        const rr = String(row[rec] || "Unknown");
        pipelineNumericCols.forEach((c) => {
          const ss = shortStage(c);
          const k = `${rr}\0${ss}`;
          const v = Number(row[c]) || 0;
          counts[k] = (counts[k] || 0) + v;
          max = Math.max(max, counts[k]);
        });
      });
      return { type: "rec-stage", recCol: rec, stageCols: pipelineNumericCols, recruiters, statuses: stages, counts, max };
    }
    return null;
  }, [filteredData, recruiterColH, deptColH, statusColH, isPipelineReport, pipelineNumericCols]);

  const sortedTableRows = useMemo(() => {
    if (!tableSort.key) return filteredData;
    const k = tableSort.key;
    const dir = tableSort.dir === "asc" ? 1 : -1;
    const rows = [...filteredData];
    rows.sort((a, b) => {
      const va = a[k];
      const vb = b[k];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
    return rows;
  }, [filteredData, tableSort]);

  const recruiterLeaderboard = useMemo(() => {
    if (!analysis || !filteredData.length || !recruiterColH) return null;
    const recCol = recruiterColH;
    const statusCol = statusColH;
    const groups = {};
    filteredData.forEach((row) => {
      const key = String(row[recCol] ?? "Unknown");
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    const isFilled = (r) => statusCol && /filled/i.test(String(r[statusCol] ?? ""));
    const entries = Object.entries(groups).map(([rawLabel, rows]) => {
      const openRows = statusCol ? rows.filter((r) => !isFilled(r)) : rows;
      const openCount = openRows.length;
      let active = 0;
      let hold = 0;
      let other = 0;
      openRows.forEach((r) => {
        if (!statusCol) {
          other += 1;
          return;
        }
        const ns = normalizeStatus(String(r[statusCol] ?? ""));
        if (ns === "Open, actively recruiting") active += 1;
        else if (ns === "On Hold") hold += 1;
        else other += 1;
      });
      return {
        rawLabel,
        displayName: rawLabel.replace(/^Primary\s+/i, "").trim() || rawLabel,
        openCount,
        active,
        hold,
        other,
      };
    });
    entries.sort((a, b) => b.openCount - a.openCount);
    const maxOpen = Math.max(1, ...entries.map((e) => e.openCount));
    return { entries, maxOpen, recCol };
  }, [analysis, filteredData, recruiterColH, statusColH]);

  // ─── DERIVED: summary cards ───────────────────────────────────────────────
  const summaryCards = useMemo(()=>{
    if (!analysis||!filteredData.length) return [];
    if (isPipelineReport && pipelineNumericCols.length) {
      const rec = headers.find(h=>isRecruiterCol(h));
      const dept = headers.find(h=>isDeptCol(h)&&h!==rec);
      const role = headers.find(h=>isRoleCol(h)&&h!==rec&&h!==dept);
      const groupCol = rec||dept||headers[0];
      const groups = {};
      filteredData.forEach(row=>{
        const key = String(row[groupCol]||"Unknown");
        if (!groups[key]) groups[key]={label:key,roles:new Set(),stageTotals:{}};
        if (role) groups[key].roles.add(String(row[role]||""));
        pipelineNumericCols.forEach(c=>{groups[key].stageTotals[c]=(groups[key].stageTotals[c]||0)+(Number(row[c])||0);});
      });
      return Object.values(groups).map(g=>({
        label:g.label, roleCount:g.roles.size,
        total:Object.values(g.stageTotals).reduce((s,v)=>s+v,0),
        stageTotals:g.stageTotals
      })).sort((a,b)=>b.total-a.total);
    }
    const rec = headers.find(h=>isRecruiterCol(h));
    const status = headers.find(h=>isStatusCol(h));
    if (!rec) return [];
    const recruiters = [...new Set(filteredData.map(r=>String(r[rec]||"")))].filter(Boolean).sort();
    return recruiters.map(r=>{
      const rows = filteredData.filter(row=>String(row[rec]||"")===r);
      const sg = {};
      rows.forEach(row=>{ const s=status?normalizeStatus(String(row[status]||"")):"Unknown"; sg[s]=(sg[s]||0)+1; });
      return {recruiter:r.replace(/Primary /i,""),total:rows.length,statuses:sg};
    });
  },[filteredData,analysis,headers,isPipelineReport,pipelineNumericCols]);

  const drawerDetail = useMemo(() => {
    if (!drillDown?.rows?.length) return null;
    const rows = drillDown.rows;
    const keys = Object.keys(rows[0] || {});
    const statusCol = keys.find(isStatusCol);
    const dateCol = findOpenDateCol(keys);
    const roleCol = keys.find(isRoleCol);
    const locCol = findLocationCol(keys);
    const hmCol = findHMCol(keys);
    const isFilledRow = (r) => statusCol && /filled/i.test(String(r[statusCol] ?? ""));
    const openRows = statusCol ? rows.filter((r) => !isFilledRow(r)) : rows;
    const totalOpenReqs = openRows.length;
    let avgDaysOpen = null;
    if (dateCol) {
      const now = Date.now();
      const days = [];
      for (const r of openRows) {
        const dt = parseCellDate(r[dateCol]);
        if (dt) days.push(Math.max(0, (now - dt.getTime()) / 86400000));
      }
      if (days.length) avgDaysOpen = days.reduce((a, b) => a + b, 0) / days.length;
    }
    const statusBreakdown = {};
    if (statusCol) {
      rows.forEach((r) => {
        const s = normalizeStatus(String(r[statusCol] ?? ""));
        statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
      });
    }
    const roleCards = rows.map((row, i) => {
      const title = roleCol
        ? String(row[roleCol] ?? "—")
        : String(row[keys[0]] ?? `Row ${i + 1}`);
      return {
        i,
        title,
        location: locCol ? String(row[locCol] ?? "") : "",
        statusRaw: statusCol ? row[statusCol] : "",
        hm: hmCol ? String(row[hmCol] ?? "") : "",
      };
    });
    return { totalOpenReqs, avgDaysOpen, dateCol, statusBreakdown, statusCol, roleCards, roleCol, locCol, hmCol };
  }, [drillDown]);

  // ─── PROCESSING ───────────────────────────────────────────────────────────
  const startProc = () => {
    const msgs=["Reading your data...","Cleaning the report...","Finding the signal...","Building your brief..."];
    let i=0; setProcMsg(msgs[0]);
    procInterval.current=setInterval(()=>{i=(i+1)%msgs.length;setProcMsg(msgs[i]);},1800);
    setStep("processing");
  };
  const stopProc = () => clearInterval(procInterval.current);

  const resetAll = () => {
    setActiveFilters({}); setDrillDown(null); setDrawerOpen(false);
    setSignalsOpen(true); setViewMode("chart");
    setVizView("bar"); setDonutGroupBy("recruiter"); setTableSort({ key: null, dir: "asc" });
    setExportModalOpen(false);
  };

  const copyExportReport = async () => {
    try {
      await navigator.clipboard.writeText(exportReportText);
      setExportCopyFlash(true);
      setTimeout(() => setExportCopyFlash(false), 2000);
    } catch {
      setExportCopyFlash(false);
    }
  };

  const downloadExportReport = () => {
    const blob = new Blob([exportReportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signal-report-${(fileName || "export").replace(/\.[^.]+$/, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const closeDrawer = () => setDrawerOpen(false);

  const run = async (hdrs, rows, name) => {
    setHeaders(hdrs); setData(rows); setFileName(name);
    resetAll(); startProc();
    try {
      const sample = rows.slice(0,60);
      const ctrl = new AbortController();
      const to = setTimeout(()=>ctrl.abort(), 45000);
      const res = await fetch("/api/chat",{
        method:"POST", signal:ctrl.signal,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:4096,
          messages:[{role:"user",content:`You are a senior talent analytics expert. Return ONLY valid JSON — no markdown, no backticks, no preamble.

Dataset: "${name}"
Columns: ${hdrs.join(", ")}
Total rows: ${rows.length}
Sample: ${JSON.stringify(sample)}

Identify report type: pipeline (multiple numeric stage columns like Recruiter Screen, HM Screen, Offer), time-to-hire, source-of-hire, headcount, recruiter-activity, offer-acceptance, dei, open-reqs, trend, or other.

For pipeline reports: xKey = the primary grouping column (recruiter name, department head, or department). yKeys = the stage columns (numeric).
For open-reqs: xKey = recruiter or department column. yKeys = ["Count"].
chartType: bar for comparisons, line/area for time trends 7+ points, pie for 3-7 proportions.

Also produce an executive brief as structured fields (concise, specific, with real numbers from the sample when possible):
- pipelineSummary: 2–3 sentences on overall pipeline health.
- keyMetrics: 4–8 strings like "Time to fill — 38 days" or "Offer acceptance — 82%".
- redFlags: 2–5 concerning findings with brief why.
- brightSpots: 2–4 things working well.
- whatToDoNow: 3–5 prioritized action strings (no leading numbers required).

Return exactly this JSON shape (use [] for empty arrays where unknown):
{"title":"<6-8 word title>","reportType":"<type>","ats":"<lever|workday|ashby|greenhouse|unknown>","chartType":"bar"|"line"|"area"|"pie","xKey":"<exact column name>","yKeys":["<column names>"],"narrative":"<2-3 sentences for a CHRO. Biggest finding first. Real numbers.>","pipelineSummary":"<string>","keyMetrics":["<string>"],"redFlags":["<string>"],"brightSpots":["<string>"],"whatToDoNow":["<string>"],"insights":["<finding with number>","<finding>","<finding>"],"suggestedQuestions":["<question>","<question>","<question>"]}

xKey and yKeys must be exact column names from the dataset.`}]
        })
      });
      clearTimeout(to); stopProc();
      const d = await res.json();
      if (d.error) throw new Error(d.error.message);
      const json = JSON.parse(d.content[0].text.replace(/```json\n?|```/g,"").trim());
      setAnalysis({...json, totalRows:rows.length});
      setChatMsgs([]); setStep("results");
    } catch(e) {
      stopProc(); setStep("upload");
      setError(e.name==="AbortError"?"Timed out — try again.":`Analysis failed: ${e.message}`);
    }
  };

  const handleFile = async (file) => {
    setError("");
    try {
      if (file.name.match(/\.csv$/i)) { const {headers,rows}=parseCSV(await file.text()); await run(headers,rows,file.name); }
      else if (file.name.match(/\.xlsx?$/i)) {
        const XLSX=xlsxRef.current;
        if (!XLSX) { setError("Excel parser loading — try again."); return; }
        const wb=XLSX.read(await file.arrayBuffer(),{type:"arraybuffer"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
        const rh=raw[0].map(String);
        const rawRows=raw.slice(1).filter(r=>r.some(v=>v!=="")).map(row=>{
          const obj={}; rh.forEach((h,i)=>{ const v=row[i]??""; obj[h]=typeof v==="number"?v:(!isNaN(parseFloat(String(v)))&&String(v).trim()!==""?parseFloat(String(v)):String(v)); }); return obj;
        });
        const {headers,rows}=cleanData(rh,rawRows);
        await run(headers,rows,file.name);
      } else setError("Upload a .csv or .xlsx file.");
    } catch { stopProc(); setStep("upload"); setError("Couldn't read that file. Try CSV."); }
  };

  const handleSheet = async () => {
    setError(""); const url=toCSVUrl(gsUrl.trim());
    if (!url) { setError("Not a valid Google Sheets URL."); return; }
    try { startProc(); const res=await fetch(url); if(!res.ok) throw new Error(); const {headers,rows}=parseCSV(await res.text()); await run(headers,rows,"Google Sheet"); }
    catch { stopProc(); setStep("upload"); setError('Share as "Anyone with link → Viewer" first.'); }
  };

  const handlePaste = async () => {
    setError(""); if(!pasteVal.trim()){setError("Paste your data first.");return;}
    try { const {headers,rows}=pasteVal.includes("\t")?parseTSV(pasteVal):parseCSV(pasteVal); await run(headers,rows,"Pasted Data"); }
    catch { setError("Couldn't parse. Copy directly from a spreadsheet."); }
  };

  const ask = async () => {
    if (!chatInput.trim()||asking) return;
    const msg=chatInput.trim(); setChatInput(""); setAsking(true);
    const updated=[...chatMsgs,{role:"user",content:msg}];
    setChatMsgs(updated);
    try {
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2048,
          system:`${SIGNAL_SYSTEM_PROMPT}

Dataset context for this session: "${fileName}", ${data.length} rows. Columns: ${headers.join(", ")}. Sample rows (current filtered view): ${JSON.stringify(filteredData.slice(0,40))}.`,
          messages:updated})});
      const d=await res.json();
      setChatMsgs([...updated,{role:"assistant",content:d.content[0].text}]);
    } catch { setChatMsgs([...updated,{role:"assistant",content:"Error — please try again."}]); }
    setAsking(false);
  };

  const openDrillForColumn = (xk, label) => {
    if (!xk || label == null || label === "") return;
    const rows = filteredData.filter((r) => {
      const val = isStatusCol(xk) ? normalizeStatus(String(r[xk] ?? "")) : String(r[xk] ?? "");
      return val === String(label);
    });
    if (rows.length) {
      setDrillDown({ label, rows, isRecruiter: isRecruiterCol(xk) || isDeptCol(xk) });
      setDrawerOpen(true);
      setDrawerFetchKey((k) => k + 1);
    }
  };

  const handleChartClick = (payload) => {
    if (!analysis) return;
    const label = payload?.activeLabel || payload?.activePayload?.[0]?.payload?.[chartXKey] || payload?.name;
    if (!label) return;
    openDrillForColumn(chartXKey, label);
  };

  const handlePieClick = (slice) => {
    if (!analysis || !donutDataPack.groupKey) return;
    const name = slice?.name ?? slice?.payload?.name;
    if (name == null || name === "") return;
    openDrillForColumn(donutDataPack.groupKey, name);
  };

  const handleHeatmapCellClick = (rowLabel, colLabel) => {
    if (!heatmapData || !analysis) return;
    if (heatmapData.type === "rec-status") {
      const { recCol, statusCol } = heatmapData;
      const rows = filteredData.filter((r) => String(r[recCol] || "Unknown") === rowLabel
        && normalizeStatus(String(r[statusCol] ?? "")) === colLabel);
      if (rows.length) {
        setDrillDown({ label: `${rowLabel} · ${colLabel}`, rows, isRecruiter: true });
        setDrawerOpen(true);
        setDrawerFetchKey((k) => k + 1);
      }
    } else if (heatmapData.type === "rec-stage") {
      const { recCol, stageCols } = heatmapData;
      const col = stageCols.find((c) => shortStage(c) === colLabel);
      if (!col) return;
      const rows = filteredData.filter((r) => String(r[recCol] || "Unknown") === rowLabel && (Number(r[col]) || 0) > 0);
      if (rows.length) {
        setDrillDown({ label: `${rowLabel} · ${colLabel}`, rows, isRecruiter: true });
        setDrawerOpen(true);
        setDrawerFetchKey((k) => k + 1);
      }
    }
  };

  const toggleTableSort = (key) => {
    setTableSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const renderChart = () => {
    if (!analysis||!chartData.length) return <div style={{padding:"2rem",textAlign:"center",color:T.dim,fontSize:13}}>No data for current filters</div>;
    const xk = chartXKey;
    const tt = {contentStyle:{background:T.card,border:`1px solid ${T.border}`,color:T.text,fontFamily:"Inter,sans-serif",fontSize:12,borderRadius:8},labelStyle:{color:T.navy,fontWeight:600},cursor:{fill:"rgba(30,58,110,0.04)"}};
    const ax = {tick:{fill:T.muted,fontSize:11,fontFamily:"Inter,sans-serif"}};
    const barKeys = isPipelineReport ? pipelineNumericCols.map(c=>shortStage(c)) : ["Count"];
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{top:isPipelineReport?8:5,right:8,left:-15,bottom:isPipelineReport?90:70}} onClick={handleChartClick} style={{cursor:"pointer"}}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey={xk} {...ax} angle={-40} textAnchor="end" interval={0}/>
          <YAxis {...ax}/>
          <Tooltip {...tt}/>
          {barKeys.length>1&&<Legend verticalAlign="top" wrapperStyle={{fontFamily:"Inter,sans-serif",fontSize:10,color:T.muted,paddingBottom:8}}/>}
          {barKeys.map((k,i)=><Bar key={k} dataKey={k} fill={(isPipelineReport?T.pipeline:T.chart)[i%(isPipelineReport?T.pipeline:T.chart).length]} stackId="s" radius={i===barKeys.length-1?[3,3,0,0]:[0,0,0,0]}/>)}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderDonut = () => {
    const { data, dimensionLabel } = donutDataPack;
    if (!data.length) {
      return <div style={{ padding: "2rem", textAlign: "center", color: T.dim, fontSize: 13 }}>No data for current filters</div>;
    }
    return (
      <div>
        {recruiterColH && statusColH && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 10 }}>
            {[
              ["recruiter", "By recruiter"],
              ["status", "By status"],
            ].map(([val, lab]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDonutGroupBy(val)}
                style={{
                  background: donutGroupBy === val ? T.navy : T.surface,
                  color: donutGroupBy === val ? "#fff" : T.muted,
                  border: `1px solid ${donutGroupBy === val ? T.navy : T.border}`,
                  borderRadius: 999,
                  padding: "4px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "Inter,sans-serif",
                }}
              >
                {lab}
              </button>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: T.dim, textAlign: "center", marginBottom: 6 }}>{dimensionLabel} · {data.reduce((s, d) => s + d.value, 0)} total</div>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={96}
              paddingAngle={2}
              onClick={(d) => handlePieClick(d)}
              cursor="pointer"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={T.chart[i % T.chart.length]} stroke={T.card} strokeWidth={1} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderHeatmap = () => {
    if (!heatmapData) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", color: T.dim, fontSize: 13, lineHeight: 1.6 }}>
          Heatmap needs a recruiter (or department) column and a status column. Pipeline reports can use recruiter × stage instead when status is missing.
        </div>
      );
    }
    const { recruiters, statuses, counts, max } = heatmapData;
    const colW = Math.max(56, Math.min(88, Math.floor(520 / Math.max(statuses.length, 1))));
    return (
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `minmax(120px, 160px) repeat(${statuses.length}, ${colW}px)`,
            gap: 0,
            minWidth: 160 + statuses.length * colW,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            overflow: "hidden",
            fontSize: 11,
          }}
        >
          <div style={{ background: T.navy, color: "#fff", padding: "8px 10px", fontWeight: 600, display: "flex", alignItems: "center" }} />
          {statuses.map((s) => (
            <div
              key={s}
              title={s}
              style={{
                background: T.navy,
                color: "#fff",
                padding: "8px 6px",
                fontWeight: 600,
                textAlign: "center",
                borderLeft: `1px solid ${T.navy2}`,
                lineHeight: 1.25,
                maxHeight: 56,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s}</span>
            </div>
          ))}
          {recruiters.map((r) => (
            <div key={`row-${r}`} style={{ display: "contents" }}>
              <div
                style={{
                  background: T.surface,
                  padding: "8px 10px",
                  fontWeight: 600,
                  color: T.navy,
                  borderTop: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  lineHeight: 1.25,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r}</span>
              </div>
              {statuses.map((s) => {
                const n = counts[`${r}\0${s}`] || 0;
                const t = max > 0 ? n / max : 0;
                const bg = n === 0 ? T.bg : `rgba(30, 58, 110, ${0.1 + t * 0.78})`;
                const fg = t > 0.45 ? "#fff" : T.text;
                return (
                  <button
                    key={`${r}-${s}`}
                    type="button"
                    onClick={() => handleHeatmapCellClick(r, s)}
                    disabled={n === 0}
                    style={{
                      background: bg,
                      color: fg,
                      border: "none",
                      borderTop: `1px solid ${T.border}`,
                      borderLeft: `1px solid ${T.border}`,
                      padding: "10px 4px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: n ? "pointer" : "default",
                      fontFamily: "Inter,sans-serif",
                      transition: "background .15s",
                      opacity: n ? 1 : 0.55,
                    }}
                  >
                    {n || "—"}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.dim, marginTop: 8, textAlign: "center" }}>Darker = higher count · Click a non-zero cell to drill down</div>
      </div>
    );
  };

  const renderTable = () => {
    if (!filteredData.length) {
      return <div style={{ padding: "2rem", textAlign: "center", color: T.dim, fontSize: 13 }}>No rows for current filters</div>;
    }
    const cols = headers.length ? headers : Object.keys(filteredData[0] || {});
    if (!cols.length) {
      return <div style={{ padding: "2rem", textAlign: "center", color: T.dim, fontSize: 13 }}>No columns</div>;
    }
    return (
      <div style={{ maxHeight: 420, overflow: "auto", border: `1px solid ${T.border}`, borderRadius: 10 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols.length}, minmax(96px, 1fr))`,
            minWidth: cols.length * 110,
            fontSize: 12,
          }}
        >
          {cols.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleTableSort(c)}
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: T.navy,
                color: "#fff",
                border: "none",
                borderRight: `1px solid ${T.navy2}`,
                borderBottom: `1px solid ${T.border}`,
                padding: "10px 8px",
                textAlign: "left",
                fontWeight: 600,
                fontFamily: "Inter,sans-serif",
                fontSize: 11,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {c.replace(/Primary /i, "")}
              {tableSort.key === c ? (tableSort.dir === "asc" ? " ↑" : " ↓") : ""}
            </button>
          ))}
          {sortedTableRows.map((row, ri) => (
            <div key={ri} style={{ display: "contents" }}>
              {cols.map((c) => (
                <div
                  key={c}
                  style={{
                    padding: "8px 8px",
                    borderRight: `1px solid ${T.border}`,
                    borderBottom: `1px solid ${T.border}`,
                    background: ri % 2 === 0 ? T.card : T.surface,
                    color: T.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={String(row[c] ?? "")}
                >
                  {String(row[c] ?? "—")}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const base = {minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"Inter,sans-serif",fontSize:14};
  const inputStyle = {background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontFamily:"Inter,sans-serif",fontSize:14,padding:"9px 12px",outline:"none",width:"100%",boxSizing:"border-box"};

  // ─── UPLOAD SCREEN ────────────────────────────────────────────────────────
  if (step==="upload") return (
    <div style={{...base,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1rem"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .sig-tab{background:transparent;color:${T.muted};border:none;cursor:pointer;font-family:Inter,sans-serif;font-size:13px;font-weight:500;padding:8px 18px;border-radius:8px;transition:all .15s;flex:1;}
        .sig-tab:hover{color:${T.text};}
        .sig-tab-on{background:${T.card};color:${T.text};font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.08),0 0 0 1px ${T.border};}
        .sig-drop{transition:border-color .15s,background .15s;}
        .sig-drop:hover{border-color:${T.teal}!important;background:${T.tealLight}!important;}
        .sig-btn{background:${T.navy};color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;font-family:Inter,sans-serif;cursor:pointer;width:100%;margin-top:12px;transition:background .15s;}
        .sig-btn:hover{background:${T.navy2};}
        input:focus,select:focus,textarea:focus{border-color:${T.teal}!important;box-shadow:0 0 0 3px ${T.tealLight}!important;outline:none;}
        textarea{resize:vertical;}
      `}</style>
      <div style={{marginBottom:"2rem",textAlign:"center"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:12}}>
          <div style={{ boxShadow: "0 4px 24px rgba(30,58,110,0.18)" }}>
            <SignalLogoMark size={56} />
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:42,fontWeight:700,color:T.wordmark,letterSpacing:-1.5,lineHeight:1,fontFamily:"Inter,sans-serif"}}>Signal.</div>
            <div style={{fontSize:15,color:T.dim,marginTop:4,maxWidth:420,lineHeight:1.45}}>Drop a report. Get the story.</div>
          </div>
        </div>
        <div style={{fontSize:13,color:T.muted,margin:"0 auto",lineHeight:1.6}}>
          Drop in a report from your <span style={{color:T.teal2,fontWeight:600}}>People</span> team and <span style={{color:T.teal2,fontWeight:600}}>Signal</span> will read it, visualize it, and help you tell the story.
        </div>
      </div>
      <div style={{width:"100%",maxWidth:500,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{borderTop:`3px solid ${T.navy}`}}></div>
        <div style={{padding:"20px 24px 24px"}}>
          <div style={{display:"flex",gap:2,background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:3,marginBottom:20}}>
            {[["file","File"],["sheet","Google Sheet"],["paste","Paste"]].map(([t,l])=>(
              <button key={t} className={`sig-tab${tab===t?" sig-tab-on":""}`} onClick={()=>{setTab(t);setError("");}}>{l}</button>
            ))}
          </div>
          {tab==="file"&&(
            <div className="sig-drop" onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
              onClick={()=>fileRef.current.click()}
              style={{border:`2px dashed ${dragOver?T.teal:T.border2}`,borderRadius:10,padding:"3rem 1rem",textAlign:"center",cursor:"pointer",background:dragOver?T.tealLight:T.surface}}>
              <div style={{width:40,height:40,background:T.tealLight,border:`1px solid ${T.tealMid}`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v10M5 6l4-4 4 4" stroke={T.teal2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 14h12" stroke={T.teal2} strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
              <div style={{fontSize:14,fontWeight:500,color:T.text,marginBottom:4}}>Drop your file here</div>
              <div style={{color:T.dim,fontSize:12}}>CSV or Excel (.xlsx) · click to browse</div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0])handleFile(e.target.files[0]);}}/>
            </div>
          )}
          {tab==="sheet"&&(
            <div>
              <div style={{fontSize:12,color:T.muted,marginBottom:10,lineHeight:1.6}}>Share as <strong style={{color:T.text}}>"Anyone with link → Viewer"</strong> first.</div>
              <input value={gsUrl} onChange={e=>setGsUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." style={inputStyle}/>
              <button className="sig-btn" onClick={handleSheet}>Analyze sheet</button>
            </div>
          )}
          {tab==="paste"&&(
            <div>
              <div style={{fontSize:12,color:T.muted,marginBottom:10}}>Copy cells from any spreadsheet and paste below.</div>
              <textarea value={pasteVal} onChange={e=>setPasteVal(e.target.value)} placeholder="Paste CSV or spreadsheet data here..." rows={7} style={{...inputStyle,lineHeight:1.6}}/>
              <button className="sig-btn" onClick={handlePaste}>Analyze data</button>
            </div>
          )}
          {error&&<div style={{marginTop:14,padding:"10px 14px",background:T.redLight,border:"1px solid #FECACA",borderRadius:8,color:T.red,fontSize:13,lineHeight:1.5}}>{error}</div>}
        </div>
      </div>
    </div>
  );

  // ─── PROCESSING SCREEN ────────────────────────────────────────────────────
  if (step==="processing") return (
    <div style={{...base,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"2rem"}}>
      <style>{`@keyframes wb{0%,100%{height:5px;opacity:.2}50%{height:32px;opacity:1}}`}</style>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <SignalLogoMark size={32} />
        <span style={{fontSize:20,fontWeight:700,color:T.wordmark,letterSpacing:-0.5,fontFamily:"Inter,sans-serif"}}>Signal.</span>
      </div>
      <div style={{display:"flex",gap:4,alignItems:"flex-end",height:40}}>
        {[0,.08,.16,.24,.32,.40,.48,.56,.64,.72,.80].map((d,i)=>(
          <div key={i} style={{width:5,background:T.teal,borderRadius:3,animation:`wb .9s ease-in-out infinite`,animationDelay:`${d}s`}}/>
        ))}
      </div>
      <div style={{color:T.muted,fontSize:13,fontWeight:500}}>{procMsg}</div>
    </div>
  );

  // ─── RESULTS SCREEN ───────────────────────────────────────────────────────
  const drillCols = drillDown ? Object.keys(drillDown.rows[0]||{}).slice(0,8) : [];
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  const resultsPage = {
    minHeight: "100vh",
    background: `linear-gradient(165deg, ${T.bg} 0%, #eef1ee 42%, rgba(58,111,212,0.09) 100%)`,
    color: T.text,
    fontFamily: "Inter,sans-serif",
    fontSize: 14,
    display: "flex",
    flexDirection: "column",
  };
  const cardAccent = (accent, extra = {}) => ({
    background: T.card,
    border: `1px solid ${T.border}`,
    borderLeft: `4px solid ${accent}`,
    borderRadius: 12,
    boxShadow: "0 1px 2px rgba(30,58,110,0.05), 0 8px 28px rgba(0,0,0,0.04)",
    ...extra,
  });

  return (
    <div style={resultsPage}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes wb{0%,100%{height:4px;opacity:.2}50%{height:18px;opacity:1}}
        @keyframes su{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes drawerSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes vizFadeIn{from{opacity:0}to{opacity:1}}
        .viz-fade{animation:vizFadeIn .28s ease-out}
        .viz-pill{font-family:Inter,sans-serif;font-size:12px;font-weight:600;padding:7px 14px;border-radius:999px;border:1px solid ${T.border};cursor:pointer;transition:background .15s,color .15s,border-color .15s,box-shadow .15s;background:transparent;color:${T.muted};}
        .viz-pill:hover{color:${T.text};border-color:${T.tealMid};background:${T.tealLight};}
        .viz-pill-on{background:${T.navy}!important;color:#fff!important;border-color:${T.navy}!important;box-shadow:0 1px 3px rgba(30,58,110,.2);}
        .lb-wrap{font-family:Inter,sans-serif;}
        .lb-card{text-align:left;width:100%;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;background:linear-gradient(145deg,rgba(30,58,110,.22) 0%,rgba(15,20,32,.92) 100%);border:1px solid rgba(58,111,212,.2);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:14px;box-shadow:0 2px 12px rgba(0,0,0,.25);}
        .lb-card:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(30,58,110,.35);border-color:rgba(58,111,212,.45);}
        .lb-card:focus{outline:2px solid ${T.teal};outline-offset:2px;}
        .drawer-panel-anim{animation:drawerSlideIn .38s cubic-bezier(.22,1,.36,1) forwards}
        .drawer-x:hover{background:rgba(255,255,255,.12)!important;color:#fff!important;}
        .sq-chip{background:${T.card};border:1px solid ${T.border};color:${T.muted};border-radius:20px;padding:5px 14px;cursor:pointer;font-family:Inter,sans-serif;font-size:12px;font-weight:500;transition:all .15s;}
        .sq-chip:hover{border-color:${T.tealMid};color:${T.text};background:${T.tealLight};}
        .back-btn:hover{background:${T.surface}!important;color:${T.text}!important;}
        .ask-btn{background:${T.navy};color:#fff;border:none;border-radius:8px;padding:9px 18px;cursor:pointer;font-size:14px;font-weight:600;font-family:Inter,sans-serif;transition:background .15s;}
        .ask-btn:hover{background:${T.navy2};}
        .ask-btn:disabled{opacity:.5;cursor:not-allowed;}
        .filter-sel{background:${T.card};border:1px solid ${T.border};border-radius:8px;color:${T.text};font-family:Inter,sans-serif;font-size:12px;padding:6px 10px;outline:none;cursor:pointer;transition:border-color .15s;}
        .filter-sel:focus{border-color:${T.teal};box-shadow:0 0 0 3px ${T.tealLight};}
        .view-btn{padding:6px 16px;border-radius:8px;font-size:12px;font-weight:500;font-family:Inter,sans-serif;cursor:pointer;border:none;transition:all .15s;}
        .view-seg{display:inline-flex;gap:4px;background:${T.surface};border:1px solid ${T.border};border-radius:12px;padding:4px;box-shadow:inset 0 1px 2px rgba(0,0,0,.03);}
        .view-seg-btn{padding:11px 22px;border-radius:10px;font-size:13px;font-weight:600;font-family:Inter,sans-serif;cursor:pointer;border:none;transition:background .18s ease,color .18s ease,box-shadow .18s ease;min-width:112px;}
        .view-seg-btn-off{background:transparent;color:${T.muted};}
        .view-seg-btn-off:hover{color:${T.text};background:rgba(255,255,255,.7);}
        .view-seg-btn-on{background:${T.navy}!important;color:#fff!important;box-shadow:0 2px 8px rgba(30,58,110,.22);}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:${T.border2};border-radius:2px;}
        @media(max-width:680px){.rg{grid-template-columns:1fr!important;}}
        .dr:hover td{background:${T.tealLight}!important;}
        input:focus,select:focus{border-color:${T.teal}!important;box-shadow:0 0 0 3px ${T.tealLight}!important;}
      `}</style>

      {/* Sticky top bar */}
      <div style={{
        background: "rgba(255,255,255,0.86)",
        backdropFilter: "saturate(180%) blur(14px)",
        WebkitBackdropFilter: "saturate(180%) blur(14px)",
        borderBottom: `1px solid ${T.border}`,
        padding: "0 24px",
        minHeight: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 20,
        gap: 16,
        boxShadow: "0 4px 24px rgba(30,58,110,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 auto" }}>
          <div style={{ boxShadow: "0 2px 8px rgba(30,58,110,.2)" }}>
            <SignalLogoMark size={32} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 2 }}>Current report</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "min(420px, 48vw)" }} title={fileName}>{fileName}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", fontVariantNumeric: "tabular-nums" }}>
              {hasFilters ? <><span style={{ color: T.teal2 }}>{filteredData.length.toLocaleString()}</span> / {data.length.toLocaleString()} rows</> : <>{data.length.toLocaleString()} rows</>}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: activeFilterCount ? T.navy : T.dim, background: activeFilterCount ? T.tealLight : T.surface, border: `1px solid ${activeFilterCount ? T.tealMid : T.border}`, borderRadius: 8, padding: "6px 12px" }}>
              {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
            </span>
            {analysis?.ats && analysis.ats !== "unknown" && (
              <span style={{ fontSize: 11, fontWeight: 600, background: T.tealLight, color: T.teal2, border: `1px solid ${T.tealMid}`, borderRadius: 20, padding: "4px 10px", textTransform: "capitalize" }}>{analysis.ats}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              style={{ background: "transparent", color: T.navy, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: 12, fontWeight: 600, transition: "all .15s" }}
            >
              Export Report
            </button>
            <button
              onClick={async () => { await exportPDF(analysis, summaryCards, fileName, isPipelineReport, pipelineNumericCols, activeFilters, filteredData.length, data.length, filteredData); }}
              style={{ background: "transparent", color: T.navy, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: 12, fontWeight: 600, transition: "all .15s" }}
            >
              Export PDF
            </button>
            <button
              onClick={() => { setStep("upload"); setAnalysis(null); setChatMsgs([]); setError(""); resetAll(); }}
              style={{ background: T.navy, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontFamily: "Inter,sans-serif", fontSize: 12, fontWeight: 600, transition: "background .15s", boxShadow: "0 2px 8px rgba(30,58,110,.25)" }}
            >
              New report
            </button>
          </div>
        </div>
      </div>

      <div style={{padding:"24px 24px 56px",maxWidth:1180,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
        <h1 style={{fontSize:22,fontWeight:700,color:T.navy,margin:"0 0 20px",letterSpacing:-0.4,lineHeight:1.25}}>{analysis?.title}</h1>

        {/* Filters */}
        {filterCols.length>0&&(
          <div style={{...cardAccent(T.navy),padding:"14px 18px",marginBottom:16,display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            <span style={{fontSize:11,fontWeight:600,color:T.muted,letterSpacing:"0.06em",textTransform:"uppercase",marginRight:4,paddingBottom:2}}>Filters</span>
            {filterCols.map(col=>(
              <div key={col} style={{display:"flex",flexDirection:"column",gap:3}}>
                <label style={{fontSize:10,color:T.dim,fontWeight:500}}>{col.replace(/Primary /i,"")}</label>
                <select className="filter-sel" value={activeFilters[col]||""} onChange={e=>{setActiveFilters(p=>({...p,[col]:e.target.value}));setDrillDown(null);setDrawerOpen(false);}}>
                  <option value="">All</option>
                  {uniqueVals(data,col).map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            ))}
            {hasFilters&&(
              <button onClick={()=>{setActiveFilters({});setDrillDown(null);setDrawerOpen(false);}}
                style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:12,fontWeight:500,marginLeft:"auto",transition:"all .15s"}}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Executive dashboard — AI brief + Chart.js */}
        <div
          style={{
            ...cardAccent(CHART_PALETTE.primary),
            borderTop: `3px solid ${CHART_PALETTE.primary}`,
            marginBottom: 22,
            padding: 0,
            overflow: "hidden",
            background: "linear-gradient(145deg, #ffffff 0%, #f5fafc 48%, rgba(126,200,227,0.14) 100%)",
            boxShadow: "0 10px 40px rgba(14,126,168,0.1)",
          }}
        >
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: "linear-gradient(90deg, rgba(14,126,168,0.07) 0%, transparent 55%)" }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: CHART_PALETTE.dark }}>Executive dashboard</span>
            <span style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>{filteredData.length.toLocaleString()} rows in view</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: "20px 20px 22px", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 60%", minWidth: 300, boxSizing: "border-box", maxWidth: "100%" }}>
              <ExecutiveDashboardLeft sections={executiveSections} />
            </div>
            <div style={{ flex: "1 1 38%", minWidth: 260, boxSizing: "border-box", maxWidth: "100%" }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: CHART_PALETTE.dark, marginBottom: 12 }}>Charts & stats</div>
              <ExecutiveDashboardCharts
                pipelineBar={pipelineBarForDashboard}
                sourceDonut={sourceDonutForDashboard}
                statCards={dashboardStatCards}
                chartReady={chartJsReady}
              />
            </div>
          </div>
        </div>

        {actionItemsForPanel.length > 0 && (
          <ActionItemsPanel
            items={actionItemsForPanel}
            checkedMap={actionItemChecked}
            onToggle={(i) => setActionItemChecked((m) => ({ ...m, [i]: !m[i] }))}
          />
        )}

        {/* View toggle */}
        <div className="view-seg" style={{ marginBottom: 18 }}>
          {[["chart","Chart"],["cards","Summary"]].map(([m,l])=>(
            <button key={m} type="button" className={`view-seg-btn${viewMode===m?" view-seg-btn-on":" view-seg-btn-off"}`} onClick={()=>setViewMode(m)}>
              {l}
            </button>
          ))}
        </div>

        <div className="rg" style={{display:"grid",gridTemplateColumns:"minmax(0,1.2fr) minmax(0,.8fr)",gap:16,marginBottom:16}}>
          <div style={{...cardAccent(T.teal),borderTop:`2px solid ${T.teal}`,overflow:"hidden"}}>
            <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(180deg, rgba(58,111,212,0.06) 0%, transparent 100%)"}}>
              <span style={{fontSize:11,fontWeight:600,color:T.muted,letterSpacing:"0.06em",textTransform:"uppercase"}}>{viewMode==="chart"?"Visualization":"Summary"}</span>
              {hasFilters&&<span style={{fontSize:11,color:T.teal2,fontWeight:500}}>Filtered view</span>}
            </div>
            {viewMode==="chart"?(
              <div style={{padding:"14px 8px 8px"}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14,justifyContent:"center"}}>
                  {[
                    ["bar","Bar chart"],
                    ["donut","Donut chart"],
                    ["heatmap","Heatmap"],
                    ["table","Table view"],
                  ].map(([v, lab]) => (
                    <button
                      key={v}
                      type="button"
                      className={`viz-pill${vizView === v ? " viz-pill-on" : ""}`}
                      onClick={() => setVizView(v)}
                    >
                      {lab}
                    </button>
                  ))}
                </div>
                <div key={vizView} className="viz-fade" style={{ minHeight: vizView === "table" ? 360 : vizView === "heatmap" ? 300 : 280 }}>
                  {vizView === "bar" && renderChart()}
                  {vizView === "donut" && renderDonut()}
                  {vizView === "heatmap" && renderHeatmap()}
                  {vizView === "table" && renderTable()}
                </div>
                {vizView === "bar" && chartData.length > 0 && (
                  <div style={{ fontSize: 11, color: T.dim, textAlign: "center", marginTop: 8 }}>Click any bar for details and a drill-down below</div>
                )}
                {vizView === "donut" && donutDataPack.data.length > 0 && (
                  <div style={{ fontSize: 11, color: T.dim, textAlign: "center", marginTop: 8 }}>Click a slice to drill down</div>
                )}
                {vizView === "heatmap" && heatmapData && (
                  <div style={{ fontSize: 11, color: T.dim, textAlign: "center", marginTop: 8 }}>Click a cell with count to drill down</div>
                )}
                {vizView === "table" && filteredData.length > 0 && (
                  <div style={{ fontSize: 11, color: T.dim, textAlign: "center", marginTop: 8 }}>{filteredData.length} row{filteredData.length !== 1 ? "s" : ""} · Click column headers to sort</div>
                )}
              </div>
            ):(
              <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10,maxHeight:400,overflowY:"auto"}}>
                {summaryCards.length===0?<div style={{color:T.dim,fontSize:13,textAlign:"center",padding:"2rem"}}>No data</div>:
                summaryCards.map((card,i)=>(
                  <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,borderLeft:`3px solid ${i % 2 === 0 ? T.teal2 : T.navy}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                    {isPipelineReport?(
                      <>
                        <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:10}}>
                          <span style={{fontSize:13,fontWeight:600,color:T.navy}}>{card.label}</span>
                          <span style={{fontSize:12,color:T.dim}}>{card.roleCount} role{card.roleCount!==1?"s":""}</span>
                          <span style={{fontSize:12,fontWeight:600,color:T.teal2,marginLeft:"auto"}}>{card.total} total candidates</span>
                        </div>
                        <div style={{overflowX:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead>
                              <tr>
                                {Object.keys(card.stageTotals).map(stage=>(
                                  <th key={stage} style={{padding:"4px 10px",textAlign:"center",fontSize:10,fontWeight:600,color:T.muted,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap",letterSpacing:"0.03em"}}>
                                    {stage.replace("Recruiter Screen","Screen").replace("Hiring Manager Screen","HM Screen").replace("Virtual Interview","Virtual").replace("Onsite Interview","Onsite").replace("Final Round","Final")}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {Object.entries(card.stageTotals).map(([stage,count],si)=>(
                                  <td key={stage} style={{padding:"6px 10px",textAlign:"center",fontWeight:600,fontSize:13,color:count>0?T.navy:T.dim,background:count>0?T.tealLight:"transparent",borderRadius:6}}>
                                    {count||"—"}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </>
                    ):(
                      <>
                        <div style={{fontSize:13,fontWeight:600,color:T.navy,marginBottom:8}}>
                          {card.recruiter} <span style={{color:T.dim,fontWeight:400,fontSize:12}}>· {card.total} req{card.total!==1?"s":""}</span>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {Object.entries(card.statuses).sort((a,b)=>b[1]-a[1]).map(([s,c])=>{
                            const cm={"Open, actively recruiting":[T.tealLight,T.teal2],"Filled":[T.greenLight,T.green],"On Hold":[T.amberLight,T.amber],"Open, not actively recruiting":[T.surface,T.muted]};
                            const [bg,fg]=cm[s]||[T.surface,T.muted];
                            return <span key={s} style={{fontSize:11,fontWeight:500,background:bg,color:fg,border:`1px solid ${fg}33`,borderRadius:20,padding:"3px 10px"}}>{c} · {s}</span>;
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{...cardAccent(T.navy),overflow:"hidden"}}>
              <div onClick={()=>setSignalsOpen(o=>!o)} style={{padding:"14px 18px 12px",borderBottom:signalsOpen?`1px solid ${T.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",background:"linear-gradient(180deg, rgba(30,58,110,0.04) 0%, transparent 100%)"}}>
                <span style={{fontSize:11,fontWeight:600,color:T.muted,letterSpacing:"0.06em",textTransform:"uppercase"}}>Key signals</span>
                <span style={{fontSize:14,color:T.dim}}>{signalsOpen?"−":"+"}</span>
              </div>
              {signalsOpen&&<div style={{padding:"14px 18px"}}>
                {analysis?.insights?.map((ins,i)=>(
                  <div key={i} style={{display:"flex",gap:10,marginBottom:i<analysis.insights.length-1?10:0,alignItems:"flex-start"}}>
                    <div style={{width:20,height:20,background:i===0?T.tealLight:T.surface,border:`1px solid ${i===0?T.tealMid:T.border}`,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                      <span style={{fontSize:10,fontWeight:700,color:i===0?T.teal2:T.muted}}>{i+1}</span>
                    </div>
                    <div style={{fontSize:12,lineHeight:1.65,color:T.muted}}>{ins}</div>
                  </div>
                ))}
              </div>}
            </div>
          </div>
        </div>

        {viewMode === "chart" && recruiterLeaderboard && recruiterLeaderboard.entries.length > 0 && (
          <div className="lb-wrap" style={{ ...cardAccent(T.teal), padding: 0, overflow: "hidden", marginBottom: 16, animation: "su .28s ease" }}>
            <div
              style={{
                background: "linear-gradient(180deg, #0f1419 0%, #0a0e14 100%)",
                borderTop: `2px solid ${T.teal}`,
                padding: "16px 18px 18px",
                boxShadow: "inset 0 1px 0 rgba(58,111,212,0.12)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(58,111,212,0.85)", marginBottom: 4 }}>Recruiter leaderboard</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", letterSpacing: -0.3 }}>Open reqs by recruiter</div>
                </div>
                <div style={{ fontSize: 11, color: "rgba(148,163,184,0.95)", fontWeight: 500 }}>{filteredData.length} rows in view</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recruiterLeaderboard.entries.map((e, idx) => {
                  const pct = recruiterLeaderboard.maxOpen > 0 ? (e.openCount / recruiterLeaderboard.maxOpen) * 100 : 0;
                  const dots = leaderboardStatusDots(e.active, e.hold, e.other);
                  const dotColor = (k) => (k === "teal" ? T.teal2 : k === "amber" ? T.amber : "rgba(148,163,184,0.85)");
                  return (
                    <button
                      key={e.rawLabel}
                      type="button"
                      className="lb-card"
                      onClick={() => openDrillForColumn(recruiterLeaderboard.recCol, e.rawLabel)}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: "rgba(58,111,212,0.15)",
                          border: "1px solid rgba(58,111,212,0.35)",
                          color: T.teal,
                          fontSize: 13,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#F8FAFC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.displayName}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: T.teal, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{e.openCount}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 8 }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              borderRadius: 999,
                              background: `linear-gradient(90deg, ${T.navy2} 0%, ${T.teal2} 100%)`,
                              boxShadow: `0 0 12px rgba(58,111,212,0.35)`,
                              transition: "width .4s ease",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          {dots.map((k, di) => (
                            <span
                              key={di}
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: dotColor(k),
                                boxShadow: k === "teal" ? `0 0 6px ${T.teal}88` : "none",
                                flexShrink: 0,
                              }}
                            />
                          ))}
                          <span style={{ fontSize: 10, color: "rgba(148,163,184,0.9)", marginLeft: 4, fontWeight: 500 }}>
                            {[e.active > 0 && `${e.active} active`, e.hold > 0 && `${e.hold} on hold`, e.other > 0 && `${e.other} other`].filter(Boolean).join(" · ") || (e.openCount === 0 ? "No open reqs" : "")}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,0.75)", marginTop: 12, textAlign: "center", letterSpacing: "0.02em" }}>
                Dots ≈ status mix (teal active · amber on hold · gray other) · Click a row to open details
              </div>
            </div>
          </div>
        )}

        {/* Drill-down */}
        {drillDown&&(
          <div style={{...cardAccent(T.teal),borderTop:`2px solid ${T.teal}`,overflow:"hidden",marginBottom:16,animation:"su .2s ease"}}>
            <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(180deg, rgba(58,111,212,0.07) 0%, transparent 100%)"}}>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:T.muted,letterSpacing:"0.06em",textTransform:"uppercase"}}>{drillDown.isRecruiter?"Recruiter brief":"Drill-down"}</div>
                <div style={{fontSize:13,fontWeight:600,color:T.navy,marginTop:2}}>{drillDown.label} <span style={{color:T.dim,fontWeight:400}}>· {drillDown.rows.length} row{drillDown.rows.length!==1?"s":""}</span></div>
              </div>
              <button onClick={()=>{setDrillDown(null);setDrawerOpen(false);}} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:12}}>✕ Close</button>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:T.surface}}>{drillCols.map(c=><th key={c} style={{padding:"8px 14px",textAlign:"left",fontWeight:600,color:T.muted,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap",fontSize:11}}>{c}</th>)}</tr></thead>
                <tbody>{drillDown.rows.slice(0,25).map((row,i)=>(
                  <tr key={i} className="dr" style={{borderBottom:`1px solid ${T.border}`}}>
                    {drillCols.map(c=><td key={c} style={{padding:"8px 14px",color:T.text,whiteSpace:"nowrap",background:"transparent",transition:"background .1s"}}>{String(row[c]??"—")}</td>)}
                  </tr>
                ))}</tbody>
              </table>
              {drillDown.rows.length>25&&<div style={{padding:"10px 18px",fontSize:12,color:T.dim,borderTop:`1px solid ${T.border}`}}>Showing 25 of {drillDown.rows.length} rows</div>}
            </div>
          </div>
        )}

        {/* Slide-in drawer (bar click) */}
        {drawerOpen && drillDown && drawerDetail && (
          <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",justifyContent:"flex-end"}} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
            <div onClick={closeDrawer} style={{position:"absolute",inset:0,background:"rgba(15,23,42,0.42)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)"}}/>
            <div className="drawer-panel-anim" onClick={(e)=>e.stopPropagation()} style={{position:"relative",width:"min(440px,100vw)",maxWidth:"100%",height:"100%",background:T.card,boxShadow:"-12px 0 48px rgba(30,58,110,0.18)",display:"flex",flexDirection:"column",alignSelf:"stretch"}}>
              <div style={{background:T.navy,flexShrink:0,padding:"16px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                <h2 id="drawer-title" style={{margin:0,fontSize:18,fontWeight:700,color:"#fff",letterSpacing:-0.4,lineHeight:1.25}}>{drillDown.label}</h2>
                <button type="button" className="drawer-x" onClick={closeDrawer} aria-label="Close panel" style={{flexShrink:0,width:40,height:40,borderRadius:8,border:"none",background:"transparent",color:"rgba(255,255,255,0.92)",fontSize:24,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif",transition:"background .15s"}}>×</button>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"18px 18px 28px",display:"flex",flexDirection:"column",gap:20}}>
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.muted,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:12}}>Summary</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"baseline"}}>
                    <div>
                      <div style={{fontSize:11,color:T.dim,marginBottom:4}}>Total open reqs</div>
                      <div style={{fontSize:22,fontWeight:700,color:T.navy}}>{drawerDetail.totalOpenReqs}</div>
                    </div>
                    {drawerDetail.dateCol && drawerDetail.avgDaysOpen !== null && (
                      <div>
                        <div style={{fontSize:11,color:T.dim,marginBottom:4}}>Avg days open</div>
                        <div style={{fontSize:22,fontWeight:700,color:T.teal2}}>{Math.round(drawerDetail.avgDaysOpen)}</div>
                      </div>
                    )}
                  </div>
                  {drawerDetail.statusCol && Object.keys(drawerDetail.statusBreakdown).length > 0 && (
                    <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
                      <div style={{fontSize:11,color:T.dim,marginBottom:8}}>Status</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                        {Object.entries(drawerDetail.statusBreakdown).sort((a,b)=>b[1]-a[1]).map(([s,c])=>{
                          const m = statusBadgeMeta(s);
                          return <span key={s} style={{fontSize:12,fontWeight:500,background:m.bg,color:m.fg,border:`1px solid ${m.border}44`,borderRadius:20,padding:"4px 10px"}}>{c} · {s}</span>;
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:T.muted,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:12}}>Roles</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {drawerDetail.roleCards.map((rc) => {
                      const m = statusBadgeMeta(rc.statusRaw);
                      return (
                        <div key={rc.i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 2px rgba(0,0,0,.04)"}}>
                          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:6}}>
                            <div style={{fontSize:14,fontWeight:600,color:T.navy,lineHeight:1.35}}>{rc.title}</div>
                            {drawerDetail.statusCol && (
                              <span style={{flexShrink:0,fontSize:11,fontWeight:600,background:m.bg,color:m.fg,border:`1px solid ${m.border}55`,borderRadius:20,padding:"3px 10px"}}>{m.label}</span>
                            )}
                          </div>
                          {rc.location&&<div style={{fontSize:12,color:T.muted,marginBottom:4}}>{rc.location}</div>}
                          {drawerDetail.hmCol&&<div style={{fontSize:12,color:T.dim}}><span style={{fontWeight:500,color:T.muted}}>Hiring manager:</span> {rc.hm || "—"}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{background:T.tealLight,border:`1px solid ${T.tealMid}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.teal2,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>AI summary</div>
                  {drawerAiLoading ? (
                    <div style={{display:"flex",gap:4,alignItems:"flex-end",height:22}}>
                      {[0,.2,.4].map((d,i)=><div key={i} style={{width:5,background:T.teal2,borderRadius:2,animation:"wb .7s ease-in-out infinite",animationDelay:`${d}s`}}/>)}
                    </div>
                  ) : (
                    <p style={{margin:0,fontSize:13,lineHeight:1.7,color:T.text}}>{drawerAi}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ask Signal */}
        <div style={{...cardAccent(T.navy),overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,background:"linear-gradient(180deg, rgba(30,58,110,0.05) 0%, transparent 100%)"}}>
            <span style={{fontSize:11,fontWeight:600,color:T.muted,letterSpacing:"0.06em",textTransform:"uppercase"}}>Ask Signal</span>
            <span style={{fontSize:12,color:T.dim}}>— ask anything about this report</span>
          </div>
          {chatMsgs.length===0&&(
            <div style={{padding:"14px 18px",display:"flex",flexWrap:"wrap",gap:8,borderBottom:`1px solid ${T.border}`}}>
              {analysis?.suggestedQuestions?.map((q,i)=><button key={i} className="sq-chip" onClick={()=>setChatInput(q)}>{q}</button>)}
            </div>
          )}
          {chatMsgs.length>0&&(
            <div style={{maxHeight:320,overflowY:"auto",padding:"16px 18px",display:"flex",flexDirection:"column",gap:12}}>
              {chatMsgs.map((m,i)=>(
                <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                  <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:m.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:m.role==="user"?T.navy:T.surface,border:m.role==="assistant"?`1px solid ${T.border}`:"none",color:m.role==="user"?"#fff":T.text,fontSize:13,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{m.content}</div>
                </div>
              ))}
              {asking&&<div style={{display:"flex"}}><div style={{padding:"10px 16px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px 12px 12px 3px"}}><div style={{display:"flex",gap:4,alignItems:"flex-end",height:20}}>{[0,.2,.4].map((d,i)=><div key={i} style={{width:4,background:T.teal,borderRadius:2,animation:"wb .7s ease-in-out infinite",animationDelay:`${d}s`}}/>)}</div></div></div>}
              <div ref={chatEndRef}/>
            </div>
          )}
          <div style={{padding:"12px 18px",display:"flex",gap:8,borderTop:chatMsgs.length>0?`1px solid ${T.border}`:"none",background:T.surface}}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="Ask a question about this data..."
              style={{flex:1,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontFamily:"Inter,sans-serif",fontSize:13,padding:"9px 12px",outline:"none"}}/>
            <button className="ask-btn" onClick={ask} disabled={asking}>→</button>
          </div>
        </div>
      </div>

      {exportModalOpen && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 250,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(15,23,42,0.72)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
          onClick={() => setExportModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-report-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: 14,
              overflow: "hidden",
              background: "linear-gradient(165deg, #0c1018 0%, #152535 42%, #1a2433 100%)",
              border: "1px solid rgba(126,200,227,0.38)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(14,126,168,0.15)",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                borderBottom: "1px solid rgba(148,163,184,0.15)",
                background: "linear-gradient(90deg, rgba(14,126,168,0.12) 0%, transparent 60%)",
              }}
            >
              <div>
                <h2 id="export-report-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#F8FAFC", letterSpacing: -0.3 }}>
                  Export Report
                </h2>
                <div style={{ fontSize: 12, color: "rgba(148,163,184,0.95)", marginTop: 4, fontWeight: 500 }}>Plain text · ready to share</div>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                aria-label="Close"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  border: "none",
                  background: "rgba(255,255,255,0.06)",
                  color: "#e2e8f0",
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: "pointer",
                  fontFamily: "Inter,sans-serif",
                  transition: "background .15s",
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 200,
                maxHeight: "min(52vh, 420px)",
                overflow: "auto",
                padding: "16px 20px",
                margin: 0,
                fontFamily: "Inter, ui-monospace, monospace",
                fontSize: 12,
                lineHeight: 1.65,
                color: "#e2e8f0",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              {exportReportText}
            </div>
            <div
              style={{
                flexShrink: 0,
                padding: "14px 20px 18px",
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "flex-end",
                borderTop: "1px solid rgba(148,163,184,0.12)",
                background: "rgba(15,23,42,0.5)",
              }}
            >
              <button
                type="button"
                onClick={() => void copyExportReport()}
                style={{
                  background: "transparent",
                  color: CHART_PALETTE.secondary,
                  border: `1px solid rgba(126,200,227,0.45)`,
                  borderRadius: 8,
                  padding: "9px 18px",
                  cursor: "pointer",
                  fontFamily: "Inter,sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: "background .15s, border-color .15s",
                }}
              >
                {exportCopyFlash ? "Copied!" : "Copy to clipboard"}
              </button>
              <button
                type="button"
                onClick={downloadExportReport}
                style={{
                  background: CHART_PALETTE.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 18px",
                  cursor: "pointer",
                  fontFamily: "Inter,sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: "0 2px 12px rgba(14,126,168,0.35)",
                }}
              >
                Download as .txt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
