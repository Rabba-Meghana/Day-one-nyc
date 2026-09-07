"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, Building2, Check, CheckCircle2, ChevronRight,
  CircleDollarSign, Clock3, Database, ExternalLink, FileCheck2, Landmark,
  MapPin, RefreshCw, Search, ShieldCheck, X
} from "lucide-react";

export type Contract = {
  recordId: string; epin: string | null; contractId: string | null; title: string;
  agency: string; vendor: string; program: string | null; procurementMethod: string | null;
  contractType: string | null; status: string; awardAmount: number | null;
  currentAmount: number | null; totalEncumbered: number | null; totalPaid: number | null;
  startDate: string | null; endDate: string | null; registrationDate: string | null;
  industry: string | null; certification: string | null; corporateStructure: string | null;
  riskKey: "late" | "ontime" | "unknown" | "critical" | "watch" | "registered" | "pipeline";
  riskLabel: string; riskDays: number;
};
export type ContractPayload = {
  source: { publisher: string; system: string; url: string; retrievedAt: string; originalRecordCount: number; filter: string };
  records: Contract[];
};
export type Center = { dcid: string; permit_number: string; program_name: string; facility_type: string; program_type: string; address: string; borough?: string; zipcode: string; phone: string; age_range: string; capacity: string; administer_medication: string; latitude?: string; longitude?: string };
export type CenterData = {
  source: { publisher: string; dataset: string; datasetUrl: string; apiUrl: string; retrievedAt: string; recordCount: number };
  records: Center[];
};
type CentersPayload = { boroughTotals: { borough: string; centers: number; capacity: number }[]; centers: Center[] };

function riskFor(contract: Contract) {
  return { key: contract.riskKey, label: contract.riskLabel, days: contract.riskDays };
}
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const formatDate = (value: string | null) => value || "Not published";
const timestamp = (value: string) => new Date(value).toLocaleString("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  timeZone: "America/New_York", timeZoneName: "short",
});

