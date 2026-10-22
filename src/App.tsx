import { useEffect, useMemo, useState } from "react";
import { Buffer } from "buffer";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Connection, PublicKey, Transaction, TransactionInstruction, clusterApiUrl } from "@solana/web3.js";
import { Activity, ArrowDownRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, CircleHelp, Clipboard, ExternalLink, FileCheck2, FlaskConical, Globe2, ImagePlus, Link2, LoaderCircle, Menu, Plus, Search, ShieldCheck, Sparkles, Star, Unplug, Wallet, X, XCircle } from "lucide-react";

type Status = "passed" | "failed" | "blocked";
type Run = { id?: string; slug: string; title: string; app_url: string; description: string; created_at?: string; network?: string; owner_wallet?: string };
type Report = { id?: string; run_id: string; status: Status; summary: string; details: string; screenshot_url?: string | null; receipt_signature?: string | null; created_at?: string };
type WalletProvider = { publicKey?: { toString(): string }; connect(): Promise<{ publicKey: { toString(): string } }>; disconnect(): Promise<void>; signTransaction?(tx: Transaction): Promise<Transaction>; signMessage?(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array }> };
declare global { interface Window { solana?: WalletProvider } }

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const apiUrl = supabaseUrl ? supabaseUrl.replace(/\/$/, "") + "/functions/v1/testtrail-api" : "";
async function api(action: string, body: Record<string, unknown> = {}, token?: string) {
 if (!apiUrl || !supabaseKey) throw new Error("TestTrail's backend is not configured yet.");
 const response = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json", "apikey": supabaseKey, ...(token ? { "Authorization": "Bearer " + token } : {}) }, body: JSON.stringify({ action, ...body }) });
 const data = await response.json();
 if (!response.ok || data.error) throw new Error(data.error || "Request failed.");
 return data;
}
const toBase64Url = (bytes: Uint8Array) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); };
const makeSlug = () => Math.random().toString(36).slice(2, 10);
const shortDate = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Just now";
const statusLabel: Record<Status, string> = { passed: "Passed", failed: "Failed", blocked: "Blocked" };

