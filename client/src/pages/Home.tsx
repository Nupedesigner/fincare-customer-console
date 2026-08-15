/**
 * FinCare style reminder: Care-Forward Operations combines an Ink Navy command rail with White and Soft Blue
 * evidence surfaces. FinCare Blue is the primary action/data colour; Care Cyan identifies AI context only.
 */
import { useState } from "react";
import {
  Activity, Archive, ArrowDownRight, ArrowLeft, ArrowUpRight, Bell, BookOpen,
  Bot, ChevronDown, CircleHelp, Clock3, Download, FileBarChart, FileText,
  Filter, Flag, Gauge, Headphones, KeyRound, LayoutDashboard, Menu, MessageSquare,
  MoreHorizontal, PanelLeftClose, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, Users, X, Zap,
} from "lucide-react";
import { toast } from "sonner";

type PageKey =
  | "Overview" | "Conversations" | "Escalations" | "Customers" | "Intent Management"
  | "Knowledge Base" | "AI Performance" | "Safety & Guardrails" | "Reports" | "Audit Logs"
  | "Team & Roles" | "Settings";

type NavItem = { label: PageKey; icon: typeof LayoutDashboard; group?: string };

const logo = "/manus-storage/fincare-logo_e9f576ee.svg";
const iconLogo = "/manus-storage/fincare-icon_86da598f.svg";
const overviewArt = "/manus-storage/fincare-overview-signal_d5c23dae.png";
const knowledgeArt = "/manus-storage/fincare-knowledge-context_7ece79af.png";
const safetyArt = "/manus-storage/fincare-safety-field_8a99e460.png";
const aiMark = "/manus-storage/fincare-ai-operational-mark_013194a7.png";

const navigation: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, group: "Operations" },
  { label: "Conversations", icon: MessageSquare },
  { label: "Escalations", icon: Headphones },
  { label: "Customers", icon: Users },
  { label: "Intent Management", icon: SlidersHorizontal, group: "Intelligence" },
  { label: "Knowledge Base", icon: BookOpen },
  { label: "AI Performance", icon: Gauge },
  { label: "Safety & Guardrails", icon: ShieldCheck, group: "Governance" },
  { label: "Reports", icon: FileBarChart },
  { label: "Audit Logs", icon: Archive },
  { label: "Team & Roles", icon: Users, group: "Administration" },
  { label: "Settings", icon: Settings2 },
];

const trend = [
  { day: "Mon", total: 3180, resolved: 2730, escalated: 450 },
  { day: "Tue", total: 3640, resolved: 3140, escalated: 500 },
  { day: "Wed", total: 3430, resolved: 2950, escalated: 480 },
  { day: "Thu", total: 4090, resolved: 3580, escalated: 510 },
  { day: "Fri", total: 3960, resolved: 3420, escalated: 540 },
  { day: "Sat", total: 3010, resolved: 2690, escalated: 320 },
  { day: "Sun", total: 3582, resolved: 3214, escalated: 368 },
];

const intents = [
  ["Balance Inquiry", 4872, 96], ["Transaction Query", 4140, 86], ["Transfer Failure", 2876, 73],
  ["Card Limit Query", 2024, 62], ["Loan Information", 1731, 51], ["Dispute Initiation", 1364, 43],
];

const conversationRows = [
  ["CNV-928417", "Adaeze N. · CUS-002918", "Balance Inquiry", "Mobile", "09:42", "2m 14s", "Resolved", "No", "5.0", "Resolved"],
  ["CNV-928416", "Ibrahim O. · CUS-001764", "Transfer Failure", "Web", "09:37", "5m 32s", "Escalated", "Yes", "—", "Assigned"],
  ["CNV-928415", "Chioma E. · CUS-003421", "Card Limit Query", "WhatsApp", "09:31", "1m 48s", "Resolved", "No", "4.0", "Resolved"],
  ["CNV-928414", "Tunde A. · CUS-000879", "Dispute Initiation", "Mobile", "09:28", "3m 05s", "Fallback", "No", "—", "Review"],
  ["CNV-928413", "Halima S. · CUS-002660", "Loan Information", "Web", "09:24", "2m 43s", "Resolved", "No", "5.0", "Resolved"],
];

