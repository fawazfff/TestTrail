import { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Connection, PublicKey, Transaction, TransactionInstruction, clusterApiUrl } from "@solana/web3.js";
import { Activity, ArrowDownRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, CircleHelp, Clipboard, ExternalLink, FileCheck2, FlaskConical, Globe2, ImagePlus, Link2, LoaderCircle, Menu, Plus, Search, ShieldCheck, Sparkles, Unplug, Wallet, X, XCircle } from "lucide-react";

type Status = "passed" | "failed" | "blocked";
type Run = { id?: string; slug: string; title: string; app_url: string; description: string; created_at?: string; network?: string };
type Report = { id?: string; run_id: string; status: Status; summary: string; details: string; screenshot_url?: string | null; receipt_signature?: string | null; created_at?: string };
type WalletProvider = { publicKey?: { toString(): string }; connect(): Promise<{ publicKey: { toString(): string } }>; disconnect(): Promise<void>; signTransaction?(tx: Transaction): Promise<Transaction> };
declare global { interface Window { solana?: WalletProvider } }

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const demoRuns: Run[] = [
 { slug: "solana-2048", title: "Solana 2048", app_url: "https://solana2048.com", description: "Check game controls, wallet prompts, and transaction feedback.", created_at: new Date().toISOString() },
 { slug: "wallet-onboarding", title: "Wallet onboarding flow", app_url: "https://example.com", description: "Review connection, cancellation, and error states.", created_at: new Date(Date.now()-86400000).toISOString() }
];
const demoReports: Report[] = [
 { run_id: "solana-2048", status: "passed", summary: "Game loads and controls respond", details: "Tested the main game loop on desktop.", created_at: new Date().toISOString() },
 { run_id: "solana-2048", status: "blocked", summary: "Wallet prompt unclear", details: "Could not tell whether the connection request was optional.", created_at: new Date(Date.now()-3600000).toISOString() },
 { run_id: "wallet-onboarding", status: "failed", summary: "Cancel leaves loading state visible", details: "After cancelling the wallet prompt, the spinner remained.", created_at: new Date(Date.now()-86400000).toISOString() }
];
const makeSlug = () => Math.random().toString(36).slice(2, 10);
const shortDate = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Just now";
const statusLabel: Record<Status, string> = { passed: "Passed", failed: "Failed", blocked: "Blocked" };