export default function App() {
 const [runs, setRuns] = useState<Run[]>([]);
 const [reports, setReports] = useState<Report[]>([]);
 const [activeSlug, setActiveSlug] = useState(() => location.pathname.split("/").filter(Boolean)[1] || "");
 const [ownerWallet, setOwnerWallet] = useState("");
 const [view, setView] = useState<"overview"|"inbox"|"create"|"tester">(() => location.pathname.split("/").filter(Boolean)[0] === "i" ? "inbox" : location.pathname.split("/").filter(Boolean)[0] === "new" ? "create" : location.pathname.split("/").filter(Boolean)[0] === "test" ? "tester" : "overview");
 const [search, setSearch] = useState("");
 const [favorites, setFavorites] = useState<string[]>(() => { try { const saved = localStorage.getItem("testtrail-favorites"); return saved ? JSON.parse(saved) as string[] : ["Solana Explorer", "Solana Playground"]; } catch { return ["Solana Explorer", "Solana Playground"]; } });
 const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
 useEffect(() => { try { localStorage.setItem("testtrail-favorites", JSON.stringify(favorites)); } catch { /* session-only fallback */ } }, [favorites]);
 function toggleFavorite(name: string) { setFavorites(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]); }
 const [wallet, setWallet] = useState(() => { try { return sessionStorage.getItem("testtrail-wallet") || ""; } catch { return ""; } });
 const [sessionToken, setSessionToken] = useState(() => { try { return sessionStorage.getItem("testtrail-session") || ""; } catch { return ""; } });
 const [publicLoading, setPublicLoading] = useState(false);
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
 const activeRun = runs.find(r => r.slug === activeSlug);
 const activeReports = useMemo(() => reports.filter(r => r.run_id === (activeRun?.id || activeRun?.slug)), [reports, activeRun]);
 const allReports = reports.filter(report => { const run = runs.find(item => (item.id || item.slug) === report.run_id); return !run?.owner_wallet || !wallet || run.owner_wallet === wallet; });
 const filteredRuns = runs.filter(r => (!r.owner_wallet || r.owner_wallet === wallet) && (r.title + " " + r.app_url).toLowerCase().includes(search.toLowerCase()));

 useEffect(() => {
  let alive = true;
  const path = location.pathname.split("/").filter(Boolean);
  if (path[0] === "test" && path[1]) {
   setPublicLoading(true);
   api("get-test", { slug: path[1] }).then(data => { if (alive) { setRuns(prev => [data.run, ...prev.filter(r => r.slug !== data.run.slug)]); setActiveSlug(data.run.slug); } }).catch(err => { if (alive) setNotice(err.message); }).finally(() => { if (alive) setPublicLoading(false); });
   return () => { alive = false; };
  }
  if (!sessionToken) { setRuns([]); setReports([]); return () => { alive = false; }; }
  api("list", {}, sessionToken).then(data => { if (!alive) return; setRuns(data.runs || []); setReports(data.reports || []); if (data.runs?.length && !activeSlug) setActiveSlug(data.runs[0].slug); }).catch(err => { if (alive) { setNotice(err.message); setSessionToken(""); setWallet(""); sessionStorage.removeItem("testtrail-session"); sessionStorage.removeItem("testtrail-wallet"); } });
  return () => { alive = false; };
 }, [sessionToken]);

 useEffect(() => {
  const onPop = () => { const p = location.pathname.split("/").filter(Boolean); setView(p[0] === "i" ? "inbox" : p[0] === "new" ? "create" : p[0] === "test" ? "tester" : "overview"); if ((p[0] === "t" || p[0] === "test" || p[0] === "i") && p[1]) setActiveSlug(p[1]); };
  addEventListener("popstate", onPop); return () => removeEventListener("popstate", onPop);
 }, []);

 function navigate(nextView: "overview"|"inbox"|"create"|"tester", slug = activeSlug) {
  setView(nextView); setMobileMenu(false);
  const path = nextView === "inbox" ? "/i/" + slug : nextView === "create" ? "/new" : nextView === "tester" ? "/test/" + slug : "/";
  history.pushState({}, "", path);
 }
 async function connectWallet() {
  if (!window.solana) { setNotice("Install a Solana wallet such as Phantom, then refresh this page."); return; }
  setWalletBusy(true);
  try {
   const result = await window.solana.connect(), address = result.publicKey.toString();
   if (!window.solana.signMessage) throw new Error("Your wallet cannot sign a login message. Try Phantom.");
   const challenge = await api("challenge", { wallet: address });
   const signed = await window.solana.signMessage(new TextEncoder().encode(challenge.message), "utf8");
   const verified = await api("verify", { wallet: address, signature: toBase64Url(signed.signature) });
   setWallet(address); setOwnerWallet(address); setSessionToken(verified.token);
   sessionStorage.setItem("testtrail-wallet", address); sessionStorage.setItem("testtrail-session", verified.token);
   setNotice("Wallet verified. Your TestTrail workspace is ready.");
  } catch (err) { setNotice(err instanceof Error ? err.message : "Wallet sign-in was cancelled."); }
  finally { setWalletBusy(false); }
 }
 async function disconnectWallet() {
  try { await window.solana?.disconnect(); } catch { /* local state still clears */ }
  setWallet(""); setOwnerWallet(""); setSessionToken(""); setRuns([]); setReports([]); sessionStorage.removeItem("testtrail-wallet"); sessionStorage.removeItem("testtrail-session"); setNotice("Wallet disconnected.");
 }
 async function createRun(e: React.FormEvent) {
  e.preventDefault();
  if (!wallet) { setNotice("Connect your Solana wallet before creating a test link."); return; }
  if (!createTitle.trim() || !/^https?:\/\//i.test(createUrl)) { setNotice("Add a project name and a valid http:// or https:// URL."); return; }
  if (!sessionToken) { setNotice("Connect and verify your wallet before creating a test."); return; }
  try {
   const data = await api("create", { title: createTitle.trim(), app_url: createUrl.trim(), description: createDescription.trim() }, sessionToken);
   const run = data.run as Run; setRuns(prev => [run, ...prev]); setCreateTitle(""); setCreateUrl(""); setCreateDescription(""); setActiveSlug(run.slug);
   navigate("overview", run.slug); setNotice("Test link created. Copy the tester link and send it to your testers.");
  } catch (err) { setNotice(err instanceof Error ? err.message : "Could not create test."); }
 }
 async function submitReport(e: React.FormEvent) {
  e.preventDefault();
  if (!activeRun || !reportSummary.trim()) { setNotice("Add a short summary before submitting."); return; }
  if (!supabase || !activeRun.id) { setNotice("This test link is not connected to a saved project. Ask the developer for a current link."); return; }
  setSubmitting(true); setNotice("");
  try {
   let screenshotUrl: string | null = null;
   if (screenshot && supabase) {
    if (screenshot.size > 5 * 1024 * 1024) throw new Error("Screenshot must be 5 MB or smaller.");
    const safeName = screenshot.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const key = activeRun.slug + "/" + Date.now() + "-" + safeName;
    const { error } = await supabase.storage.from("test-screenshots").upload(key, screenshot, { upsert: false, contentType: screenshot.type });
    if (error) throw new Error("Screenshot upload failed. Create a public Storage bucket named test-screenshots or submit without the screenshot.");
    screenshotUrl = supabase.storage.from("test-screenshots").getPublicUrl(key).data.publicUrl;
   }
   let signature: string | null = null;
   const runId = activeRun.id || activeRun.slug;
   const report: Report = { run_id: runId, status: reportStatus, summary: reportSummary.trim(), details: reportDetails.trim(), screenshot_url: screenshotUrl };
   { const { data, error } = await supabase.from("test_reports").insert({ ...report, run_id: activeRun.id }).select().single(); if (error) throw new Error("Could not save the report. Check the Supabase schema and policies."); Object.assign(report, data); }
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
   setReports(prev => [report, ...prev]);
   setReportSummary(""); setReportDetails(""); setScreenshot(null);
   setNotice(signature ? "Feedback sent with a confirmed Devnet receipt." : "Feedback sent. Thanks for helping test this app!");
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
   <div className="workspace-label">YOUR PROJECTS <ChevronDown size={13}/></div>
   <button className={"nav-item " + (view === "overview" ? "active" : "")} onClick={() => navigate("overview")}><Activity size={17}/> Overview</button>
   <button className={"nav-item " + (view === "inbox" ? "active" : "")} onClick={() => navigate("inbox")}><Clipboard size={17}/> Report inbox <span className="nav-count">{allReports.length}</span></button>
   <div className="side-section"><span>YOUR TEST RUNS</span><button aria-label="Create test run" onClick={() => navigate("create")}><Plus size={16}/></button></div>
   <div className="run-nav">{runs.filter(run => !run.owner_wallet || !wallet || run.owner_wallet === wallet).slice(0,5).map(run => <button key={run.slug} className={"run-nav-item " + (run.slug === activeSlug && view === "overview" ? "selected" : "")} onClick={() => navigate("overview", run.slug)}><span className="run-dot"/><span>{run.title}</span></button>)}</div>
   <div className="sidebar-bottom"><div className="devnet-tag"><span/> Solana Devnet</div><div className="profile-row"><div className="avatar">T</div><div className="profile-copy"><strong>TestTrail workspace</strong><span>{isConfigured ? "Supabase connected" : "Local demo mode"}</span></div><button title={wallet ? "Disconnect wallet" : "Connect wallet"} onClick={wallet ? disconnectWallet : connectWallet}>{wallet ? <Unplug size={16}/> : <Wallet size={16}/>}</button></div></div>
  </aside>
  {mobileMenu && <button className="scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)}/>}
  <main className="main">
   <header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={19}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{view === "create" ? "New test link" : view === "inbox" ? "Report inbox" : view === "tester" ? "Tester form" : "My projects"}</strong></div><div className="top-actions"><span className={"mode-label " + (!isConfigured ? "demo-label" : "")}><span/> {isConfigured ? "Connected to Supabase" : "Demo data"}</span>{wallet ? <button className="wallet-button" onClick={disconnectWallet}><span className="wallet-live"/> {wallet.slice(0,4)}…{wallet.slice(-4)} <Unplug size={14}/></button> : <button className="connect-button" onClick={connectWallet} disabled={walletBusy}>{walletBusy ? <LoaderCircle size={15} className="spin"/> : <Wallet size={15}/>} Connect wallet</button>}</div></header>
   {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15}/></button></div>}
   {view === "create" ? <section className="page page-narrow enter"><button className="back-link" onClick={() => navigate("overview")}><ArrowDownRight size={15}/> Back to overview</button><div className="page-heading"><div className="eyebrow"><Plus size={13}/> CREATE A TEST LINK</div><h1>Get your app<br/>tested by people.</h1><p>Add your app and tell testers exactly what to try. We will make a shareable link for them.</p></div>{!wallet && <div className="wallet-gate"><Wallet size={22}/><div><strong>First, connect your wallet</strong><p>Your wallet identifies your workspace so you can return to your projects.</p></div><button className="primary-button" type="button" onClick={connectWallet} disabled={walletBusy}>{walletBusy?"Connecting…":"Connect wallet"}</button></div>}<form className="form-panel" onSubmit={createRun}><label>Project name<input value={createTitle} onChange={e=>setCreateTitle(e.target.value)} placeholder="e.g. Solana 2048" required maxLength={80}/></label><label>Application URL<input value={createUrl} onChange={e=>setCreateUrl(e.target.value)} placeholder="https://your-dapp.com" type="url" required/></label><label>What should testers look for? <span className="optional">OPTIONAL</span><textarea value={createDescription} onChange={e=>setCreateDescription(e.target.value)} placeholder="Try wallet connection, complete a transaction, check mobile layout…" rows={4}/></label><div className="form-note"><ShieldCheck size={17}/><span>TestTrail uses Solana Devnet for optional test receipts. It will not move real funds.</span></div><button className="primary-button full-button" type="submit" disabled={!wallet || !isConfigured}>{!isConfigured?"Database setup required":!wallet?"Connect wallet to continue":"Create tester link"} <ArrowUpRight size={16}/></button>{!isConfigured && <p className="form-footnote">Persistent project links need the database connected. Your form will not pretend to save if it cannot.</p>}</form></section>
   : view === "inbox" ? <section className="page enter"><div className="page-heading compact-heading"><div className="eyebrow"><Clipboard size={13}/> TESTER FEEDBACK</div><h1>Report inbox<span className="period">.</span></h1><p>Every report in one place. Find what passed, what broke, and what needs another look.</p></div><div className="inbox-toolbar"><div className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search test runs or reports"/></div><button className="secondary-button" onClick={() => copyLink("/i/"+activeSlug)}><Link2 size={15}/> Copy inbox link</button></div><div className="report-list">{allReports.filter(r => {const run = runs.find(x => (x.id || x.slug) === r.run_id); return (r.summary+" "+r.details+" "+(run?.title||"")).toLowerCase().includes(search.toLowerCase());}).map((r,i) => {const run = runs.find(x => (x.id || x.slug) === r.run_id);return <article className="report-row" key={r.id || i}><div className={"status-icon "+r.status}>{r.status==="passed"?<CheckCircle2 size={17}/>:r.status==="failed"?<XCircle size={17}/>:<CircleHelp size={17}/>}</div><div className="report-main"><div className="report-title">{r.summary}</div><div className="report-meta"><span>{run?.title || "Test run"}</span><span>·</span><span>{shortDate(r.created_at)}</span></div>{r.details && <p>{r.details}</p>}{r.screenshot_url && <a className="attachment-link" href={r.screenshot_url} target="_blank" rel="noreferrer"><ImagePlus size={14}/> View screenshot <ExternalLink size={12}/></a>}{r.receipt_signature && <a className="attachment-link" href={"https://explorer.solana.com/tx/"+r.receipt_signature+"?cluster=devnet"} target="_blank" rel="noreferrer"><FileCheck2 size={14}/> Devnet receipt <ExternalLink size={12}/></a>}</div><span className={"status-pill "+r.status}>{statusLabel[r.status]}</span></article>})}{allReports.length===0 && <div className="empty-state"><Clipboard size={25}/><h3>No reports yet</h3><p>When testers submit feedback, it will appear here.</p></div>}</div></section>
   : view === "tester" ? <section className="page page-narrow enter">{activeRun ? <><button className="back-link" onClick={()=>navigate("overview")}><ArrowDownRight size={15}/> Back to TestTrail</button><div className="page-heading"><div className="eyebrow"><span className="eyebrow-dot"/> YOU'RE A TESTER</div><h1>Let's try {activeRun.title}<span className="period">.</span></h1><p>Follow the steps below, try the app, and tell the developer what happened. No wallet needed.</p></div><div className="form-panel tester-steps"><div className="step-line"><span>1</span><div><strong>Open the app</strong><p>Keep this page open so you can come back to send your feedback.</p><a className="open-app-link" href={activeRun.app_url} target="_blank" rel="noreferrer">Open {activeRun.title} <ExternalLink size={14}/></a></div></div><div className="step-line"><span>2</span><div><strong>Try these things</strong><p>{activeRun.description || "Try the main features. Notice anything confusing, broken, or surprisingly good."}</p></div></div><div className="step-line"><span>3</span><div><strong>Tell us how it went</strong><p>Choose a result, describe what happened, and attach a screenshot if it helps.</p></div></div></div><form className="report-form tester-public-form" onSubmit={submitReport}><div className="form-title">Your feedback <span>NO WALLET NEEDED</span></div><label>How did it go?</label><div className="status-select">{(["passed","failed","blocked"] as Status[]).map(s=><button type="button" key={s} onClick={()=>setReportStatus(s)} className={"status-option "+(reportStatus===s?"chosen "+s:"")}><span className={"status-option-icon "+s}>{s==="passed"?<CheckCircle2 size={16}/>:s==="failed"?<XCircle size={16}/>:<CircleHelp size={16}/>}</span>{statusLabel[s]}</button>)}</div><label>What happened?<input value={reportSummary} onChange={e=>setReportSummary(e.target.value)} placeholder="e.g. The connect button did not work" required maxLength={180}/></label><label>More details <span className="optional">OPTIONAL</span><textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} rows={3} placeholder="What did you click? What did you expect? What happened instead?"/></label><label className="upload-zone"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setScreenshot(e.target.files?.[0]||null)}/><ImagePlus size={18}/><span><strong>{screenshot?screenshot.name:"Add a screenshot"}</strong><small>PNG, JPG or WebP, up to 5 MB</small></span><Plus size={17}/></label><button className="primary-button full-button" type="submit" disabled={submitting}>{submitting?"Sending feedback…":"Send feedback"} <ArrowUpRight size={16}/></button></form></> : <div className="empty-state"><h3>We couldn't find this test</h3><p>Check that the link is correct, or ask the developer to send you a new one.</p></div>}</section>
   : <section className="page enter">
    <div className="hero-row"><div className="page-heading"><div className="eyebrow"><span className="eyebrow-dot"/> SOLANA DAPP TESTING</div><h1>Ship with<br/>fewer surprises<span className="period">.</span></h1><p>A clear picture of what works, what breaks, and what real people experience in your dApp.</p><div className="hero-buttons"><button className="primary-button" onClick={() => navigate("create")}>Create a test run <ArrowUpRight size={16}/></button><button className="text-button" onClick={() => navigate("inbox")}>View all reports <ArrowUpRight size={15}/></button></div></div><div className="hero-art" aria-label="Illustration of a verified test report"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-cross cross-a"/><div className="art-cross cross-b"/><div className="art-sheet"><div className="art-sheet-top"><span className="mini-mark"><FlaskConical size={13}/></span><span>TEST REPORT</span><span className="art-check"><Check size={13}/></span></div><div className="art-lines"><i/><i/><i/></div><div className="art-result"><CheckCircle2 size={19}/><div><strong>Everything checks out</strong><span>Verified on Devnet</span></div></div><div className="art-footer"><span>TESTTRAIL / 001</span><span>CONFIRMED</span></div></div><div className="art-stamp"><ShieldCheck size={20}/><span>VERIFIED<br/>RECEIPT</span></div><div className="art-caption">A better trail from test to fix.</div></div></div>
    <div className="stats-grid"><div className="stat-card"><div className="stat-label">TEST RUNS <FlaskConical size={15}/></div><div className="stat-number">{runs.length.toString().padStart(2,"0")}</div><div className="stat-foot">Projects being tested</div></div><div className="stat-card"><div className="stat-label">PASSED <CheckCircle2 size={15}/></div><div className="stat-number">{passed.toString().padStart(2,"0")}<span className="stat-trend positive"><ArrowUpRight size={13}/></span></div><div className="stat-foot">Checks that worked</div></div><div className="stat-card"><div className="stat-label">NEEDS ATTENTION <Activity size={15}/></div><div className="stat-number">{(failed+blocked).toString().padStart(2,"0")}<span className="stat-trend caution"><ArrowDownRight size={13}/></span></div><div className="stat-foot">Failed or blocked checks</div></div></div>
    <div className="section-head"><div><div className="eyebrow">YOUR WORKSPACE</div><h2>Test runs <span className="subtle-count">{runs.length}</span></h2></div><div className="section-actions"><div className="search-box small-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a project"/></div><button className="icon-button" title="Create test run" onClick={() => navigate("create")}><Plus size={17}/></button></div></div>
    <div className="run-grid">{filteredRuns.map((run,i) => {const count=reports.filter(r=>r.run_id===(run.id||run.slug)).length;const failedCount=reports.filter(r=>r.run_id===(run.id||run.slug)&&r.status!=="passed").length;return <article className="run-card" key={run.slug} style={{animationDelay:(i*65)+"ms"}}><div className="run-card-top"><div className={"project-icon project-"+(i%3)}>{i===0?<Activity size={19}/>:i===1?<Wallet size={19}/>:<Globe2 size={19}/>}</div><span className="run-network"><span/> DEVNET</span><button className="more-button" title="Copy test link" onClick={()=>copyLink("/test/"+run.slug)}><Link2 size={16}/></button></div><h3>{run.title}</h3><a className="project-url" href={run.app_url} target="_blank" rel="noreferrer">{run.app_url.replace(/^https?:\/\//,"").replace(/\/$/,"")} <ExternalLink size={12}/></a><p className="run-description">{run.description || "No testing notes added yet."}</p><div className="run-card-bottom"><div className="report-count"><Clipboard size={14}/><strong>{count}</strong> {count===1?"report":"reports"}</div><span className={failedCount?"needs-fix":"all-clear"}>{failedCount?failedCount+" to review":"Looking good"}</span></div><div className="run-card-actions"><button onClick={()=>{setActiveSlug(run.slug);navigate("overview",run.slug);document.getElementById("tester-form")?.scrollIntoView({behavior:"smooth",block:"center"});}} className="card-action">Open test <ArrowUpRight size={14}/></button><button onClick={()=>{setActiveSlug(run.slug);copyLink("/test/"+run.slug);}} className="card-action secondary-action">Copy tester link <Link2 size={14}/></button></div></article>})}{filteredRuns.length===0 && <div className="empty-state"><Search size={24}/><h3>No matching test runs</h3><p>Try another search or create a new test run.</p></div>}<button className="new-run-card" onClick={()=>navigate("create")}><span className="new-run-icon"><Plus size={20}/></span><strong>Start a new test run</strong><span>Share a link and get useful feedback.</span></button></div>
    {activeRun && <div className="tester-section" id="tester-form"><div className="tester-intro"><div className="eyebrow"><Sparkles size={13}/> TESTER WORKSPACE</div><h2>Try it. Tell us what happened.</h2><p>Selected project: <strong>{activeRun.title}</strong>. Open the dApp, follow the testing notes, and share your result.</p><a className="open-app-link" href={activeRun.app_url} target="_blank" rel="noreferrer">Open {activeRun.title} <ExternalLink size={14}/></a></div><form className="report-form" onSubmit={submitReport}><div className="form-title">Submit a test report <span>DEVNET</span></div><label>Test result</label><div className="status-select">{(["passed","failed","blocked"] as Status[]).map(s=><button type="button" key={s} onClick={()=>setReportStatus(s)} className={"status-option "+(reportStatus===s?"chosen "+s:"")}><span className={"status-option-icon "+s}>{s==="passed"?<CheckCircle2 size={16}/>:s==="failed"?<XCircle size={16}/>:<CircleHelp size={16}/>}</span>{statusLabel[s]}</button>)}</div><label>What happened?<input value={reportSummary} onChange={e=>setReportSummary(e.target.value)} placeholder="e.g. Wallet connected successfully" required maxLength={180}/></label><label>Details <span className="optional">OPTIONAL</span><textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} rows={3} placeholder="Steps you took, what you expected, and what actually happened."/></label><label className="upload-zone"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setScreenshot(e.target.files?.[0]||null)}/><ImagePlus size={18}/><span><strong>{screenshot ? screenshot.name : "Attach a screenshot"}</strong><small>{screenshot ? "Click to choose another file" : "PNG, JPG or WebP. Stored with Supabase when configured."}</small></span><Plus size={17}/></label><label className="receipt-toggle"><input type="checkbox" checked={receipt} onChange={e=>setReceipt(e.target.checked)}/><span className="toggle-copy"><strong>Publish a Devnet receipt</strong><small>Ask your connected wallet to sign a memo transaction. Network fees may apply.</small></span><span className="optional">OPTIONAL</span></label><button className="primary-button full-button" disabled={submitting}>{submitting?<><LoaderCircle size={16} className="spin"/> Submitting report…</>:<>Submit report <ArrowUpRight size={16}/></>}</button><p className="privacy-note"><ShieldCheck size={14}/> No private keys are collected. Your wallet only signs when you approve the request.</p></form></div>}
    <footer className="footer"><span>TESTTRAIL © 2026</span><span>Made for better dApps, one test at a time.</span><button onClick={()=>setNotice("TestTrail collects the report details you submit. Wallet signatures are only requested when you opt in and approve the transaction.")}><CircleHelp size={14}/> How it works</button></footer>
   </section>}
  </main>
 </div>;
}