const pageModels: Partial<Record<PageKey, { eyebrow: string; title: string; description: string; primary: string; art?: string; stats: [string, string, string][]; columns: string[]; rows: string[][] }>> = {
  Conversations: {
    eyebrow: "OPERATIONS WORKSPACE", title: "Conversations", description: "Inspect every customer interaction, evaluate AI outcomes, and route attention to the right team.", primary: "Export view",
    stats: [["Active conversations", "284", "+18 today"], ["Resolved today", "3,184", "87.4% resolution"], ["Needs review", "36", "5 high priority"]],
    columns: ["Conversation ID", "Customer", "Intent", "Channel", "Started", "Duration", "Resolution", "Escalated", "CSAT", "Status"], rows: conversationRows,
  },
  Escalations: {
    eyebrow: "OPERATIONS WORKSPACE", title: "Escalations", description: "Coordinate human support for the conversations that require careful intervention.", primary: "Assign agent",
    stats: [["Waiting", "18", "4 approaching SLA"], ["Assigned", "34", "12 active now"], ["In progress", "21", "Avg. 4m 18s"], ["Resolved today", "163", "+14.2% vs last week"]],
    columns: ["Customer", "Intent", "Reason", "Priority", "Sentiment", "Assigned Agent", "Wait Time", "Status"],
    rows: [["Ibrahim O. · CUS-001764", "Transfer Failure", "Beneficiary timeout", "High", "Frustrated", "D. Okoro", "06m 14s", "In progress"], ["Amina K. · CUS-004192", "Account Freeze/Block", "Verification request", "High", "Concerned", "Unassigned", "09m 48s", "Waiting"], ["Femi A. · CUS-002185", "Dispute Initiation", "Card chargeback", "Medium", "Neutral", "M. Bello", "04m 08s", "Assigned"], ["Ifunanya U. · CUS-002644", "General FAQ", "Policy exception", "Low", "Neutral", "P. Adeyemi", "02m 33s", "Assigned"]],
  },
  Customers: {
    eyebrow: "CUSTOMER INTELLIGENCE", title: "Customers", description: "View masked support context to deliver a consistent and privacy-conscious service experience.", primary: "Create segment",
    stats: [["Supported customers", "18,723", "Last 30 days"], ["Repeat contacts", "2,608", "13.9% of customers"], ["At-risk experience", "98", "CSAT below 3.0"]],
    columns: ["Customer ID", "Masked Name", "Account Type", "Conversations", "Escalations", "Last Interaction", "CSAT", "Status"],
    rows: [["CUS-002918", "A***e N***", "Premier Current", "14", "1", "Today, 09:42", "4.8", "Active"], ["CUS-001764", "I***m O***", "Savings", "8", "2", "Today, 09:37", "3.5", "Active"], ["CUS-003421", "C***a E***", "Salary Current", "5", "0", "Today, 09:31", "4.7", "Active"], ["CUS-000879", "T***e A***", "Savings", "11", "1", "Today, 09:28", "3.2", "Review"]],
  },
  "Intent Management": {
    eyebrow: "AI QUALITY WORKSPACE", title: "Intent Management", description: "Maintain high recognition quality across the launch intent set and investigate misclassified queries.", primary: "Add intent",
    stats: [["Total intents", "42", "10 launch intents"], ["Recognition accuracy", "92.8%", "Target ≥92%"], ["Misclassification rate", "2.6%", "−0.4% this period"], ["Most triggered intent", "Balance Inquiry", "4,872 conversations"]],
    columns: ["Intent", "Volume", "Accuracy", "Resolution Rate", "Escalation Rate", "Status"],
    rows: [["Balance Inquiry", "4,872", "96.0%", "94.4%", "4.8%", "Healthy"], ["Transaction Query", "4,140", "92.6%", "84.2%", "12.1%", "Healthy"], ["Transfer Failure", "2,876", "89.7%", "70.2%", "28.9%", "Needs attention"], ["Dispute Initiation", "1,364", "91.5%", "67.1%", "30.4%", "Review"]],
  },
  "Knowledge Base": {
    eyebrow: "RAG KNOWLEDGE WORKSPACE", title: "Knowledge Base", description: "Keep the knowledge FinCare retrieves accurate, current, traceable, and ready for customer conversations.", primary: "Upload document", art: knowledgeArt,
    stats: [["Active documents", "164", "Across 8 categories"], ["Retrieval accuracy", "94.6%", "Target ≥92%"], ["Incorrect retrievals", "17", "−6 this period"]],
    columns: ["Document", "Category", "Version", "Last Updated", "Usage", "Status"],
    rows: [["Retail Savings Account Guide", "Savings", "v5.2", "12 Aug 2026", "1,986 queries", "Current"], ["Card Dispute Policy", "Cards", "v3.8", "10 Aug 2026", "1,442 queries", "Current"], ["Personal Loan Eligibility", "Loans", "v4.1", "08 Aug 2026", "1,204 queries", "Review due"], ["FX Transfer Frequently Asked Questions", "Forex", "v2.3", "01 Aug 2026", "786 queries", "Current"]],
  },
  "AI Performance": {
    eyebrow: "EXECUTIVE PERFORMANCE", title: "AI Performance", description: "Compare FinCare quality, latency, and escalation outcomes against the operational targets set for launch.", primary: "Download report",
    stats: [["Intent recognition", "92.8%", "Target ≥92%"], ["Resolution without escalation", "87.4%", "Target ≥85%"], ["P95 response latency", "3.1s", "Target <4s"], ["Fallback rate", "3.7%", "Target <5%"]],
    columns: ["Metric", "Current", "Target", "Period change", "Operational state"],
    rows: [["Intent Recognition Accuracy", "92.8%", "≥92%", "+0.9%", "Healthy"], ["Resolution Without Escalation", "87.4%", "≥85%", "+3.2%", "Healthy"], ["CSAT", "4.5 / 5", "≥4.3", "+0.2", "Healthy"], ["P95 Response Latency", "3.1s", "<4s", "−0.4s", "Healthy"], ["Escalation Conversion", "91.2%", "≥90%", "+1.1%", "Healthy"], ["Fallback Rate", "3.7%", "<5%", "−1.4%", "Healthy"]],
  },
  "Safety & Guardrails": {
    eyebrow: "AI GOVERNANCE", title: "Safety & Guardrails", description: "Monitor safety signals, maintain protection controls, and investigate events with a clear evidence trail.", primary: "Review policy", art: safetyArt,
    stats: [["Prompt injection attempts", "14", "All contained"], ["PII events", "6", "Masked before output"], ["Blocked responses", "28", "+5 this period"], ["Sensitive queries", "41", "No unresolved alerts"]],
    columns: ["Event", "Type", "Severity", "Conversation", "Detected", "Action", "Status"],
    rows: [["PII pattern withheld", "Data protection", "Medium", "CNV-928214", "Today, 09:08", "Masked & continued", "Resolved"], ["Instruction override attempt", "Prompt injection", "High", "CNV-927983", "Today, 07:46", "Blocked response", "Resolved"], ["Product rate mismatch", "Rate validation", "Medium", "CNV-927842", "Yesterday, 16:17", "Escalated to KB", "Review"], ["Sensitive keyword trigger", "Query monitoring", "Low", "CNV-927517", "Yesterday, 12:38", "Human routing", "Resolved"]],
  },
  Reports: {
    eyebrow: "REPORTING CENTRE", title: "Reports", description: "Build clear operational reports for customer-support, AI product, and compliance teams.", primary: "Create report",
    stats: [["Scheduled reports", "12", "4 due this week"], ["Exports this month", "46", "CSV and PDF"], ["Saved audiences", "8", "Role-based delivery"]],
    columns: ["Report", "Owner", "Date range", "Last generated", "Format", "Status"],
    rows: [["AI Performance Report", "AI/Product", "Last 30 days", "Today, 08:00", "PDF", "Ready"], ["Customer Satisfaction Report", "Support Ops", "Last 7 days", "Today, 07:30", "CSV", "Ready"], ["Safety Events Summary", "Compliance", "Last 30 days", "12 Aug, 09:00", "PDF", "Scheduled"], ["Escalation Report", "Support Ops", "This week", "11 Aug, 17:00", "CSV", "Ready"]],
  },
  "Audit Logs": {
    eyebrow: "COMPLIANCE TRAIL", title: "Audit Logs", description: "Search a dense, traceable record of administrator actions across the FinCare operating environment.", primary: "Export audit trail",
    stats: [["Events today", "1,284", "All systems"], ["Privileged actions", "86", "Fully recorded"], ["Open reviews", "3", "Compliance owned"]],
    columns: ["Timestamp", "User", "Action", "Module", "Resource", "Result"],
    rows: [["15 Aug, 09:26:17", "D. Okoro", "Updated Intent", "Intent Management", "Transfer Failure", "Success"], ["15 Aug, 09:14:42", "A. Nwosu", "Assigned Escalation", "Escalations", "ESC-004281", "Success"], ["15 Aug, 08:57:03", "M. Bello", "Uploaded Knowledge Document", "Knowledge Base", "Card Dispute Policy", "Success"], ["15 Aug, 08:41:31", "T. Adeleke", "Changed Guardrail", "Safety & Guardrails", "PII Protection", "Success"]],
  },
  "Team & Roles": {
    eyebrow: "ACCESS ADMINISTRATION", title: "Team & Roles", description: "Manage bank teams and the permissions used to operate FinCare responsibly.", primary: "Invite user",
    stats: [["Active users", "42", "Across 7 roles"], ["Pending invitations", "3", "Expire in 7 days"], ["Role changes", "5", "This month"]],
    columns: ["Name", "Role", "Department", "Status", "Last Active", "Access"],
    rows: [["Damilola Okoro", "Support Manager", "Customer Experience", "Active", "Now", "Operations"], ["Amara Nwosu", "AI/Product Manager", "Digital Banking", "Active", "12m ago", "Full AI"], ["Musa Bello", "Support Agent", "Customer Experience", "Active", "24m ago", "Escalations"], ["Temitope Adeleke", "Compliance Officer", "Risk & Compliance", "Active", "1h ago", "Governance"]],
  },
  Settings: {
    eyebrow: "PLATFORM CONFIGURATION", title: "Settings", description: "Review the operational settings governing FinCare responses, channels, integrations, notifications, and access.", primary: "Save changes",
    stats: [["AI confidence threshold", "82%", "Escalate below this"], ["Enabled channels", "4", "Web, mobile, WhatsApp, USSD"], ["Connected systems", "4", "All healthy"]],
    columns: ["Configuration", "Category", "Current setting", "Last updated", "Status"],
    rows: [["Response behaviour", "AI Configuration", "Clear & reassuring", "Today, 08:43", "Active"], ["Core Banking API", "Integrations", "Connected", "Today, 08:11", "Operational"], ["Live Agent Routing", "Integrations", "Priority queue enabled", "14 Aug, 15:38", "Operational"], ["Two-factor authentication", "Security", "Required for all admins", "08 Aug, 10:26", "Enforced"]],
  },
};