export default function Dashboard({ data, centerData }: { data: ContractPayload; centerData: CenterData }) {
  const [tab, setTab] = useState<"contracts" | "centers" | "policy">("contracts");
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("active");
  const [agency, setAgency] = useState("all");
  const [selected, setSelected] = useState<Contract | null>(null);
  const [centers, setCenters] = useState<CentersPayload | null>(null);
  const [centerQuery, setCenterQuery] = useState("");
  const [borough, setBorough] = useState("");
  const [centersLoading, setCentersLoading] = useState(false);

  const classified = useMemo(() => data.records.map(contract => ({ contract, risk: riskFor(contract) })), [data.records]);
  const critical = classified.filter(x => x.risk.key === "critical");
  const atRiskValue = critical.reduce((sum, x) => sum + (x.contract.currentAmount ?? x.contract.awardAmount ?? 0), 0);
  const registered = classified.filter(x => ["late", "ontime"].includes(x.risk.key));
  const lateRegistered = registered.filter(x => x.risk.key === "late");
  const oldest = critical.reduce((max, x) => Math.max(max, x.risk.days), 0);

  const filtered = useMemo(() => classified.filter(({ contract, risk: itemRisk }) => {
    const haystack = `${contract.vendor} ${contract.title} ${contract.epin || ""} ${contract.contractId || ""}`.toLowerCase();
    const riskMatch = risk === "all" || (risk === "active" ? ["critical", "watch"].includes(itemRisk.key) : itemRisk.key === risk);
    return haystack.includes(query.toLowerCase()) && riskMatch && (agency === "all" || contract.agency === agency);
  }), [classified, query, risk, agency]);

  function loadCenters() {
    setCentersLoading(true);
    const filteredCenters = centerData.records.filter(center =>
      (center.program_name || "").toLowerCase().includes(centerQuery.toLowerCase()) &&
      (!borough || (center.borough || "") === borough.toUpperCase())
    );
    const totals = new Map<string, { borough: string; centers: number; capacity: number }>();
    for (const center of centerData.records) {
      const name = center.borough || "UNSPECIFIED";
      const item = totals.get(name) || { borough: name, centers: 0, capacity: 0 };
      item.centers += 1;
      const capacity = Number(center.capacity);
      if (Number.isFinite(capacity)) item.capacity += capacity;
      totals.set(name, item);
    }
    setCenters({ boroughTotals: [...totals.values()].sort((a, b) => a.borough.localeCompare(b.borough)), centers: filteredCenters.slice(0, 80) });
    setCentersLoading(false);
  }
  const retrieved = timestamp(data.source.retrievedAt);

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">01</div><div><strong>Day One Pay</strong><span>NYC child and education service contracts</span></div></div>
      <nav className="icon-nav" aria-label="Primary">
        <button className={tab === "contracts" ? "active" : ""} onClick={() => setTab("contracts")}><AlertTriangle/><span>Risk desk</span></button>
        <button className={tab === "centers" ? "active" : ""} onClick={() => { setTab("centers"); if (!centers) setTimeout(loadCenters, 0); }}><Building2/><span>Licensed sites</span></button>
        <button className={tab === "policy" ? "active" : ""} onClick={() => setTab("policy")}><ShieldCheck/><span>Guarantee</span></button>
      </nav>
      <div className="source-pill"><span className="live-dot" /> OFFICIAL SNAPSHOT · {retrieved}</div>
    </header>

    {tab === "contracts" && <>
      <section className="city-stage">
        <div className="city-stage-shade" />
        <div className="hero-copy">
          <p className="eyebrow">NYC FIRST-PAYMENT WATCH</p>
          <h1>The city said <em>start.</em><br/>The paperwork said <em>wait.</em></h1>
          <p className="hero-lede">A live evidence desk for child and education contracts caught between service delivery and registration.</p>
          <div className="hero-actions">
            <button className="glow-button" onClick={() => document.getElementById("risk-desk")?.scrollIntoView({ behavior: "smooth" })}>Open the risk desk <ArrowRight/></button>
            <a href="https://a0333-passportpublic.nyc.gov/contracts.html" target="_blank" rel="noreferrer">Verify in PASSPort <ExternalLink/></a>
          </div>
        </div>
        <aside className="hero-signal" aria-label="Active guarantee signal">
          <div className="signal-head"><span>Guarantee signal</span><ShieldCheck/></div>
          <strong>{critical.length}</strong>
          <h2>contracts meet the trigger</h2>
          <p>Published start date passed. Registration date still absent.</p>
          <div className="signal-line"><span>PROPOSED RULE</span><b>STARTED + NOT REGISTERED</b></div>
        </aside>
        <section className="metrics" aria-label="Risk summary">
          <Metric icon={<AlertTriangle/>} label="Active trigger" value={String(critical.length)} note="Started, not registered" tone="danger" />
          <Metric icon={<CircleDollarSign/>} label="Value in view" value={compactMoney.format(atRiskValue)} note="Current or award amount" tone="ink" />
          <Metric icon={<Clock3/>} label="Oldest open clock" value={`${oldest} days`} note="Since contract start" tone="warning" />
          <Metric icon={<FileCheck2/>} label="Registered late" value={registered.length ? `${Math.round(lateRegistered.length / registered.length * 100)}%` : "—"} note={`${lateRegistered.length} of ${registered.length} dated records`} tone="blue" />
        </section>
      </section>
      <section className="workbench" id="risk-desk">
        <div className="desk-title"><div><p className="eyebrow">CONTRACT EVIDENCE</p><h2>Follow the money clock</h2></div><span>{data.records.length} filtered records from {data.source.originalRecordCount.toLocaleString()} checked</span></div>
        <div className="filters">
          <label className="search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vendor, title, EPIN or contract ID" /></label>
          <select aria-label="Risk filter" value={risk} onChange={e => setRisk(e.target.value)}>
            <option value="active">Active risk</option><option value="critical">Started, unregistered</option><option value="watch">Starts within 60 days</option><option value="late">Registered late</option><option value="ontime">Registered on time</option><option value="all">All records</option>
          </select>
          <select aria-label="Agency filter" value={agency} onChange={e => setAgency(e.target.value)}>
            <option value="all">Both agencies</option><option value="DEPARTMENT OF EDUCATION">Department of Education</option><option value="ADMINISTRATION FOR CHILDREN'S SERVICES">Children&apos;s Services</option>
          </select>
        </div>
        <div className="table-meta"><span>{filtered.length} real contract records</span><span>Risk rules are calculated from published dates</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Risk</th><th>Provider / contract</th><th>Agency</th><th>Start</th><th>Registration</th><th>Value</th><th></th></tr></thead>
          <tbody>{filtered.length === 0 && <tr className="empty-row"><td colSpan={7}>No contracts match these filters.</td></tr>}{filtered.slice(0, 150).map(({ contract, risk: itemRisk }) => <tr key={contract.recordId} onClick={() => setSelected(contract)}>
            <td><RiskBadge item={itemRisk}/></td>
            <td><strong>{contract.vendor}</strong><span>{contract.title}</span></td>
            <td><span className="agency-tag">{contract.agency === "DEPARTMENT OF EDUCATION" ? "DOE" : "ACS"}</span></td>
            <td>{formatDate(contract.startDate)}</td><td>{formatDate(contract.registrationDate)}</td>
            <td className="amount">{contract.currentAmount != null ? money.format(contract.currentAmount) : contract.awardAmount != null ? money.format(contract.awardAmount) : "Not disclosed"}</td>
            <td><button className="row-open" aria-label={`View contract details for ${contract.vendor}`} onClick={event => { event.stopPropagation(); setSelected(contract); }}><ChevronRight size={18}/></button></td>
          </tr>)}</tbody>
        </table></div>
      </section>
    </>}

    {tab === "centers" && <section className="directory">
      <div className="section-heading"><div><p className="eyebrow">OFFICIAL LICENSE CHECK</p><h1>Active NYC childcare programs</h1><p>Search all {centerData.source.recordCount.toLocaleString()} programs in the Department of Health and Mental Hygiene dataset retrieved {timestamp(centerData.source.retrievedAt)}.</p></div><Database size={42}/></div>
      <div className="directory-controls">
        <label className="search"><Search size={18}/><input value={centerQuery} onChange={e => setCenterQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && loadCenters()} placeholder="Search program name" /></label>
        <select aria-label="Borough filter" value={borough} onChange={e => setBorough(e.target.value)}><option value="">All boroughs</option><option>Bronx</option><option>Brooklyn</option><option>Manhattan</option><option>Queens</option><option>Staten Island</option></select>
        <button className="primary-button" onClick={loadCenters} disabled={centersLoading}>{centersLoading ? <RefreshCw className="spin"/> : <Search/>} Search dataset</button>
      </div>
      {centers?.boroughTotals && <div className="borough-strip">{centers.boroughTotals.map(x => <div key={x.borough}><span>{x.borough}</span><strong>{Number(x.centers).toLocaleString()}</strong><small>{Number(x.capacity).toLocaleString()} licensed capacity</small></div>)}</div>}
      <div className="center-grid">{centers?.centers.length === 0 && <div className="empty-state">No licensed programs match that search.</div>}{centers?.centers.map(center => <article key={center.dcid}>
        <div className="center-icon"><Building2/></div><div><h2>{center.program_name}</h2><p><MapPin size={15}/>{center.address}, {center.borough} {center.zipcode}</p><div className="chips"><span>Permit {center.permit_number}</span><span>{center.program_type}</span><span>Capacity {center.capacity}</span></div><footer><span>{center.age_range}</span><a href={`tel:${center.phone}`}>{center.phone}</a></footer></div>
      </article>)}</div>
      <a className="data-link" href={centerData.source.datasetUrl} target="_blank" rel="noreferrer"><Database size={15}/> Source: {centerData.source.publisher} · {centerData.source.recordCount.toLocaleString()} records · retrieved {timestamp(centerData.source.retrievedAt)} <ExternalLink size={14}/></a>
    </section>}

    {tab === "policy" && <section className="policy-page">
      <div className="section-heading"><div><p className="eyebrow">IMPLEMENTABLE POLICY LOGIC</p><h1>The First Payroll Guarantee</h1><p>A precise trigger that can be piloted without pretending the payment system already exists.</p></div><Landmark size={44}/></div>
      <div className="rule-flow">
        <Rule n="01" title="Contract selected" text="Agency has selected the provider and published the record in PASSPort."/><ArrowRight className="flow-arrow"/>
        <Rule n="02" title="Safety cleared" text="Required licensing, insurance and background checks are complete."/><ArrowRight className="flow-arrow"/>
        <Rule n="03" title="Clock expires" text="The contract start date arrives before registration is published."/><ArrowRight className="flow-arrow"/>
        <Rule n="04" title="Payroll protected" text="A standing city reserve advances the first payroll, then reconciles after registration." accent/>
      </div>
      <div className="policy-grid">
        <article><h2>What this prototype verifies today</h2><ul><li><Check/>Real PASSPort record exists</li><li><Check/>Published start date has arrived</li><li><Check/>Registration date remains absent</li><li><Check/>Provider and disclosed contract value are traceable</li></ul></article>
        <article><h2>What city systems must add</h2><ul><li><Clock3/>Safety-clearance confirmation</li><li><Clock3/>Approved payroll amount</li><li><Clock3/>Treasury disbursement authorization</li><li><Clock3/>Recovery and fraud controls</li></ul></article>
      </div>
      <div className="truth-note"><AlertTriangle/><div><strong>This is an evidence-backed policy prototype, not a city payment system.</strong><span>It identifies real contracts that would trigger the proposed rule. Releasing public money requires NYC authorization, secure integrations and appropriated funds.</span></div></div>
    </section>}

    <footer className="site-footer"><span>DAY ONE PAY · PUBLIC-INTEREST PROTOTYPE</span><span>Contract source: <a href={data.source.url} target="_blank" rel="noreferrer">PASSPort Public</a> · {data.source.originalRecordCount.toLocaleString()} source records checked</span></footer>
    {selected && <ContractDrawer contract={selected} onClose={() => setSelected(null)} />}
  </main>;
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <article className={`metric ${tone}`}><div className="metric-top"><span>{label}</span>{icon}</div><strong>{value}</strong><p>{note}</p></article>;
}
function RiskBadge({ item }: { item: ReturnType<typeof riskFor> }) {
  return <span className={`risk risk-${item.key}`}><i />{item.label}{["critical", "late"].includes(item.key) ? ` · ${item.days}d` : ""}</span>;
}
function Rule({ n, title, text, accent = false }: { n: string; title: string; text: string; accent?: boolean }) {
  return <article className={accent ? "rule accent" : "rule"}><span>{n}</span><h2>{title}</h2><p>{text}</p></article>;
}
function ContractDrawer({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const itemRisk = riskFor(contract);
  const isTrigger = itemRisk.key === "critical";
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <aside className="drawer" role="dialog" aria-modal="true" aria-label="Contract details"><button className="close" onClick={onClose} aria-label="Close" autoFocus><X/></button>
      <p className="eyebrow">CONTRACT EVIDENCE</p><RiskBadge item={itemRisk}/><h2>{contract.vendor}</h2><p className="drawer-title">{contract.title}</p>
      <div className={isTrigger ? "verdict trigger" : "verdict"}>{isTrigger ? <AlertTriangle/> : <CheckCircle2/>}<div><strong>{isTrigger ? "Proposed guarantee trigger met" : "Trigger not currently met"}</strong><span>{isTrigger ? `Start date passed ${itemRisk.days} days ago and no registration date is published.` : "Based only on the dates and status currently published."}</span></div></div>
      <dl><div><dt>Status</dt><dd>{contract.status}</dd></div><div><dt>Agency</dt><dd>{contract.agency}</dd></div><div><dt>EPIN</dt><dd>{contract.epin || "Not published"}</dd></div><div><dt>Contract ID</dt><dd>{contract.contractId || "Not published"}</dd></div><div><dt>Start date</dt><dd>{formatDate(contract.startDate)}</dd></div><div><dt>Registration date</dt><dd>{formatDate(contract.registrationDate)}</dd></div><div><dt>Current amount</dt><dd>{contract.currentAmount != null ? money.format(contract.currentAmount) : "Not disclosed"}</dd></div><div><dt>Total paid</dt><dd>{contract.totalPaid != null ? money.format(contract.totalPaid) : "Not disclosed"}</dd></div></dl>
      <a className="primary-button full" href="https://a0333-passportpublic.nyc.gov/contracts.html" target="_blank" rel="noreferrer">Verify in PASSPort <ExternalLink size={16}/></a>
      <p className="drawer-disclaimer">The trigger is a proposed policy rule. It does not establish that money is legally owed or authorize a payment.</p>
    </aside>
  </div>;
}