export default function App() {
 const [runs, setRuns] = useState<Run[]>(demoRuns);
 const [reports, setReports] = useState<Report[]>(demoReports);
 const [activeSlug, setActiveSlug] = useState(() => location.pathname.split("/").filter(Boolean)[1] || "solana-2048");
 const [view, setView] = useState<"overview"|"inbox"|"create">("overview");
 const [search, setSearch] = useState("");
 const [wallet, setWallet] = useState("");
 const [walletBusy, setWalletBusy] = useState(false);
 const [notice, setNotice] = useState("");
 const [createTitle, setCreateTitle] = useState("");
 const [createUrl, setCreateUrl] = useState("");
 const [createDescription, setCreateDescription] = useState("");
 const [reportStatus, setReportStatus] = useState<Status>("passed");
 const [reportSummary, setReportSummary] = useState("");
 const [reportDetails, setReportDetails] = useState("");
 const [screenshot, setScreenshot] = useState<File | null>(null);
 const [submitting, setSubmitting] = useState(false);
 const [receipt, setReceipt] = useState(true);
 const [mobileMenu, setMobileMenu] = useState(false);
 const isConfigured = Boolean(supabase);
 const activeRun = runs.find(r => r.slug === activeSlug) || runs[0];
 const activeReports = useMemo(() => reports.filter(r => r.run_id === (activeRun?.id || activeRun?.slug)), [reports, activeRun]);
 const allReports = reports;
 const filteredRuns = runs.filter(r => (r.title + " " + r.app_url).toLowerCase().includes(search.toLowerCase()));

 useEffect(() => {
  if (!supabase) return;
  let alive = true;
  (async () => {
   const [{ data: runData }, { data: reportData }] = await Promise.all([
    supabase.from("test_runs").select("*").order("created_at", { ascending: false }),
    supabase.from("test_reports").select("*").order("created_at", { ascending: false })
   ]);
   if (!alive) return;
   if (runData) setRuns(runData);
   if (reportData) setReports(reportData);
   if (runData?.length && !runData.some((r: Run) => r.slug === activeSlug)) setActiveSlug(runData[0].slug);
  })().catch(() => setNotice("Could not load Supabase data. Check your project URL, anon key, and SQL setup."));
  return () => { alive = false; };
 }, []);

 useEffect(() => {
  const onPop = () => { const p = location.pathname.split("/").filter(Boolean); setView(p[0] === "i" ? "inbox" : "overview"); if (p[0] === "t" && p[1]) setActiveSlug(p[1]); };
  addEventListener("popstate", onPop); return () => removeEventListener("popstate", onPop);
 }, []);

 function navigate(nextView: "overview"|"inbox"|"create", slug = activeSlug) {
  setView(nextView); setMobileMenu(false);
  const path = nextView === "inbox" ? "/i/" + slug : nextView === "create" ? "/new" : "/t/" + slug;
  history.pushState({}, "", path);
 }
 async function connectWallet() {
  if (!window.solana) { setNotice("Install a Solana wallet such as Phantom, then refresh this page."); return; }
  setWalletBusy(true);
  try { const result = await window.solana.connect(); setWallet(result.publicKey.toString()); setNotice("Wallet connected to this browser session."); }
  catch { setNotice("Wallet connection was cancelled."); }
  finally { setWalletBusy(false); }
 }
 async function disconnectWallet() {
  try { await window.solana?.disconnect(); } catch { /* local state still clears */ }
  setWallet(""); setNotice("Wallet disconnected.");
 }
 async function createRun(e: React.FormEvent) {
  e.preventDefault();
  if (!createTitle.trim() || !/^https?:\/\//i.test(createUrl)) { setNotice("Add a project name and a valid http:// or https:// URL."); return; }
  const run: Run = { slug: makeSlug(), title: createTitle.trim(), app_url: createUrl.trim(), description: createDescription.trim(), network: "devnet" };
  if (supabase) {
   const { data, error } = await supabase.from("test_runs").insert(run).select().single();
   if (error) { setNotice("Could not save this test run. Check the Supabase schema and access policies."); return; }
   Object.assign(run, data);
  }
  setRuns(prev => [run, ...prev]); setCreateTitle(""); setCreateUrl(""); setCreateDescription(""); setActiveSlug(run.slug);
  navigate("overview", run.slug); setNotice(isConfigured ? "Test run created and saved." : "Demo test run created locally. Configure Supabase to persist it.");
 }
 async function submitReport(e: React.FormEvent) {
  e.preventDefault();
  if (!activeRun || !reportSummary.trim()) { setNotice("Add a short summary before submitting."); return; }
  setSubmitting(true); setNotice("");
  try {
   let screenshotUrl: string | null = null;
   if (screenshot && supabase) {
    const safeName = screenshot.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const key = activeRun.slug + "/" + Date.now() + "-" + safeName;
    const { error } = await supabase.storage.from("test-screenshots").upload(key, screenshot, { upsert: false, contentType: screenshot.type });
    if (error) throw new Error("Screenshot upload failed. Create a public Storage bucket named test-screenshots or submit without the screenshot.");
    screenshotUrl = supabase.storage.from("test-screenshots").getPublicUrl(key).data.publicUrl;
   }
   let signature: string | null = null;
   const runId = activeRun.id || activeRun.slug;
   const report: Report = { run_id: runId, status: reportStatus, summary: reportSummary.trim(), details: reportDetails.trim(), screenshot_url: screenshotUrl };
   if (supabase && activeRun.id) {
    const { data, error } = await supabase.from("test_reports").insert({ ...report, run_id: activeRun.id }).select().single();
    if (error) throw new Error("Could not save the report. Check the Supabase schema and policies.");
    Object.assign(report, data);
   }
   if (receipt && wallet && window.solana?.signTransaction) {
    try {
     const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
     const payer = new PublicKey(wallet);
     const tx = new Transaction().add(new TransactionInstruction({
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(JSON.stringify({ app: "TestTrail", run: activeRun.slug, status: reportStatus, summary: reportSummary.trim().slice(0, 180) }), "utf8")
     }));
     tx.feePayer = payer; tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
     const signed = await window.solana.signTransaction(tx);
     signature = await connection.sendRawTransaction(signed.serialize());
     await connection.confirmTransaction(signature, "confirmed");
     report.receipt_signature = signature;
     if (supabase && report.id) await supabase.from("test_reports").update({ receipt_signature: signature }).eq("id", report.id);
    } catch (err) { setNotice(err instanceof Error ? err.message : "Receipt was not published. The report itself was saved."); }
   }
   if (!supabase || !activeRun.id) setReports(prev => [{ ...report, id: makeSlug(), created_at: new Date().toISOString() }, ...prev]);
   else setReports(prev => [report, ...prev]);
   setReportSummary(""); setReportDetails(""); setScreenshot(null);
   if (!notice) setNotice(signature ? "Report saved with a confirmed Devnet receipt." : isConfigured ? "Report saved." : "Demo report added locally. Connect Supabase to persist reports.");
  } catch (err) { setNotice(err instanceof Error ? err.message : "Could not submit this report."); }
  finally { setSubmitting(false); }
 }
 async function copyLink(path: string) {
  try { await navigator.clipboard.writeText(location.origin + path); setNotice("Link copied."); }
  catch { setNotice("Copy was blocked by the browser. Copy this URL from the address bar: " + location.origin + path); }
 }
 const passed = allReports.filter(r => r.status === "passed").length;
 const failed = allReports.filter(r => r.status === "failed").length;
 const blocked = allReports.filter(r => r.status === "blocked").length;

 return <div className="app-shell">
  <aside className={"sidebar " + (mobileMenu ? "sidebar-open" : "")}>
   <a className="brand" href="/" onClick={e => { e.preventDefault(); navigate("overview"); }}><span className="brand-mark"><FlaskConical size={18}/></span><span>testtrail<span className="brand-period">.</span></span></a>
   <div className="workspace-label">WORKSPACE <ChevronDown size={13}/></div>
   <button className={"nav-item " + (view === "overview" ? "active" : "")} onClick={() => navigate("overview")}><Activity size={17}/> Overview</button>
   <button className={"nav-item " + (view === "inbox" ? "active" : "")} onClick={() => navigate("inbox")}><Clipboard size={17}/> Report inbox <span className="nav-count">{allReports.length}</span></button>
   <div className="side-section"><span>YOUR TEST RUNS</span><button aria-label="Create test run" onClick={() => navigate("create")}><Plus size={16}/></button></div>
   <div className="run-nav">{runs.slice(0,5).map(run => <button key={run.slug} className={"run-nav-item " + (run.slug === activeSlug && view === "overview" ? "selected" : "")} onClick={() => navigate("overview", run.slug)}><span className="run-dot"/><span>{run.title}</span></button>)}</div>
   <div className="sidebar-bottom"><div className="devnet-tag"><span/> Solana Devnet</div><div className="profile-row"><div className="avatar">T</div><div className="profile-copy"><strong>TestTrail workspace</strong><span>{isConfigured ? "Supabase connected" : "Local demo mode"}</span></div><button title={wallet ? "Disconnect wallet" : "Connect wallet"} onClick={wallet ? disconnectWallet : connectWallet}>{wallet ? <Unplug size={16}/> : <Wallet size={16}/>}</button></div></div>
  </aside>
  {mobileMenu && <button className="scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)}/>}
  <main className="main">
   <header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={19}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{view === "create" ? "New test run" : view === "inbox" ? "Report inbox" : "Overview"}</strong></div><div className="top-actions"><span className={"mode-label " + (!isConfigured ? "demo-label" : "")}><span/> {isConfigured ? "Connected to Supabase" : "Demo data"}</span>{wallet ? <button className="wallet-button" onClick={disconnectWallet}><span className="wallet-live"/> {wallet.slice(0,4)}…{wallet.slice(-4)} <Unplug size={14}/></button> : <button className="connect-button" onClick={connectWallet} disabled={walletBusy}>{walletBusy ? <LoaderCircle size={15} className="spin"/> : <Wallet size={15}/>} Connect wallet</button>}</div></header>
   {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15}/></button></div>}
   {view === "create" ? <section className="page page-narrow enter"><button className="back-link" onClick={() => navigate("overview")}><ArrowDownRight size={15}/> Back to overview</button><div className="page-heading"><div className="eyebrow"><Plus size={13}/> NEW TEST RUN</div><h1>Give your dApp<br/>a proper test.</h1><p>Set up a place for testers to try your app and report what they find.</p></div><form className="form-panel" onSubmit={createRun}><label>Project name<input value={createTitle} onChange={e=>setCreateTitle(e.target.value)} placeholder="e.g. Solana 2048" required maxLength={80}/></label><label>Application URL<input value={createUrl} onChange={e=>setCreateUrl(e.target.value)} placeholder="https://your-dapp.com" type="url" required/></label><label>What should testers look for? <span className="optional">OPTIONAL</span><textarea value={createDescription} onChange={e=>setCreateDescription(e.target.value)} placeholder="Try wallet connection, complete a transaction, check mobile layout…" rows={4}/></label><div className="form-note"><ShieldCheck size={17}/><span>TestTrail uses Solana Devnet for optional test receipts. It will not move real funds.</span></div><button className="primary-button full-button" type="submit">Create test run <ArrowUpRight size={16}/></button></form></section>
   : view === "inbox" ? <section className="page enter"><div className="page-heading compact-heading"><div className="eyebrow"><Clipboard size={13}/> TESTER FEEDBACK</div><h1>Report inbox<span className="period">.</span></h1><p>Every report in one place. Find what passed, what broke, and what needs another look.</p></div><div className="inbox-toolbar"><div className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search test runs or reports"/></div><button className="secondary-button" onClick={() => copyLink("/i/"+activeSlug)}><Link2 size={15}/> Copy inbox link</button></div><div className="report-list">{allReports.filter(r => {const run = runs.find(x => (x.id || x.slug) === r.run_id); return (r.summary+" "+r.details+" "+(run?.title||"")).toLowerCase().includes(search.toLowerCase());}).map((r,i) => {const run = runs.find(x => (x.id || x.slug) === r.run_id);return <article className="report-row" key={r.id || i}><div className={"status-icon "+r.status}>{r.status==="passed"?<CheckCircle2 size={17}/>:r.status==="failed"?<XCircle size={17}/>:<CircleHelp size={17}/>}</div><div className="report-main"><div className="report-title">{r.summary}</div><div className="report-meta"><span>{run?.title || "Test run"}</span><span>·</span><span>{shortDate(r.created_at)}</span></div>{r.details && <p>{r.details}</p>}{r.screenshot_url && <a className="attachment-link" href={r.screenshot_url} target="_blank" rel="noreferrer"><ImagePlus size={14}/> View screenshot <ExternalLink size={12}/></a>}{r.receipt_signature && <a className="attachment-link" href={"https://explorer.solana.com/tx/"+r.receipt_signature+"?cluster=devnet"} target="_blank" rel="noreferrer"><FileCheck2 size={14}/> Devnet receipt <ExternalLink size={12}/></a>}</div><span className={"status-pill "+r.status}>{statusLabel[r.status]}</span></article>})}{allReports.length===0 && <div className="empty-state"><Clipboard size={25}/><h3>No reports yet</h3><p>When testers submit feedback, it will appear here.</p></div>}</div></section>
   : <section className="page enter">
    <div className="hero-row"><div className="page-heading"><div className="eyebrow"><span className="eyebrow-dot"/> SOLANA DAPP TESTING</div><h1>Ship with<br/>fewer surprises<span className="period">.</span></h1><p>A clear picture of what works, what breaks, and what real people experience in your dApp.</p><div className="hero-buttons"><button className="primary-button" onClick={() => navigate("create")}>Create a test run <ArrowUpRight size={16}/></button><button className="text-button" onClick={() => navigate("inbox")}>View all reports <ArrowUpRight size={15}/></button></div></div><div className="hero-art" aria-label="Illustration of a verified test report"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-cross cross-a"/><div className="art-cross cross-b"/><div className="art-sheet"><div className="art-sheet-top"><span className="mini-mark"><FlaskConical size={13}/></span><span>TEST REPORT</span><span className="art-check"><Check size={13}/></span></div><div className="art-lines"><i/><i/><i/></div><div className="art-result"><CheckCircle2 size={19}/><div><strong>Everything checks out</strong><span>Verified on Devnet</span></div></div><div className="art-footer"><span>TESTTRAIL / 001</span><span>CONFIRMED</span></div></div><div className="art-stamp"><ShieldCheck size={20}/><span>VERIFIED<br/>RECEIPT</span></div><div className="art-caption">A better trail from test to fix.</div></div></div>
    <div className="stats-grid"><div className="stat-card"><div className="stat-label">TEST RUNS <FlaskConical size={15}/></div><div className="stat-number">{runs.length.toString().padStart(2,"0")}</div><div className="stat-foot">Projects being tested</div></div><div className="stat-card"><div className="stat-label">PASSED <CheckCircle2 size={15}/></div><div className="stat-number">{passed.toString().padStart(2,"0")}<span className="stat-trend positive"><ArrowUpRight size={13}/></span></div><div className="stat-foot">Checks that worked</div></div><div className="stat-card"><div className="stat-label">NEEDS ATTENTION <Activity size={15}/></div><div className="stat-number">{(failed+blocked).toString().padStart(2,"0")}<span className="stat-trend caution"><ArrowDownRight size={13}/></span></div><div className="stat-foot">Failed or blocked checks</div></div></div>
    <div className="section-head"><div><div className="eyebrow">YOUR WORKSPACE</div><h2>Test runs <span className="subtle-count">{runs.length}</span></h2></div><div className="section-actions"><div className="search-box small-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a project"/></div><button className="icon-button" title="Create test run" onClick={() => navigate("create")}><Plus size={17}/></button></div></div>
    <div className="run-grid">{filteredRuns.map((run,i) => {const count=reports.filter(r=>r.run_id===(run.id||run.slug)).length;const failedCount=reports.filter(r=>r.run_id===(run.id||run.slug)&&r.status!=="passed").length;return <article className="run-card" key={run.slug} style={{animationDelay:(i*65)+"ms"}}><div className="run-card-top"><div className={"project-icon project-"+(i%3)}>{i===0?<Activity size={19}/>:i===1?<Wallet size={19}/>:<Globe2 size={19}/>}</div><span className="run-network"><span/> DEVNET</span><button className="more-button" title="Copy test link" onClick={()=>copyLink("/t/"+run.slug)}><Link2 size={16}/></button></div><h3>{run.title}</h3><a className="project-url" href={run.app_url} target="_blank" rel="noreferrer">{run.app_url.replace(/^https?:\/\//,"").replace(/\/$/,"")} <ExternalLink size={12}/></a><p className="run-description">{run.description || "No testing notes added yet."}</p><div className="run-card-bottom"><div className="report-count"><Clipboard size={14}/><strong>{count}</strong> {count===1?"report":"reports"}</div><span className={failedCount?"needs-fix":"all-clear"}>{failedCount?failedCount+" to review":"Looking good"}</span></div><div className="run-card-actions"><button onClick={()=>{setActiveSlug(run.slug);navigate("overview",run.slug);document.getElementById("tester-form")?.scrollIntoView({behavior:"smooth",block:"center"});}} className="card-action">Open test <ArrowUpRight size={14}/></button><button onClick={()=>{setActiveSlug(run.slug);copyLink("/t/"+run.slug);}} className="card-action secondary-action">Copy tester link <Link2 size={14}/></button></div></article>})}{filteredRuns.length===0 && <div className="empty-state"><Search size={24}/><h3>No matching test runs</h3><p>Try another search or create a new test run.</p></div>}<button className="new-run-card" onClick={()=>navigate("create")}><span className="new-run-icon"><Plus size={20}/></span><strong>Start a new test run</strong><span>Share a link and get useful feedback.</span></button></div>
    {activeRun && <div className="tester-section" id="tester-form"><div className="tester-intro"><div className="eyebrow"><Sparkles size={13}/> TESTER WORKSPACE</div><h2>Try it. Tell us what happened.</h2><p>Selected project: <strong>{activeRun.title}</strong>. Open the dApp, follow the testing notes, and share your result.</p><a className="open-app-link" href={activeRun.app_url} target="_blank" rel="noreferrer">Open {activeRun.title} <ExternalLink size={14}/></a></div><form className="report-form" onSubmit={submitReport}><div className="form-title">Submit a test report <span>DEVNET</span></div><label>Test result</label><div className="status-select">{(["passed","failed","blocked"] as Status[]).map(s=><button type="button" key={s} onClick={()=>setReportStatus(s)} className={"status-option "+(reportStatus===s?"chosen "+s:"")}><span className={"status-option-icon "+s}>{s==="passed"?<CheckCircle2 size={16}/>:s==="failed"?<XCircle size={16}/>:<CircleHelp size={16}/>}</span>{statusLabel[s]}</button>)}</div><label>What happened?<input value={reportSummary} onChange={e=>setReportSummary(e.target.value)} placeholder="e.g. Wallet connected successfully" required maxLength={180}/></label><label>Details <span className="optional">OPTIONAL</span><textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} rows={3} placeholder="Steps you took, what you expected, and what actually happened."/></label><label className="upload-zone"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setScreenshot(e.target.files?.[0]||null)}/><ImagePlus size={18}/><span><strong>{screenshot ? screenshot.name : "Attach a screenshot"}</strong><small>{screenshot ? "Click to choose another file" : "PNG, JPG or WebP. Stored with Supabase when configured."}</small></span><Plus size={17}/></label><label className="receipt-toggle"><input type="checkbox" checked={receipt} onChange={e=>setReceipt(e.target.checked)}/><span className="toggle-copy"><strong>Publish a Devnet receipt</strong><small>Ask your connected wallet to sign a memo transaction. Network fees may apply.</small></span><span className="optional">OPTIONAL</span></label><button className="primary-button full-button" disabled={submitting}>{submitting?<><LoaderCircle size={16} className="spin"/> Submitting report…</>:<>Submit report <ArrowUpRight size={16}/></>}</button><p className="privacy-note"><ShieldCheck size={14}/> No private keys are collected. Your wallet only signs when you approve the request.</p></form></div>}
    <footer className="footer"><span>TESTTRAIL © 2026</span><span>Made for better dApps, one test at a time.</span><button onClick={()=>setNotice("TestTrail collects the report details you submit. Wallet signatures are only requested when you opt in and approve the transaction.")}><CircleHelp size={14}/> How it works</button></footer>
   </section>}
  </main>
 </div>;
}