const operationalSignals: Record<PageKey, { label: string; title: string; value: string; detail: string }> = {
  Overview: { label: "AI SUPPORT OPERATION", title: "FinCare AI is operational", value: "96%", detail: "Current confidence across active support journeys" },
  Conversations: { label: "LIVE SUPPORT CONTEXT", title: "284 conversations are active", value: "87.4%", detail: "Resolved without escalation in this period" },
  Escalations: { label: "HUMAN SUPPORT QUEUE", title: "4 cases approach SLA", value: "06m", detail: "Longest waiting case in the priority queue" },
  Customers: { label: "CARE SIGNAL", title: "98 customers need attention", value: "3.0", detail: "CSAT threshold for an at-risk experience" },
  "Intent Management": { label: "MODEL QUALITY", title: "Launch intent set is healthy", value: "92.8%", detail: "Recognition accuracy against the ≥92% target" },
  "Knowledge Base": { label: "RETRIEVAL CONTEXT", title: "Knowledge is current", value: "94.6%", detail: "Retrieval accuracy across active documents" },
  "AI Performance": { label: "TARGET POSITION", title: "All launch targets are met", value: "6 / 6", detail: "Quality, latency, and escalation measures in range" },
  "Safety & Guardrails": { label: "PROTECTION POSTURE", title: "All critical controls are active", value: "0", detail: "Unresolved high-severity safety events" },
  Reports: { label: "REPORTING CONTEXT", title: "Four reports are due this week", value: "12", detail: "Scheduled operational report deliveries" },
  "Audit Logs": { label: "COMPLIANCE CONTEXT", title: "Every privileged action is recorded", value: "86", detail: "Privileged actions reviewed today" },
  "Team & Roles": { label: "ACCESS CONTEXT", title: "Role controls are in force", value: "42", detail: "Active authorised FinCare operators" },
  Settings: { label: "PLATFORM CONTEXT", title: "Core controls are connected", value: "4 / 4", detail: "Operational integrations reporting healthy" },
};

function buttonToast(label: string) {
  toast("Action available in the connected application", { description: `${label} is ready to be connected to FinCare’s operational workflow.` });
}

function Status({ value }: { value: string }) {
  const lower = value.toLowerCase();
  const tone = lower.includes("healthy") || lower.includes("resolved") || lower.includes("current") || lower.includes("active") || lower.includes("ready") || lower.includes("success") || lower.includes("operational") || lower.includes("enforced")
    ? "bg-[#edf9f4] text-[#16734f]"
    : lower.includes("high") || lower.includes("review") || lower.includes("attention") || lower.includes("waiting")
      ? "bg-[#fff6e6] text-[#a45a00]"
      : lower.includes("assigned") || lower.includes("progress")
        ? "bg-[#eaf3ff] text-[#0866f5]"
        : "bg-[#f1f5f9] text-slate-600";
  const Dot = lower.includes("fallback") ? Flag : Activity;
  return <span className={`status-chip ${tone}`}><Dot className="h-3 w-3" aria-hidden="true" />{value}</span>;
}

function Trend({ value, inverted = false }: { value: string; inverted?: boolean }) {
  const positive = value.startsWith("+") ? !inverted : inverted;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${positive ? "text-[#16734f]" : "text-[#0866f5]"}`}><Icon className="h-3.5 w-3.5" />{value}</span>;
}

function MiniBar({ value, color = "#0866f5" }: { value: number; color?: string }) {
  return <span className="block h-1.5 overflow-hidden rounded-full bg-[#eaf0fa]"><span className="block h-full rounded-full" style={{ width: `${value}%`, background: color }} /></span>;
}

function VolumeChart() {
  const points = (key: "total" | "resolved") => trend.map((d, i) => `${48 + i * 88},${182 - ((d[key] - 2500) / 1800) * 130}`).join(" ");
  return <div className="h-[240px] w-full min-w-[600px] pt-3">
    <svg viewBox="0 0 600 235" role="img" aria-label="Conversation volume for the past 7 days" className="h-full w-full overflow-visible">
      {[44, 88, 132, 176].map((y) => <line key={y} x1="48" x2="580" y1={y} y2={y} stroke="#e5edf8" strokeDasharray="3 5" />)}
      <path d="M48 182 L48 133 L136 100 L224 116 L312 70 L400 80 L488 145 L576 103 L576 182 Z" fill="#0866f5" fillOpacity=".055" />
      <polyline points={points("total")} fill="none" stroke="#0866f5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={points("resolved")} fill="none" stroke="#16b8e8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {trend.map((d, i) => <g key={d.day}><circle cx={48 + i * 88} cy={182 - ((d.total - 2500) / 1800) * 130} r="4" fill="#fff" stroke="#0866f5" strokeWidth="2.5" /><text x={48 + i * 88} y="214" textAnchor="middle" fill="#718096" fontSize="11" fontWeight="600">{d.day}</text></g>)}
      <text x="0" y="48" fill="#94a3b8" fontSize="10">4.0k</text><text x="0" y="92" fill="#94a3b8" fontSize="10">3.5k</text><text x="0" y="136" fill="#94a3b8" fontSize="10">3.0k</text><text x="0" y="180" fill="#94a3b8" fontSize="10">2.5k</text>
    </svg>
  </div>;
}

function Overview({ onPage }: { onPage: (page: PageKey) => void }) {
  const kpis = [
    ["Conversations", "24,892", "+12.8%", false, "vs previous period", MessageSquare],
    ["Resolution rate", "87.4%", "+3.2%", false, "Target ≥85%", ShieldCheck],
    ["Escalation rate", "12.6%", "−2.1%", true, "Target <15%", Headphones],
    ["CSAT", "4.5 / 5", "+0.2", false, "Target ≥4.3", Sparkles],
    ["Response time", "2.8s", "−0.6s", true, "P95 target <4s", Clock3],
    ["Fallback rate", "3.7%", "−1.4%", true, "Target <5%", Bot],
  ] as const;
  return <div className="app-enter space-y-6">
    <section className="grid overflow-hidden rounded-2xl border border-[#dce8f8] bg-white shadow-[0_8px_28px_rgba(7,26,53,.04)] lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="px-6 py-6 sm:px-8">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] text-[#0866f5]"><span className="h-2 w-2 rounded-full bg-[#16b8e8]" />AI SUPPORT OPERATIONS</div>
        <h1 className="text-2xl font-bold tracking-[-.035em] text-[#071a35] sm:text-[30px]">FinCare Overview</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Monitor your AI support operation and customer experience.</p>
        <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => onPage("Conversations")} className="rounded-lg bg-[#0866f5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#075ddd] active:scale-[.97]">Review conversations</button><button onClick={() => onPage("AI Performance")} className="rounded-lg border border-[#cfe0fb] bg-white px-3.5 py-2 text-xs font-semibold text-[#0866f5] transition hover:bg-[#f4f8ff] active:scale-[.97]">View AI performance</button></div>
      </div>
      <aside className="relative overflow-hidden bg-[#071a35] px-6 py-6 text-white"><div className="absolute -right-9 -top-9 h-32 w-32 rounded-full border border-white/[.1]" /><div className="absolute right-7 top-5 h-1.5 w-1.5 rounded-full bg-[#16b8e8]" /><div className="relative"><div className="flex items-center gap-2"><img src={iconLogo} alt="FinCare AI" className="h-8 w-8" /><div><p className="text-xs font-bold">FinCare AI</p><p className="text-[10px] font-semibold text-[#7ee0f7]">● Operational</p></div></div><div className="mt-7 border-t border-white/[.11] pt-4"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#9ab6db]">Service confidence</p><p className="mt-1 text-[30px] font-bold tracking-[-.04em]">96%</p><p className="mt-1 text-[11px] leading-4 text-[#bcd0ed]">Customer-support journeys are being handled within expected quality thresholds.</p></div><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-lg bg-white/[.08] p-2.5"><p className="text-[9px] uppercase tracking-[.08em] text-[#9ab6db]">Core banking</p><p className="mt-1 text-[11px] font-bold">Connected</p></div><div className="rounded-lg bg-white/[.08] p-2.5"><p className="text-[9px] uppercase tracking-[.08em] text-[#9ab6db]">Knowledge</p><p className="mt-1 text-[11px] font-bold">Current</p></div></div></div></aside>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {kpis.map(([label, value, change, inverted, note, Icon]) => <article key={label} className="fincare-kpi">
        <div className="flex items-start justify-between"><p className="metric-label">{label}</p><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4f8ff] text-[#0866f5]"><Icon className="h-4 w-4" /></span></div>
        <div className="mt-4 flex items-end justify-between"><p className="text-[27px] font-bold leading-none tracking-[-.04em] text-[#071a35]">{value}</p><Trend value={change} inverted={inverted} /></div>
        <div className="mt-4"><MiniBar value={label === "Fallback rate" ? 37 : label === "Response time" ? 70 : label === "Escalation rate" ? 63 : label === "CSAT" ? 90 : label === "Resolution rate" ? 87 : 78} color={label === "CSAT" ? "#16b8e8" : "#0866f5"} /><p className="mt-2 text-[11px] text-slate-500">{note}</p></div>
      </article>)}
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.58fr)_minmax(340px,.92fr)]">
      <article className="fincare-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5"><div><p className="metric-label">ANALYTICS</p><h2 className="mt-1 text-base font-bold tracking-[-.02em] text-[#071a35]">Conversation volume</h2></div><div className="flex items-center gap-3 text-[11px] font-medium text-slate-500"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#0866f5]" />Total conversations</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#16b8e8]" />Resolved</span></div></div>
        <div className="overflow-x-auto px-4"><VolumeChart /></div>
        <div className="border-t border-[#eef3fa] px-5 py-3 text-xs text-slate-500"><span className="font-semibold text-[#071a35]">24,892</span> conversations across the selected period <span className="mx-2 text-[#c9d6e9]">·</span><Trend value="+12.8%" /> <span className="text-slate-500">vs previous period</span></div>
      </article>
      <article className="fincare-card p-5"><div className="flex items-start justify-between"><div><p className="metric-label">DISCOVER</p><h2 className="mt-1 text-base font-bold tracking-[-.02em] text-[#071a35]">Top customer intents</h2></div><button onClick={() => onPage("Intent Management")} aria-label="Open Intent Management" className="rounded-md p-1.5 text-[#0866f5] hover:bg-[#f4f8ff]"><ArrowUpRight className="h-4 w-4" /></button></div>
        <div className="mt-5 space-y-4">{intents.map(([name, volume, quality], index) => <div key={String(name)}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-[#253b5a]"><span className="mr-2 text-[10px] font-bold text-[#95a8c3]">0{index + 1}</span>{name}</span><span className="font-semibold text-[#071a35]">{Number(volume).toLocaleString()}</span></div><MiniBar value={Number(quality)} color={index === 0 ? "#0866f5" : index === 1 ? "#16b8e8" : "#9abdfb"} /></div>)}</div>
      </article>
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.48fr)_minmax(320px,.72fr)]">
      <article className="fincare-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5"><div><p className="metric-label">QUALITY CONTROL</p><h2 className="mt-1 text-base font-bold tracking-[-.02em] text-[#071a35]">Executive AI performance</h2></div><button onClick={() => onPage("AI Performance")} className="text-xs font-semibold text-[#0866f5] hover:underline">Open performance workspace</button></div><div className="grid border-y border-[#eef3fa] sm:grid-cols-2 lg:grid-cols-3">{[["Intent recognition", "92.8%", "Target ≥92%", "Healthy"], ["Resolution without escalation", "87.4%", "Target ≥85%", "Healthy"], ["CSAT", "4.5 / 5", "Target ≥4.3", "Healthy"], ["P95 response latency", "3.1s", "Target <4s", "Healthy"], ["Escalation conversion", "91.2%", "Target ≥90%", "Healthy"], ["Fallback rate", "3.7%", "Target <5%", "Healthy"]].map(([label, value, target, status]) => <div key={label} className="border-b border-r border-[#eef3fa] p-4 last:border-r-0"><p className="text-[11px] font-medium text-slate-500">{label}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="text-lg font-bold tracking-[-.035em] text-[#071a35]">{value}</span><Status value={status} /></div><p className="mt-2 text-[10px] text-slate-500">{target}</p></div>)}</div></article>
      <article className="relative overflow-hidden rounded-xl bg-[#071a35] p-5 text-white shadow-[0_10px_28px_rgba(7,26,53,.16)]"><div className="absolute -right-14 -top-14 h-44 w-44 rounded-full border border-white/[.10]" /><div className="absolute -right-5 -top-5 h-28 w-28 rounded-full border border-white/[.10]" /><div className="relative"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.1em] text-[#bcdcf9]"><span className="h-2 w-2 rounded-full bg-[#16b8e8]" />AI status</span><img src={aiMark} alt="" className="h-8 w-8 object-contain" /></div><h2 className="mt-5 text-xl font-bold tracking-[-.035em]">FinCare AI is operational</h2><p className="mt-2 max-w-[250px] text-xs leading-5 text-[#bcd0ed]">All core banking and knowledge retrieval services are responding within expected thresholds.</p><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-lg bg-white/[.08] p-3"><p className="text-[10px] uppercase tracking-[.08em] text-[#9ab6db]">Confidence</p><p className="mt-1 text-lg font-bold">96%</p></div><div className="rounded-lg bg-white/[.08] p-3"><p className="text-[10px] uppercase tracking-[.08em] text-[#9ab6db]">Knowledge</p><p className="mt-1 text-sm font-bold">Current</p></div></div></div></article>
    </section>

    <section className="fincare-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5"><div><p className="metric-label">RECENT ACTIVITY</p><h2 className="mt-1 text-base font-bold tracking-[-.02em] text-[#071a35]">Recent conversations</h2></div><button onClick={() => onPage("Conversations")} className="rounded-lg border border-[#d5e2f4] bg-white px-3 py-2 text-xs font-semibold text-[#0866f5] hover:bg-[#f4f8ff]">View all conversations</button></div><div className="overflow-x-auto"><table className="data-table w-full min-w-[1080px]"><thead><tr>{["Conversation ID", "Customer", "Intent", "Channel", "Started", "Duration", "Resolution", "Escalated", "CSAT", "Status"].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{conversationRows.map((r) => <tr key={r[0]} onClick={() => onPage("Conversations")} className="cursor-pointer"><td className="font-semibold text-[#0866f5]">{r[0]}</td><td className="font-medium text-[#253b5a]">{r[1]}</td>{r.slice(2, 9).map((v, i) => <td key={`${r[0]}-${i}`}>{i === 4 ? <Status value={v} /> : v}</td>)}<td><Status value={r[9]} /></td></tr>)}</tbody></table></div></section>
  </div>;
}

function GenericPage({ page, back, onConversationOpen }: { page: PageKey; back: () => void; onConversationOpen: () => void }) {
  const model = pageModels[page]!;
  const signal = operationalSignals[page];
  const count = Math.max(...model.columns.map((_, index) => model.rows.map((row) => row[index]?.length ?? 0).reduce((a, b) => a + b, 0)));
  return <div className="app-enter space-y-6">
    <button onClick={back} className="inline-flex items-center gap-2 text-xs font-semibold text-[#55739e] hover:text-[#0866f5]"><ArrowLeft className="h-4 w-4" />Back to overview</button>
    <section className="grid overflow-hidden rounded-2xl border border-[#dce8f8] bg-white shadow-[0_8px_28px_rgba(7,26,53,.04)] lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="flex flex-wrap items-end justify-between gap-5 px-6 py-6 sm:px-8"><div className="max-w-2xl"><p className="text-[11px] font-semibold uppercase tracking-[.11em] text-[#0866f5]">{model.eyebrow}</p><h1 className="mt-2 text-2xl font-bold tracking-[-.035em] text-[#071a35] sm:text-[30px]">{model.title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{model.description}</p></div><button onClick={() => buttonToast(model.primary)} className="rounded-lg bg-[#0866f5] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#075ddd] active:scale-[.97]">{model.primary}</button></div>
      <aside className={`relative overflow-hidden px-6 py-5 ${page === "Safety & Guardrails" ? "bg-[#071a35] text-white" : "bg-[#f4f8ff] text-[#071a35]"}`}><div className="absolute right-6 top-5 h-1.5 w-1.5 rounded-full bg-[#16b8e8]" /><div className="flex items-center gap-2"><img src={iconLogo} alt="FinCare AI" className="h-7 w-7" /><p className={`text-[10px] font-semibold uppercase tracking-[.1em] ${page === "Safety & Guardrails" ? "text-[#9ab6db]" : "text-[#51719d]"}`}>{signal.label}</p></div><h2 className="mt-5 text-sm font-bold leading-5">{signal.title}</h2><div className={`mt-4 border-t pt-3 ${page === "Safety & Guardrails" ? "border-white/[.12]" : "border-[#d9e6f6]"}`}><p className={`text-[10px] font-semibold uppercase tracking-[.09em] ${page === "Safety & Guardrails" ? "text-[#9ab6db]" : "text-slate-500"}`}>Evidence readout</p><p className="mt-1 text-[26px] font-bold tracking-[-.04em] text-[#16b8e8]">{signal.value}</p><p className={`mt-1 text-[11px] leading-4 ${page === "Safety & Guardrails" ? "text-[#bcd0ed]" : "text-[#526e94]"}`}>{signal.detail}</p></div></aside>
    </section>
    <section className={`grid gap-4 ${model.stats.length === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"}`}>{model.stats.map(([label, value, detail], i) => <article key={label} className="fincare-kpi"><p className="metric-label">{label}</p><p className="mt-4 text-[26px] font-bold tracking-[-.04em] text-[#071a35]">{value}</p><p className="mt-4 text-[11px] font-medium text-slate-500">{detail}</p><div className="mt-3"><MiniBar value={Math.max(24, Math.min(94, 46 + i * 12))} color={i === 1 ? "#16b8e8" : "#0866f5"} /></div></article>)}</section>
    <section className="fincare-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef3fa] px-5 py-4"><div className="flex min-w-[240px] items-center gap-2 rounded-lg border border-[#dce7f7] bg-white px-3 py-2"><Search className="h-4 w-4 text-[#86a0c3]" /><input aria-label={`Search ${page}`} className="w-full bg-transparent text-xs text-[#071a35] outline-none placeholder:text-[#8ea1b9]" placeholder={`Search ${page.toLowerCase()}...`} /></div><div className="flex items-center gap-2"><button onClick={() => buttonToast("Filters")} className="inline-flex items-center gap-2 rounded-lg border border-[#dce7f7] px-3 py-2 text-xs font-semibold text-[#4b6386] hover:bg-[#f4f8ff]"><Filter className="h-3.5 w-3.5" />Filters</button><button onClick={() => buttonToast("More actions")} aria-label="More actions" className="rounded-lg border border-[#dce7f7] p-2 text-[#4b6386] hover:bg-[#f4f8ff]"><MoreHorizontal className="h-4 w-4" /></button></div></div><div className="overflow-x-auto"><table className="data-table w-full" style={{ minWidth: `${Math.max(820, count * 9)}px` }}><thead><tr>{model.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{model.rows.map((row, rowIndex) => <tr key={`${page}-${rowIndex}`} onClick={page === "Conversations" ? onConversationOpen : undefined} className={page === "Conversations" ? "cursor-pointer" : ""}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className={cellIndex === 0 ? "font-medium text-[#253b5a]" : ""}>{["Healthy", "Needs attention", "Review", "Resolved", "Assigned", "In progress", "Waiting", "Active", "Current", "Ready", "Scheduled", "Success", "Operational", "Enforced"].includes(cell) ? <Status value={cell} /> : cell}</td>)}</tr>)}</tbody></table></div><div className="flex items-center justify-between px-5 py-3 text-[11px] text-slate-500"><span>Showing {model.rows.length} of {model.rows.length * 12 + 4} records</span><div className="flex items-center gap-1"><button onClick={() => buttonToast("Previous page")} className="rounded px-2 py-1 hover:bg-[#f4f8ff]">Previous</button><span className="rounded bg-[#eaf3ff] px-2 py-1 font-semibold text-[#0866f5]">1</span><button onClick={() => buttonToast("Next page")} className="rounded px-2 py-1 hover:bg-[#f4f8ff]">Next</button></div></div></section>
  </div>;
}

function ConversationDetail({ back }: { back: () => void }) {
  const messages = [["Customer", "Why was my transfer of ₦85,000 to Kola Adeyemi unsuccessful?"], ["FinCare AI", "I can help you check that. I’ll look up the transfer status and the most common next steps."], ["System", "Core Banking API retrieved transfer reference QBK-8F23-92D1."], ["FinCare AI", "The transfer was not completed because the beneficiary bank timed out before confirmation. Your account was not debited. Please try again in a few minutes or confirm the beneficiary details."], ["Customer", "Thank you. I’ll try again shortly."]] as const;
  return <div className="app-enter space-y-5"><button onClick={back} className="inline-flex items-center gap-2 text-xs font-semibold text-[#55739e] hover:text-[#0866f5]"><ArrowLeft className="h-4 w-4" />Back to conversations</button><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[.11em] text-[#0866f5]">CONVERSATION INSPECTION</p><h1 className="mt-1 text-2xl font-bold tracking-[-.035em] text-[#071a35]">CNV-928416</h1><p className="mt-1 text-sm text-slate-600">Ibrahim O. · CUS-001764 · Started today at 09:37</p></div><Status value="Escalated" /></div><section className="grid gap-5 xl:grid-cols-[250px_minmax(0,1fr)_290px]"><aside className="fincare-card h-fit p-5"><p className="metric-label">CUSTOMER CONTEXT</p><div className="mt-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf3ff] text-sm font-bold text-[#0866f5]">IO</span><div><p className="text-sm font-bold text-[#071a35]">Ibrahim O.</p><p className="text-[11px] text-slate-500">CUS-001764</p></div></div><dl className="mt-6 space-y-4 text-xs"><div><dt className="text-slate-500">Account type</dt><dd className="mt-1 font-semibold text-[#253b5a]">Savings · **** 4821</dd></div><div><dt className="text-slate-500">Support history</dt><dd className="mt-1 font-semibold text-[#253b5a]">8 conversations · 2 escalations</dd></div><div><dt className="text-slate-500">Last CSAT</dt><dd className="mt-1 font-semibold text-[#253b5a]">3.5 / 5</dd></div></dl><button onClick={() => buttonToast("Customer profile")} className="mt-6 w-full rounded-lg border border-[#d5e2f4] py-2 text-xs font-semibold text-[#0866f5] hover:bg-[#f4f8ff]">View customer profile</button></aside><article className="fincare-card overflow-hidden"><div className="border-b border-[#eef3fa] px-5 py-4"><p className="text-sm font-bold text-[#071a35]">Conversation timeline</p><p className="mt-1 text-xs text-slate-500">Web · Transfer Failure · 5m 32s</p></div><div className="space-y-5 p-5">{messages.map(([speaker, message], i) => <div key={`${speaker}-${i}`} className={`flex gap-3 ${speaker === "Customer" ? "" : ""}`}><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${speaker === "FinCare AI" ? "bg-[#e6f8fd] text-[#078bb5]" : speaker === "System" ? "bg-[#f1f5f9] text-[#64748b]" : "bg-[#eaf3ff] text-[#0866f5]"}`}>{speaker === "FinCare AI" ? <img src={iconLogo} alt="FinCare AI" className="h-5 w-5" /> : speaker === "System" ? <Zap className="h-3.5 w-3.5" /> : "IO"}</span><div><div className="flex items-baseline gap-2"><p className="text-xs font-semibold text-[#253b5a]">{speaker}</p><span className="text-[10px] text-slate-400">09:{37 + i} </span></div><p className={`mt-1 max-w-[650px] rounded-lg px-3 py-2.5 text-xs leading-5 ${speaker === "FinCare AI" ? "bg-[#f4f8ff] text-[#28415f]" : speaker === "System" ? "bg-[#f8fafc] text-slate-500" : "bg-[#eef5ff] text-[#28415f]"}`}>{message}</p></div></div>)}</div></article><aside className="fincare-card h-fit overflow-hidden"><div className="bg-[#f4f8ff] p-5"><div className="flex items-center gap-2"><img src={iconLogo} alt="FinCare AI" className="h-7 w-7" /><div><p className="text-xs font-bold text-[#071a35]">FinCare AI</p><p className="text-[10px] font-semibold text-[#078bb5]">● Operational</p></div></div></div><dl className="space-y-0 p-5 text-xs"><div className="border-b border-[#eef3fa] py-3"><dt className="text-slate-500">Detected intent</dt><dd className="mt-1 font-semibold text-[#071a35]">Transfer Failure</dd></div><div className="border-b border-[#eef3fa] py-3"><dt className="text-slate-500">Confidence</dt><dd className="mt-1 font-semibold text-[#071a35]">96%</dd></div><div className="border-b border-[#eef3fa] py-3"><dt className="text-slate-500">Response time</dt><dd className="mt-1 font-semibold text-[#071a35]">2.4s</dd></div><div className="border-b border-[#eef3fa] py-3"><dt className="text-slate-500">Knowledge source</dt><dd className="mt-1 font-semibold text-[#071a35]">Account API</dd></div><div className="border-b border-[#eef3fa] py-3"><dt className="text-slate-500">Safety check</dt><dd className="mt-1"><Status value="Passed" /></dd></div><div className="pt-3"><dt className="text-slate-500">Escalation</dt><dd className="mt-1"><Status value="Required" /></dd></div></dl></aside></section></div>;
}

export default function Home() {
  const requestedPage = new URLSearchParams(window.location.search).get("view") as PageKey | null;
  const initialPage = requestedPage && navigation.some((item) => item.label === requestedPage) ? requestedPage : "Overview";
  const [page, setPage] = useState<PageKey>(initialPage);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationDetail, setConversationDetail] = useState(false);
  const [period, setPeriod] = useState("30 Days");
  const choose = (next: PageKey) => { setPage(next); setConversationDetail(false); setSidebarOpen(false); window.history.replaceState(null, "", next === "Overview" ? "/" : `/?view=${encodeURIComponent(next)}`); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return <div className="min-h-screen bg-[#f4f8ff] lg:flex">
    {sidebarOpen && <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-[#071a35]/45 lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#071a35] transition-transform duration-200 lg:sticky lg:inset-y-auto lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-[82px] items-center justify-between border-b border-white/[.1] px-5"><img src={logo} alt="FinCare" className="h-[38px] w-auto max-w-[145px] object-contain" /><button onClick={() => setSidebarOpen(false)} aria-label="Close navigation" className="rounded-md p-1.5 text-[#d2def4] hover:bg-white/[.08] lg:hidden"><X className="h-5 w-5" /></button></div>
      <div className="flex-1 overflow-y-auto px-3 py-5">{navigation.map((item) => { const Icon = item.icon; return <div key={item.label} className={item.group ? "mt-6 first:mt-0" : ""}>{item.group && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#7e95b9]">{item.group}</p>}<button onClick={() => choose(item.label)} className={`nav-item ${page === item.label && !conversationDetail ? "nav-item-active" : ""}`}><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{item.label}</span>{item.label === "Escalations" && <span className="ml-auto rounded bg-white/[.13] px-1.5 py-0.5 text-[10px] text-white">18</span>}</button></div>; })}</div>
      <div className="m-3 rounded-xl border border-white/[.1] bg-white/[.055] p-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0866f5]"><ShieldCheck className="h-4 w-4 text-white" /></span><div><p className="text-[11px] font-semibold text-white">Security controls</p><p className="text-[10px] text-[#9db4d6]">All checks operational</p></div></div></div>
      <div className="border-t border-white/[.1] px-4 py-4 text-[10px] font-medium text-[#8fa7ca]">© 2026 FinCare<br /><span className="text-[#627da6]">Finance. Care. Always.</span></div>
    </aside>

    <main className="min-h-screen flex-1">
      <header className="sticky top-0 z-20 flex h-[82px] items-center gap-3 border-b border-[#dbe5f4] bg-white/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8"><button onClick={() => setSidebarOpen(true)} aria-label="Open navigation" className="rounded-lg border border-[#dce7f7] p-2 text-[#385373] hover:bg-[#f4f8ff] lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden min-w-0 sm:block"><p className="text-[11px] font-medium text-slate-500">Qorebank</p><button onClick={() => buttonToast("Environment switcher")} className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[#16734f]">● Production <ChevronDown className="h-3.5 w-3.5" /></button></div><div className="hidden h-7 w-px bg-[#dbe5f4] sm:block" /><div className="hidden min-w-[180px] max-w-[420px] flex-1 items-center gap-2 rounded-lg border border-[#dce7f7] bg-[#f8fbff] px-3 py-2 md:flex"><Search className="h-4 w-4 text-[#8ba0bd]" /><input aria-label="Search platform" placeholder="Search conversations, customers or reports..." className="w-full bg-transparent text-xs text-[#071a35] outline-none placeholder:text-[#98a9bf]" /></div><div className="ml-auto flex items-center gap-1 sm:gap-2"><button onClick={() => buttonToast("Notifications")} aria-label="Notifications" className="relative rounded-lg p-2 text-[#45607f] hover:bg-[#f4f8ff]"><Bell className="h-5 w-5" /><span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#16b8e8]" /></button><button onClick={() => buttonToast("Help centre")} aria-label="Help centre" className="hidden rounded-lg p-2 text-[#45607f] hover:bg-[#f4f8ff] sm:block"><CircleHelp className="h-5 w-5" /></button><div className="ml-1 flex items-center gap-2 border-l border-[#dbe5f4] pl-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf3ff] text-xs font-bold text-[#0866f5]">AN</span><div className="hidden pr-1 md:block"><p className="text-xs font-semibold text-[#071a35]">Amara Nwosu</p><p className="text-[10px] text-slate-500">AI/Product Manager</p></div></div></div></header>
      <div className="px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1520px]"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="text-xs font-medium text-slate-500"><span className="font-semibold text-[#071a35]">FinCare Admin</span><span className="mx-2 text-[#c8d5e7]">/</span>{conversationDetail ? "Conversation inspection" : page}</div><div className="flex items-center rounded-lg border border-[#d7e4f6] bg-white p-1">{["Today", "7 Days", "30 Days"].map((option) => <button key={option} onClick={() => setPeriod(option)} className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${period === option ? "bg-[#0866f5] text-white shadow-sm" : "text-[#547092] hover:bg-[#f4f8ff]"}`}>{option}</button>)}<button onClick={() => buttonToast("Custom date range")} className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold text-[#547092] hover:bg-[#f4f8ff]"><Clock3 className="h-3 w-3" />Custom</button></div></div>{conversationDetail ? <ConversationDetail back={() => setConversationDetail(false)} /> : page === "Overview" ? <Overview onPage={choose} /> : <GenericPage page={page} back={() => choose("Overview")} onConversationOpen={() => setConversationDetail(true)} />}</div></div>
    </main>
  </div>;
}
