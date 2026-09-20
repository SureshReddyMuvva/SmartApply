import { useEffect, useState, useMemo, memo, useCallback, useRef } from "react";
import { jsPDF } from "jspdf";

// ─── useLocalStorage ────────────────────────────────────────────────────────────
function useLocalStorage(key, init) {
  const [val, setVal] = useState(() => { try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) : init; } catch { return init; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) { console.warn(`localStorage write failed: ${key}`, e); } }, [key, val]);
  return [val, setVal];
}

// ─── Fonts ─────────────────────────────────────────────────────────────────────
const _fl = document.createElement("link");
_fl.rel = "stylesheet";
_fl.href = "https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap";
document.head.appendChild(_fl);

// ─── Constants ──────────────────────────────────────────────────────────────────
const API = import.meta.env?.VITE_API_URL || "http://localhost:5000";

const COUNTRIES = ["United States","Remote - United States","New York, NY","San Francisco, CA","Seattle, WA","Austin, TX","Chicago, IL","Boston, MA","Los Angeles, CA","Denver, CO","Atlanta, GA","Dallas, TX","Washington, DC","Miami, FL","San Jose, CA","Portland, OR","Nashville, TN","Phoenix, AZ"];
const JOB_KEYWORDS = ["Software Engineer","Backend Engineer","Frontend Engineer","Full Stack Developer","Python Developer","Java Developer","Data Engineer","Data Analyst","DevOps Engineer","Cloud Engineer","Machine Learning Engineer","AI Engineer","Solutions Architect","QA Engineer","Network Engineer","Cybersecurity Analyst","Business Analyst","Salesforce Developer","Database Administrator","Systems Engineer","Mobile Developer","Site Reliability Engineer","Data Scientist"];
const ROLE_SUBROLES = {
  "Software Engineer": [
    "Software Engineer","Backend Engineer","Full Stack Developer",
    "Python Developer","Java Developer","Node.js Developer",
    "Go Developer","Ruby Developer","C++ Developer","Scala Developer",
    "API Engineer","Application Developer","Web Developer",
    "Systems Engineer","Platform Engineer","Integration Engineer",
  ],
  "Frontend Engineer": [
    "Frontend Engineer","React Developer","Angular Developer",
    "Vue Developer","UI Engineer","Web Developer","JavaScript Developer",
    "TypeScript Developer","Next.js Developer","UI/UX Engineer",
  ],
  "Data Engineer": [
    "Data Engineer","ETL Developer","Pipeline Engineer",
    "Analytics Engineer","Big Data Engineer","Spark Developer",
    "Airflow Engineer","Data Platform Engineer","Data Infrastructure Engineer",
    "dbt Engineer","Kafka Engineer","Data Architect",
  ],
  "Data Analyst": [
    "Data Analyst","Business Intelligence Analyst","BI Developer",
    "Reporting Analyst","Analytics Analyst","SQL Analyst",
    "Tableau Developer","Power BI Developer","Insights Analyst",
  ],
  "DevOps Engineer": [
    "DevOps Engineer","Cloud Engineer","Infrastructure Engineer",
    "SRE","Site Reliability Engineer","Platform Engineer",
    "Build Engineer","Release Engineer","CI/CD Engineer",
    "Kubernetes Engineer","Docker Engineer","Terraform Engineer",
  ],
  "Cloud Engineer": [
    "Cloud Engineer","AWS Engineer","Azure Engineer","GCP Engineer",
    "Cloud Architect","Cloud Infrastructure Engineer","Cloud DevOps Engineer",
    "Solutions Architect","Cloud Platform Engineer",
  ],
  "Machine Learning Engineer": [
    "Machine Learning Engineer","ML Engineer","AI Engineer",
    "Deep Learning Engineer","NLP Engineer","Computer Vision Engineer",
    "MLOps Engineer","AI/ML Engineer","Research Engineer",
  ],
  "AI Engineer": [
    "AI Engineer","LLM Engineer","Prompt Engineer","AI Research Engineer",
    "Generative AI Engineer","AI Platform Engineer","AI Product Engineer",
  ],
  "Data Scientist": [
    "Data Scientist","Applied Scientist","Research Scientist",
    "Quantitative Analyst","Statistical Analyst","ML Scientist",
    "AI Scientist","Computational Scientist",
  ],
  "Database Administrator": [
    "Database Administrator","DBA","SQL Server DBA","Oracle DBA",
    "PostgreSQL DBA","MySQL DBA","NoSQL Engineer","Database Engineer",
    "Data Platform Administrator","Database Reliability Engineer",
  ],
  "QA Engineer": [
    "QA Engineer","Quality Assurance Engineer","Test Engineer",
    "SDET","Automation Engineer","QA Automation Engineer",
    "Performance Test Engineer","Manual Tester","Quality Engineer",
  ],
  "Cybersecurity Analyst": [
    "Cybersecurity Analyst","Security Engineer","SOC Analyst",
    "Penetration Tester","Security Operations Engineer","InfoSec Engineer",
    "Application Security Engineer","Cloud Security Engineer",
    "Security Architect","Threat Intelligence Analyst",
  ],
  "Network Engineer": [
    "Network Engineer","Network Administrator","Network Architect",
    "Network Operations Engineer","NOC Engineer","Cisco Engineer",
    "Infrastructure Network Engineer","Wireless Network Engineer",
  ],
  "Business Analyst": [
    "Business Analyst","Product Analyst","Systems Analyst",
    "Requirements Analyst","Functional Analyst","IT Business Analyst",
    "Technical Business Analyst","Process Analyst",
  ],
  "Salesforce Developer": [
    "Salesforce Developer","Salesforce Engineer","Salesforce Admin",
    "Salesforce Architect","Salesforce Consultant","CRM Developer",
    "ServiceNow Developer","Workday Developer",
  ],
  "Systems Engineer": [
    "Systems Engineer","Systems Administrator","IT Systems Engineer",
    "Linux Engineer","Windows Systems Engineer","Infrastructure Engineer",
    "IT Operations Engineer","Systems Reliability Engineer",
  ],
  "Mobile Developer": [
    "Mobile Developer","iOS Developer","Android Developer",
    "React Native Developer","Flutter Developer","Swift Developer",
    "Kotlin Developer","Mobile Engineer","App Developer",
  ],
  "Site Reliability Engineer": [
    "Site Reliability Engineer","SRE","Platform Engineer",
    "Production Engineer","Infrastructure Reliability Engineer",
    "DevOps SRE","Cloud Reliability Engineer",
  ],
  "Solutions Architect": [
    "Solutions Architect","Cloud Architect","Enterprise Architect",
    "Technical Architect","Data Architect","Software Architect",
    "Integration Architect","Security Architect",
  ],
  "Java Developer": [
    "Java Developer","Java Engineer","Spring Developer",
    "Java Backend Developer","J2EE Developer","Java Full Stack Developer",
  ],
  "Python Developer": [
    "Python Developer","Python Engineer","Django Developer",
    "Flask Developer","Python Backend Developer","Python Full Stack Developer",
  ],
  "Full Stack Developer": [
    "Full Stack Developer","Full Stack Engineer","MEAN Stack Developer",
    "MERN Stack Developer","Web Application Developer",
    "Full Stack JavaScript Developer","Full Stack Python Developer",
  ],
};
const DEGREE_OPTIONS = ["High School Diploma","Associate's Degree","Bachelor's Degree","Master's Degree","PhD / Doctorate","Professional Degree (JD/MD/MBA)","Certificate","Bootcamp / Nanodegree","Other"];
const PIPELINE_STAGES = ["Applied","Phone Screen","Interview","Offer","Rejected"];
const STAGE_META = { Applied:{color:"#0891b2",bg:"#ecfeff",border:"#a5f3fc",emoji:"📤"}, "Phone Screen":{color:"#d97706",bg:"#fffbeb",border:"#fde68a",emoji:"📞"}, Interview:{color:"#7c3aed",bg:"#f5f3ff",border:"#ddd6fe",emoji:"🎯"}, Offer:{color:"#059669",bg:"#ecfdf5",border:"#6ee7b7",emoji:"🎉"}, Rejected:{color:"#dc2626",bg:"#fef2f2",border:"#fecaca",emoji:"✗"} };

// ─── Theme ──────────────────────────────────────────────────────────────────────
const T = {
  pageBg:   "#F7F7FF",
  sidebar:  "#FFFFFF",
  card:     "#FFFFFF",
  cardAlt:  "#F4F4FD",
  border:   "#E8E8F0",
  border2:  "#D4D4E8",
  primary:  "#4F46E5",
  primaryL: "#EEF2FF",
  violet:   "#7C3AED",
  grad:     "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
  gold:     "#F59E0B",
  goldL:    "#FFF8E7",
  green:    "#059669",
  greenL:   "#ECFDF5",
  red:      "#EF4444",
  redL:     "#FEF2F2",
  text:     "#1E1B4B",
  muted:    "#6B7280",
  muted2:   "#9CA3AF",
};

// ─── Global CSS ─────────────────────────────────────────────────────────────────
const GCSS = `
  @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.45} }
  @keyframes shimmer  { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes marquee  { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes gradShift{ 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }

  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;font-family:'Plus Jakarta Sans',system-ui,sans-serif;overflow-x:hidden}
  body{background:${T.pageBg};color:${T.text}}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${T.border2};border-radius:99px}
  select,input,textarea,button{font-family:'Plus Jakarta Sans',system-ui,sans-serif}

  .jcard{background:${T.card};border:1px solid ${T.border};border-radius:16px;
    transition:transform .2s,box-shadow .2s;overflow:hidden}
  .jcard:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(79,70,229,.1)}

  .nbtn{width:100%;padding:9px 14px;border-radius:10px;border:none;background:transparent;
    color:${T.muted};font-weight:600;cursor:pointer;text-align:left;font-size:13.5px;
    display:flex;align-items:center;justify-content:space-between;
    transition:all .18s;font-family:'Plus Jakarta Sans',sans-serif;position:relative;overflow:hidden}
  .nbtn:hover{background:#F7F7FF;color:${T.text}}
  .nbtn.active{background:${T.primaryL};color:${T.primary};font-weight:700}
  .nbtn.active::before{content:'';position:absolute;left:0;top:15%;bottom:15%;width:3px;border-radius:0 3px 3px 0;background:${T.grad}}

  .pbtn{padding:11px 20px;border:none;border-radius:10px;cursor:pointer;
    background:${T.grad};color:#fff;font-weight:700;font-size:14px;
    box-shadow:0 4px 14px rgba(79,70,229,.3);transition:all .18s;
    font-family:'Plus Jakarta Sans',sans-serif}
  .pbtn:hover:not(:disabled){opacity:.92;box-shadow:0 6px 20px rgba(79,70,229,.4);transform:translateY(-1px)}
  .pbtn:disabled{opacity:.5;cursor:not-allowed}

  .gbtn{padding:9px 16px;border:1.5px solid ${T.border};border-radius:10px;
    background:${T.card};color:${T.muted};font-weight:600;cursor:pointer;
    font-size:13px;transition:all .18s;font-family:'Plus Jakarta Sans',sans-serif}
  .gbtn:hover{border-color:${T.primary};color:${T.primary};background:${T.primaryL}}

  .finput{width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid ${T.border};
    background:${T.card};color:${T.text};font-weight:500;font-size:14px;
    outline:none;transition:border-color .18s,box-shadow .18s;font-family:'Plus Jakarta Sans',sans-serif}
  .finput:focus{border-color:${T.primary};box-shadow:0 0 0 3px rgba(79,70,229,.1)}

  .panel{background:${T.card};border:1px solid ${T.border};border-radius:18px;
    padding:24px;margin-bottom:16px;box-shadow:0 2px 8px rgba(79,70,229,.04)}

  .chip{padding:4px 11px;border-radius:999px;font-size:12px;font-weight:600;
    background:${T.cardAlt};color:${T.muted};border:1px solid ${T.border};white-space:nowrap}
  .chip.ok{background:${T.greenL};color:#065f46;border-color:#6ee7b7}
  .chip.gap{background:${T.goldL};color:#78350f;border-color:#fde68a}
  .chip.vi{background:${T.primaryL};color:${T.primary};border-color:#c7d2fe}

  .ecard{background:${T.cardAlt};border:1px solid ${T.border};border-radius:14px;padding:18px;margin-bottom:14px}
  label.fl{display:grid;gap:6px;font-size:13px;font-weight:600;color:${T.muted}}

  .skeleton{background:linear-gradient(90deg,#E8E8F0 25%,#F4F4FD 50%,#E8E8F0 75%);
    background-size:400px 100%;animation:shimmer 1.4s infinite;border-radius:10px}

  .hero-grad{background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 50%,#A855F7 100%);
    background-size:200% 200%;animation:gradShift 6s ease infinite}

  .land-section{padding:96px 0}
  .land-container{max-width:1160px;margin:0 auto;padding:0 28px}
`;

// ─── Small reusable components ──────────────────────────────────────────────────
function CircularGauge({ score = 0, size = 92 }) {
  const r = 36, c = 2 * Math.PI * r, p = Math.min(Math.max(score, 0), 100);
  const off = c - (p / 100) * c;
  const col = p >= 80 ? T.green : p >= 50 ? T.gold : T.primary;
  const track = p >= 80 ? "#d1fae5" : p >= 50 ? "#fef3c7" : "#ede9fe";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display:"block", flexShrink:0 }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth="9"/>
      <circle cx="50" cy="50" r={r} fill="none" stroke={col} strokeWidth="9"
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform="rotate(-90 50 50)" style={{ transition:"stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)" }}/>
      <text x="50" y="46" textAnchor="middle" style={{ fontSize:"16px", fontWeight:"900", fill:col, fontFamily:"'JetBrains Mono',monospace" }}>{score}%</text>
      <text x="50" y="61" textAnchor="middle" style={{ fontSize:"8.5px", fontWeight:"700", fill:T.muted2, fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:".05em" }}>MATCH</text>
    </svg>
  );
}

function ToastContainer({ toasts }) {
  const M = { success:{bg:T.greenL,bd:"#6ee7b7",col:T.green,ic:"✓"}, error:{bg:T.redL,bd:"#fca5a5",col:T.red,ic:"✕"}, warning:{bg:T.goldL,bd:"#fde68a",col:"#b45309",ic:"⚠"}, info:{bg:T.primaryL,bd:"#c7d2fe",col:T.primary,ic:"ℹ"} };
  return (
    <div style={{ position:"fixed", bottom:22, right:22, zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none" }}>
      {toasts.map(t => { const m = M[t.type] || M.info; return (
        <div key={t.id} style={{ padding:"12px 18px", borderRadius:12, background:m.bg, border:`1px solid ${m.bd}`, boxShadow:"0 8px 24px rgba(0,0,0,.12)", display:"flex", alignItems:"center", gap:10, minWidth:260, animation:"fadeUp .28s ease", pointerEvents:"auto" }}>
          <span style={{ width:22, height:22, borderRadius:"50%", background:"#fff", color:m.col, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:11, flexShrink:0 }}>{m.ic}</span>
          <span style={{ color:T.text, fontWeight:600, fontSize:14 }}>{t.message}</span>
        </div>
      ); })}
    </div>
  );
}

function SuggestBox({ value, onChange, suggestions, onSelect, placeholder }) {
  return (
    <div style={{ position:"relative" }}>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="finput"/>
      {suggestions.length > 0 && (
        <div style={{ position:"absolute", top:46, left:0, right:0, background:T.card, border:`1px solid ${T.border}`, borderRadius:12, boxShadow:"0 12px 32px rgba(79,70,229,.1)", zIndex:50, overflow:"hidden" }}>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => onSelect(s)} style={{ padding:"11px 14px", cursor:"pointer", color:T.muted, fontWeight:600, fontSize:13, borderBottom:i<suggestions.length-1?`1px solid ${T.border}`:"none", transition:"all .12s" }}
              onMouseEnter={e=>{e.currentTarget.style.background=T.primaryL;e.currentTarget.style.color=T.primary;}}
              onMouseLeave={e=>{e.currentTarget.style.background="";e.currentTarget.style.color=T.muted;}}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ATSBar({ score }) {
  const col = score >= 80 ? T.green : score >= 60 ? T.gold : T.red;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, fontWeight:700, marginBottom:6 }}>
        <span style={{ color:T.muted }}>ATS Score</span>
        <span style={{ color:col, fontFamily:"'JetBrains Mono',monospace" }}>{score}%</span>
      </div>
      <div style={{ height:6, borderRadius:999, background:T.border }}>
        <div style={{ height:"100%", borderRadius:999, width:`${score}%`, background:col, transition:"width 1.2s cubic-bezier(.4,0,.2,1)" }}/>
      </div>
    </div>
  );
}

function JobSkeleton() {
  return (
    <div className="jcard" style={{ padding:22, borderLeft:`4px solid ${T.border}` }}>
      <div style={{ display:"grid", gridTemplateColumns:"52px 1fr 80px", gap:16 }}>
        <div className="skeleton" style={{ width:46, height:46, borderRadius:12 }}/>
        <div>
          <div className="skeleton" style={{ height:11, width:"28%", marginBottom:10 }}/>
          <div className="skeleton" style={{ height:19, width:"68%", marginBottom:8 }}/>
          <div className="skeleton" style={{ height:14, width:"38%", marginBottom:14 }}/>
          <div style={{ display:"flex", gap:8 }}>
            {[80,65,90,55].map((w,i) => <div key={i} className="skeleton" style={{ height:26, width:w, borderRadius:999 }}/>)}
          </div>
        </div>
        <div className="skeleton" style={{ width:80, height:80, borderRadius:"50%", margin:"0 auto" }}/>
      </div>
    </div>
  );
}

// ─── SL label ──────────────────────────────────────────────────────────────────
function SL({ children }) {
  return <p style={{ fontSize:11, fontWeight:800, color:T.muted2, letterSpacing:".08em", textTransform:"uppercase", margin:"0 0 10px" }}>{children}</p>;
}

// ════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ════════════════════════════════════════════════════════════════════
function LandingPage({ onGetStarted, cachedCount }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const companies = ["Stripe","Anthropic","Discord","Figma","OpenAI","Datadog","Coinbase","Cloudflare","Notion","Linear","Reddit","Lyft","Vercel","GitLab","Canva","Miro","HubSpot","Dropbox","MongoDB","Elastic","Twilio","Asana","Loom","Retool","Benchling","Databricks","Confluent","Okta","Snyk","Samsara"];

  const features = [
    { icon:"🎯", title:"Smart Job Matching", desc:"AI analyzes your resume and scores every job for fit. See exactly how well you match before applying." },
    { icon:"✨", title:"AI Resume Tailoring", desc:"One click to tailor your resume for any specific job. Get the keywords that matter most." },
    { icon:"📝", title:"Cover Letter Generator", desc:"Generate a personalized, human-sounding cover letter in seconds. Powered by Llama 3.1." },
    { icon:"🎤", title:"Interview Prep", desc:"Get 10 tailored interview questions with expert answer tips for any job you're applying to." },
    { icon:"📊", title:"Application Tracker", desc:"Kanban-style pipeline to track every application from applied to offer. Never lose track." },
    { icon:"📈", title:"ATS Score Analysis", desc:"Know exactly how your resume scores and get plain-English advice to improve it instantly." },
  ];

  const steps = [
    { n:"01", title:"Upload Your Resume", desc:"Drop your PDF or DOCX. We extract your skills and build your profile automatically in seconds." },
    { n:"02", title:"Browse Matched Jobs", desc:"See hundreds of live jobs from 100+ top companies, each scored by how well they match your background." },
    { n:"03", title:"Apply With Confidence", desc:"Use AI tools to tailor your resume, write your cover letter, and prep for interviews — all in one place." },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#FEFEFF" }}>
      <style>{GCSS}</style>

      {/* Navbar */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background:scrolled?"rgba(255,255,255,.95)":"transparent", backdropFilter:scrolled?"blur(12px)":"none", borderBottom:scrolled?`1px solid ${T.border}`:"none", transition:"all .3s" }}>
        <div className="land-container" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:68 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:T.grad, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:15, fontFamily:"'Syne',sans-serif", boxShadow:"0 4px 12px rgba(79,70,229,.3)" }}>S</div>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:T.text }}>SmartApply</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {["Features","How it Works","Pricing"].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g,"-")}`} style={{ padding:"8px 14px", borderRadius:8, color:T.muted, fontWeight:600, fontSize:14, textDecoration:"none", transition:"color .15s" }}
                onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>
                {l}
              </a>
            ))}
            <button onClick={onGetStarted} className="pbtn" style={{ padding:"9px 20px", fontSize:14 }}>Get Started Free →</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ paddingTop:140, paddingBottom:80, textAlign:"center", background:"radial-gradient(ellipse 80% 50% at 50% -10%, #EEF2FF 0%, #FEFEFF 70%)" }}>
        <div className="land-container">
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:T.primaryL, border:`1px solid #c7d2fe`, borderRadius:999, padding:"6px 16px", fontSize:13, fontWeight:700, color:T.primary, marginBottom:28, animation:"fadeUp .6s ease" }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:T.primary, display:"inline-block" }}/>
            {cachedCount > 0 ? `${cachedCount.toLocaleString()} live jobs right now` : "Powered by AI · 100% Free"}
          </div>

          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(40px,6vw,72px)", fontWeight:900, lineHeight:1.08, color:T.text, marginBottom:22, animation:"fadeUp .7s ease .1s both" }}>
            The Smartest Job Search<br/>
            <span style={{ background:T.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Platform. Built For You.</span>
          </h1>

          <p style={{ fontSize:"clamp(16px,2vw,20px)", color:T.muted, maxWidth:580, margin:"0 auto 40px", lineHeight:1.65, fontWeight:500, animation:"fadeUp .7s ease .2s both" }}>
            Find AI-matched jobs from 100+ top companies, generate cover letters, prep for interviews, and track every application — all completely free.
          </p>

          <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", animation:"fadeUp .7s ease .3s both" }}>
            <button onClick={onGetStarted} className="pbtn" style={{ fontSize:16, padding:"14px 32px", borderRadius:12 }}>
              Start For Free — No Sign Up →
            </button>
            <a href="#how-it-works" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"14px 24px", borderRadius:12, border:`1.5px solid ${T.border}`, color:T.text, fontWeight:700, fontSize:15, textDecoration:"none", background:T.card, transition:"all .18s" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.text;}}>
              ▶ See How It Works
            </a>
          </div>

          {/* Stats */}
          <div style={{ display:"flex", justifyContent:"center", gap:0, marginTop:60, flexWrap:"wrap", animation:"fadeUp .7s ease .4s both" }}>
            {[
              { val:"100+", label:"Top Companies" },
              { val:"Free", label:"Always" },
              { val:"AI", label:"Powered by Llama 3" },
              { val:"Live", label:"Real-time Jobs" },
            ].map(({ val, label }, i) => (
              <div key={i} style={{ padding:"16px 32px", textAlign:"center", borderRight:i<3?`1px solid ${T.border}`:"none" }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:900, color:T.primary }}>{val}</div>
                <div style={{ color:T.muted, fontSize:13, fontWeight:600, marginTop:3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Companies marquee */}
      <div style={{ padding:"28px 0", background:T.card, borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, overflow:"hidden" }}>
        <div style={{ display:"flex", gap:32, animation:"marquee 28s linear infinite", width:"max-content" }}>
          {[...companies, ...companies].map((c, i) => (
            <span key={i} style={{ fontSize:14, fontWeight:700, color:T.muted2, whiteSpace:"nowrap", padding:"0 4px" }}>{c}</span>
          ))}
        </div>
      </div>

      {/* Features */}
      <section id="features" className="land-section">
        <div className="land-container">
          <div style={{ textAlign:"center", marginBottom:56 }}>
            <p style={{ color:T.primary, fontWeight:700, fontSize:13, letterSpacing:".1em", textTransform:"uppercase", marginBottom:12 }}>Everything You Need</p>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:900, color:T.text, marginBottom:14 }}>Your complete career toolkit</h2>
            <p style={{ color:T.muted, fontSize:17, maxWidth:520, margin:"0 auto" }}>Everything competitive job seekers need, in one place — and it's completely free.</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:20 }}>
            {features.map((f, i) => (
              <div key={i} style={{ padding:28, borderRadius:18, background:T.card, border:`1px solid ${T.border}`, transition:"all .2s", cursor:"default" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${T.primary}60`;e.currentTarget.style.boxShadow=`0 8px 28px rgba(79,70,229,.1)`;e.currentTarget.style.transform="translateY(-3px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>
                <div style={{ width:48, height:48, borderRadius:14, background:T.primaryL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:16 }}>{f.icon}</div>
                <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, color:T.text, marginBottom:8 }}>{f.title}</h3>
                <p style={{ color:T.muted, lineHeight:1.65, fontSize:14 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="land-section" style={{ background:"radial-gradient(ellipse 80% 60% at 50% 50%, #EEF2FF 0%, #F7F7FF 80%)" }}>
        <div className="land-container">
          <div style={{ textAlign:"center", marginBottom:56 }}>
            <p style={{ color:T.primary, fontWeight:700, fontSize:13, letterSpacing:".1em", textTransform:"uppercase", marginBottom:12 }}>Simple Process</p>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:900, color:T.text }}>Get hired in 3 steps</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:28, position:"relative" }}>
            {steps.map((s, i) => (
              <div key={i} style={{ textAlign:"center", padding:"36px 28px" }}>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:52, fontWeight:700, color:`${T.primary}18`, marginBottom:16, lineHeight:1 }}>{s.n}</div>
                <div style={{ width:52, height:52, borderRadius:16, background:T.grad, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px", color:"#fff", fontSize:22, fontWeight:900, fontFamily:"'Syne',sans-serif", boxShadow:"0 6px 20px rgba(79,70,229,.28)" }}>{i+1}</div>
                <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:T.text, marginBottom:10 }}>{s.title}</h3>
                <p style={{ color:T.muted, lineHeight:1.65, fontSize:14 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features */}
      <section className="land-section">
        <div className="land-container">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:64, alignItems:"center" }}>
            <div>
              <p style={{ color:T.primary, fontWeight:700, fontSize:13, letterSpacing:".1em", textTransform:"uppercase", marginBottom:14 }}>AI-Powered</p>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,3.5vw,42px)", fontWeight:900, color:T.text, marginBottom:18, lineHeight:1.1 }}>Your personal<br/>AI career assistant</h2>
              <p style={{ color:T.muted, fontSize:16, lineHeight:1.7, marginBottom:28 }}>Powered by Llama 3.1 via Groq — our AI features are instant, free, and genuinely useful. No fluff, no paywalls.</p>
              {[
                { icon:"📝", title:"Cover Letter Generator", desc:"Personalized letters that sound human, not robotic." },
                { icon:"🎤", title:"Interview Prep", desc:"10 tailored questions with expert answer guidance." },
                { icon:"📊", title:"Resume Score Explainer", desc:"Plain English breakdown of your ATS score." },
                { icon:"🎯", title:"Job Fit Analysis", desc:"Honest assessment of fit with specific advice." },
              ].map((item, i) => (
                <div key={i} style={{ display:"flex", gap:14, marginBottom:18 }}>
                  <div style={{ width:40, height:40, borderRadius:11, background:T.primaryL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontWeight:700, color:T.text, fontSize:15 }}>{item.title}</div>
                    <div style={{ color:T.muted, fontSize:13 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
              <button onClick={onGetStarted} className="pbtn" style={{ marginTop:8 }}>Try AI Features Free →</button>
            </div>
            <div style={{ background:T.primaryL, borderRadius:24, padding:28, border:`1px solid ${T.primary}30` }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:T.primary, marginBottom:16, opacity:.7 }}>// AI Cover Letter Preview</div>
              {["Opening with specific connection to role...", "Highlighting 3 matching skills from resume...", "Addressing key requirements from job description...", "Closing with confident call to action..."].map((line, i) => (
                <div key={i} style={{ padding:"10px 14px", background:T.card, borderRadius:10, marginBottom:8, fontSize:13, color:T.muted, display:"flex", alignItems:"center", gap:10, border:`1px solid ${T.border}` }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:T.green, flexShrink:0 }}/>
                  {line}
                </div>
              ))}
              <div style={{ marginTop:16, padding:14, background:T.grad, borderRadius:12, color:"#fff", fontSize:13, fontWeight:600, textAlign:"center" }}>✨ Generated in 1.2 seconds — Free with SmartApply</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
<section id="pricing" className="land-section" style={{ background:"radial-gradient(ellipse 80% 60% at 50% 0%, #EEF2FF 0%, #F7F7FF 70%)" }}>
  <div className="land-container">
    <div style={{ textAlign:"center", marginBottom:56 }}>
      <p style={{ color:T.primary, fontWeight:700, fontSize:13, letterSpacing:".1em", textTransform:"uppercase", marginBottom:12 }}>Simple Pricing</p>
      <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:900, color:T.text, marginBottom:14 }}>Plans for every job seeker</h2>
      <p style={{ color:T.muted, fontSize:17, maxWidth:460, margin:"0 auto" }}>Start free. Upgrade when you are ready. Cancel anytime.</p>
    </div>

    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:20, maxWidth:980, margin:"0 auto" }}>

      {/* Free Plan */}
      <div style={{ padding:32, borderRadius:22, background:T.card, border:`1.5px solid ${T.border}` }}>
        <div style={{ fontWeight:700, fontSize:12, color:T.muted, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>Free</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:40, fontWeight:900, color:T.text, marginBottom:4 }}>$0</div>
        <div style={{ color:T.muted, fontSize:13, marginBottom:24 }}>Forever. No credit card.</div>
        <div style={{ display:"grid", gap:10, marginBottom:28 }}>
          {[
            { text:"Browse all live jobs", ok:true },
            { text:"Save unlimited jobs", ok:true },
            { text:"Application tracker", ok:true },
            { text:"Resume upload", ok:true },
            { text:"Auto Apply", ok:false },
            { text:"Tailored Resumes", ok:false },
            { text:"Cover Letters", ok:false },
            { text:"AI Tools", ok:false },
            { text:"Chrome Extension", ok:false },
          ].map((f,i) => (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"center", fontSize:13, color:f.ok?T.text:T.muted2 }}>
              <span style={{ color:f.ok?T.green:T.muted2, fontWeight:900, fontSize:14 }}>{f.ok?"✓":"✕"}</span>
              {f.text}
            </div>
          ))}
        </div>
        <button onClick={onGetStarted} className="gbtn" style={{ width:"100%", padding:"13px", fontSize:14, fontWeight:700 }}>
          Get Started Free
        </button>
      </div>

      {/* Plus Plan */}
      <div style={{ padding:32, borderRadius:22, background:T.card, border:`2px solid ${T.primary}`, position:"relative", boxShadow:`0 8px 32px rgba(79,70,229,.15)` }}>
        <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:T.grad, color:"#fff", fontSize:11, fontWeight:800, padding:"4px 16px", borderRadius:999 }}>
          MOST POPULAR
        </div>
        <div style={{ fontWeight:700, fontSize:12, color:T.primary, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>Plus</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:40, fontWeight:900, color:T.text, marginBottom:4 }}>$9.99</div>
        <div style={{ color:T.muted, fontSize:13, marginBottom:24 }}>per month, cancel anytime</div>
        <div style={{ display:"grid", gap:10, marginBottom:28 }}>
          {[
            { text:"Everything in Free", ok:true },
            { text:"Auto Apply — 20/day", ok:true },
            { text:"Tailored Resumes — 15/day", ok:true },
            { text:"Cover Letters — 15/day", ok:true },
            { text:"Interview Prep", ok:true },
            { text:"Resume Explainer", ok:true },
            { text:"Job Fit Analysis", ok:true },
            { text:"Chrome Extension", ok:true },
            { text:"Priority Support", ok:false },
          ].map((f,i) => (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"center", fontSize:13, color:f.ok?T.text:T.muted2 }}>
              <span style={{ color:f.ok?T.green:T.muted2, fontWeight:900, fontSize:14 }}>{f.ok?"✓":"✕"}</span>
              {f.text}
            </div>
          ))}
        </div>
        <button className="pbtn" style={{ width:"100%", padding:"13px", fontSize:14, fontWeight:700 }}>
          Start Plus — $9.99/mo
        </button>
      </div>

      {/* Ultra Plan */}
      <div style={{ padding:32, borderRadius:22, background:T.grad, border:"none", position:"relative", overflow:"hidden" }}>
        <div style={{ fontWeight:700, fontSize:12, color:"rgba(255,255,255,.7)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>Ultra</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:40, fontWeight:900, color:"#fff", marginBottom:4 }}>$29.99</div>
        <div style={{ color:"rgba(255,255,255,.7)", fontSize:13, marginBottom:24 }}>per month, cancel anytime</div>
        <div style={{ display:"grid", gap:10, marginBottom:28 }}>
          {[
            { text:"Everything in Plus", ok:true },
            { text:"Auto Apply — 50/day", ok:true },
            { text:"Tailored Resumes — 50/day", ok:true },
            { text:"Cover Letters — 50/day", ok:true },
            { text:"Priority Job Matching", ok:true },
            { text:"Daily Email Alerts", ok:true },
            { text:"Resume Version History", ok:true },
            { text:"Priority Support", ok:true },
            { text:"Early Access Features", ok:true },
          ].map((f,i) => (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"center", fontSize:13, color:"#fff" }}>
              <span style={{ fontWeight:900, fontSize:14 }}>✓</span>
              {f.text}
            </div>
          ))}
        </div>
        <button style={{ width:"100%", padding:"13px", fontSize:14, fontWeight:700, borderRadius:10, border:"2px solid rgba(255,255,255,.4)", background:"rgba(255,255,255,.15)", color:"#fff", cursor:"pointer", fontFamily:"inherit" }}>
          Start Ultra — $29.99/mo
        </button>
      </div>

    </div>

    {/* Bottom note */}
    <div style={{ textAlign:"center", marginTop:32, color:T.muted, fontSize:13 }}>
      All plans include a 7-day free trial. No credit card required to start.
    </div>

  </div>
</section>

      {/* Final CTA */}
      <section className="land-section" style={{ textAlign:"center" }}>
        <div className="land-container">
          <div style={{ maxWidth:560, margin:"0 auto" }}>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(28px,4vw,48px)", fontWeight:900, color:T.text, marginBottom:18 }}>
              Ready to land your<br/>
              <span style={{ background:T.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>dream job?</span>
            </h2>
            <p style={{ color:T.muted, fontSize:17, marginBottom:36 }}>Join thousands of job seekers using SmartApply to find and land better jobs faster. Free forever.</p>
            <button onClick={onGetStarted} className="pbtn" style={{ fontSize:17, padding:"16px 40px", borderRadius:14 }}>Start For Free →</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop:`1px solid ${T.border}`, padding:"36px 0", background:T.card }}>
        <div className="land-container" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:T.grad, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:13, fontFamily:"'Syne',sans-serif" }}>S</div>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, color:T.text }}>SmartApply</span>
          </div>
          <div style={{ color:T.muted, fontSize:13 }}>© 2025 SmartApply · Free AI-powered job search · Built with ❤️</div>
          <div style={{ display:"flex", gap:16 }}>
            {["Privacy","Terms","Contact"].map(l => <a key={l} href="#" style={{ color:T.muted, fontSize:13, textDecoration:"none", fontWeight:600 }}>{l}</a>)}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── JobCard — memoized ─────────────────────────────────────────────────────────
const JobCard = memo(function JobCard({ job, expandedId, setExpandedId, apps, resumeResult, tailoringId, onTailor, onSave, onTrack, onApply, timeAgo, matchLabel, matchColor, isTailorLocked, onLockedClick }) {
  const expanded = expandedId === job.id;
  const matched  = job.matchedSkills || [];
  const missing  = job.missingSkills || [];
  const preview  = (matched.length ? matched : job.jobSkills || []).slice(0, 6);
  const inApp    = !!apps[job.id];
  const hasScore = resumeResult && job.matchScore !== undefined;
  const mc       = hasScore ? matchColor(job.matchScore) : T.muted2;

  return (
    <div className="jcard" style={{ borderLeft:`4px solid ${hasScore ? mc : T.border}` }}>
      <div style={{ display:"grid", gridTemplateColumns:"52px minmax(0,1fr) 108px", gap:16, padding:"20px 22px" }}>
        <div style={{ width:46, height:46, borderRadius:13, flexShrink:0, background:`${mc}15`, border:`1.5px solid ${mc}30`, color:mc, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:14 }}>
          {job.company?.slice(0,2)?.toUpperCase()||"JB"}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", color:T.muted, fontSize:12, fontWeight:600, marginBottom:6 }}>
            <span style={{ fontFamily:"'JetBrains Mono',monospace" }}>{timeAgo(job.updatedAt)}</span>
            {hasScore && job.matchScore >= 80 && <span style={{ padding:"2px 9px", borderRadius:999, fontSize:11, background:T.greenL, color:"#065f46", border:"1px solid #6ee7b7", fontWeight:800 }}>🔥 Top Match</span>}
            {inApp && <span style={{ padding:"2px 9px", borderRadius:999, fontSize:11, fontWeight:800, background:STAGE_META[apps[job.id].stage]?.bg, color:STAGE_META[apps[job.id].stage]?.color, border:`1px solid ${STAGE_META[apps[job.id].stage]?.border}` }}>{STAGE_META[apps[job.id].stage]?.emoji} {apps[job.id].stage}</span>}
          </div>
          <h3 style={{ margin:"0 0 3px", color:T.text, fontSize:18, lineHeight:1.25, fontFamily:"'Syne',sans-serif", fontWeight:800 }}>{job.title}</h3>
          <p style={{ margin:"0 0 10px", color:T.muted, fontWeight:600, fontSize:14 }}>{job.company}</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:12, color:T.muted, fontSize:13, marginBottom:12 }}>
            <span>📍 {job.location}</span>
            {job.description?.toLowerCase().includes("remote") && <span style={{ color:T.primary }}>🌐 Remote-ok</span>}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
            {preview.map((sk,i) => <span key={i} className={`chip${matched.includes(sk)?" ok":""}`}>{sk}</span>)}
            {(job.jobSkills?.length||0) > 6 && <span className="chip">+{job.jobSkills.length-6}</span>}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button className="pbtn" onClick={() => onApply(job)} style={{ padding:"9px 18px", fontSize:13 }}>Apply Now →</button>
           <button
  onClick={() => isTailorLocked ? onLockedClick("tailored") : onTailor(job)}
  disabled={!resumeResult && !isTailorLocked}
  style={{ padding:"9px 15px", borderRadius:10, fontWeight:700,
    cursor:"pointer", fontSize:13,
    background: isTailorLocked ? T.goldL : resumeResult ? T.greenL : T.cardAlt,
    color: isTailorLocked ? "#b45309" : resumeResult ? T.green : T.muted2,
    border:`1.5px solid ${isTailorLocked ? "#fde68a" : resumeResult ? "#6ee7b7" : T.border}`,
    transition:"all .15s" }}>
  {isTailorLocked ? "🔒 Tailor Resume" : tailoringId === job.id ? "⏳ Analyzing…" : "✨ Tailor Resume"}
</button>
            <button className="gbtn" onClick={() => setExpandedId(expanded ? null : job.id)}>{expanded?"▲ Hide":"▼ Match Details"}</button>
            <button className="gbtn" onClick={() => onSave(job)}>♡ Save</button>
            {!inApp ? <button className="gbtn" onClick={() => onTrack(job)} style={{ color:T.primary, borderColor:`${T.primary}50` }}>+ Track</button>
              : <span style={{ padding:"9px 10px", fontSize:13, color:T.green, fontWeight:700 }}>✓ Tracked</span>}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:5 }}>
          {hasScore ? (
            <><CircularGauge score={job.matchScore} size={90}/><span style={{ fontSize:11.5, fontWeight:800, color:mc }}>{matchLabel(job.matchScore)}</span></>
          ) : (
            <div style={{ textAlign:"center" }}>
              <div style={{ width:64, height:64, borderRadius:"50%", border:`2px dashed ${T.border2}`, margin:"0 auto 6px", display:"flex", alignItems:"center", justifyContent:"center", color:T.muted2, fontSize:14, fontWeight:700 }}>--</div>
              <div style={{ fontSize:11, color:T.muted2, fontWeight:600, lineHeight:1.4 }}>Upload<br/>resume</div>
            </div>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop:`1px solid ${T.border}`, background:T.cardAlt, padding:"16px 22px", animation:"fadeIn .2s ease" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            <div><SL>✅ Matched Skills</SL><div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>{matched.length?matched.slice(0,12).map((sk,i)=><span key={i} className="chip ok">{sk}</span>):<span style={{ color:T.muted, fontSize:13 }}>None yet</span>}</div></div>
            <div><SL>⚠ Missing Keywords</SL><div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>{missing.length?missing.slice(0,12).map((sk,i)=><span key={i} className="chip gap">{sk}</span>):<span style={{ color:T.muted, fontSize:13 }}>No major gaps</span>}</div></div>
          </div>
          {job.description && (
            <div>
              <SL>📄 Job Description</SL>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:14, maxHeight:200, overflowY:"auto", fontSize:13, color:T.muted, lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                {job.description.slice(0, 1500)}{job.description.length > 1500 ? "..." : ""}
              </div>
              <a href={job.url} target="_blank" rel="noreferrer"
                style={{ display:"inline-block", marginTop:8, fontSize:12, color:T.primary, fontWeight:700, textDecoration:"none" }}>
                View Full Job Posting →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
function AutoApplyPage({ 
  resumeResult, 
  profile, 
  apps, 
  setApps, 
  setActivePage, 
  toast,
  matchColor 
}) {
  const [autoJobs, setAutoJobs] = useState([]);
  const [jobPool, setJobPool] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState([]);
  const [appliedToday, setAppliedToday] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAutoJobs();
  }, []);

  const loadAutoJobs = async () => {
    try {
      setLoading(true);
      const sq = resumeResult?.skills?.length
        ? `?skills=${encodeURIComponent(resumeResult.skills.join("|"))}`
        : "";
      const res = await fetch(`${API}/api/auto-apply/jobs${sq}`);
      const d = await res.json();
      const all = d.jobs || [];
      setAutoJobs(all.slice(0, 20));
      setJobPool(all.slice(20));
      setSelectedIds(new Set(all.slice(0, 20).map(j => j.id)));
    } catch {
      toast("Failed to load jobs", "error");
    } finally {
      setLoading(false);
    }
  };

  const removeJob = (jobId) => {
    const next = jobPool[0];
    setJobPool(p => p.slice(1));
    setAutoJobs(p => {
      const filtered = p.filter(j => j.id !== jobId);
      return next ? [...filtered, next] : filtered;
    });
    setSelectedIds(p => {
      const n = new Set(p);
      n.delete(jobId);
      if (next) n.add(next.id);
      return n;
    });
  };

  const toggleSelect = (jobId) => {
    setSelectedIds(p => {
      const n = new Set(p);
      n.has(jobId) ? n.delete(jobId) : n.add(jobId);
      return n;
    });
  };

  const handleAutoApply = async () => {
    if (!resumeResult?.resumeText) {
      toast("Upload your resume first", "warning");
      setActivePage("resume");
      return;
    }

    const selected = autoJobs.filter(j => selectedIds.has(j.id));
    if (selected.length === 0) {
      toast("Select at least one job", "warning");
      return;
    }

    const remaining = 20 - appliedToday;
    if (selected.length > remaining) {
      toast(`Only ${remaining} applications left today`, "warning");
      return;
    }

    try {
      setApplying(true);
      setProgress(selected.map(j => ({
        jobId: j.id,
        title: j.title,
        company: j.company,
        status: "pending"
      })));

      const nameParts = (profile.name || "").split(" ");
      const userData = {
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: profile.email || "",
        phone: profile.phone || "",
      };

      const res = await fetch(`${API}/api/auto-apply/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobs: selected,
          userData,
          resumeText: resumeResult.resumeText
        })
      });

      const d = await res.json();

      if (!res.ok) {
        toast(d.error || "Auto apply failed", "error");
        return;
      }

      setProgress(d.results);

      d.results.forEach(r => {
        if (r.status === "applied") {
          const job = selected.find(j => j.id === r.jobId);
          if (job) {
            setApps(prev => ({
              ...prev,
              [job.id]: {
                stage: "Applied",
                notes: "Auto applied",
                appliedDate: r.appliedDate,
                job
              }
            }));
          }
        }
      });

      const successCount = d.results.filter(r => r.status === "applied").length;
      setAppliedToday(p => p + successCount);
      toast(`${successCount} applications submitted! 🎉`);

    } catch {
      toast("Auto apply failed", "error");
    } finally {
      setApplying(false);
    }
  };

  const remaining = 20 - appliedToday;
  const selectedCount = selectedIds.size;

  return (
    <section>
      <div style={{ marginBottom:24 }}>
        <p style={{ color:T.primary, fontWeight:700, fontSize:11.5,
          letterSpacing:".09em", textTransform:"uppercase", marginBottom:5 }}>
          Dashboard / Auto Apply
        </p>
        <h1 style={{ fontFamily:"'Syne',sans-serif", color:T.text,
          fontSize:28, margin:0, fontWeight:900 }}>
          Auto Apply
        </h1>
        <p style={{ color:T.muted, marginTop:5, fontSize:15 }}>
          We pick the best matches. You click once. Done.
        </p>
      </div>

      {!resumeResult && (
        <div style={{ padding:14, borderRadius:12, background:T.goldL,
          border:"1px solid #fde68a", color:"#92400e", fontWeight:600,
          fontSize:14, marginBottom:18 }}>
          ⚠ Upload your resume first so we can match you to the right jobs.{" "}
          <button onClick={() => setActivePage("resume")}
            style={{ background:"none", border:"none", color:T.primary,
              fontWeight:800, cursor:"pointer", textDecoration:"underline",
              fontSize:14 }}>
            Upload now →
          </button>
        </div>
      )}

      {/* Header bar */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`,
        borderRadius:16, padding:"18px 22px", marginBottom:16,
        display:"flex", alignItems:"center",
        justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>

        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div>
            <div style={{ fontSize:13, color:T.muted, fontWeight:600,
              marginBottom:4 }}>
              Daily applications remaining
            </div>
            <div style={{ display:"flex", gap:4 }}>
              {[...Array(20)].map((_, i) => (
                <div key={i} style={{ width:18, height:8, borderRadius:4,
                  background: i < appliedToday ? T.green :
                    i < appliedToday + selectedCount ? T.primary : T.border,
                  transition:"background .3s" }}/>
              ))}
            </div>
          </div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:28,
            fontWeight:900,
            color: remaining > 10 ? T.green :
              remaining > 5 ? T.gold : T.red }}>
            {remaining}/20
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button className="gbtn"
            onClick={() => setSelectedIds(
              new Set(autoJobs.map(j => j.id))
            )}>
            Select All
          </button>
          <button className="gbtn"
            onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
          <button className="pbtn"
            onClick={handleAutoApply}
            disabled={applying || !resumeResult || selectedCount === 0}
            style={{ padding:"11px 24px", fontSize:15 }}>
            {applying
              ? "⏳ Applying..."
              : `🚀 Apply to ${selectedCount} Job${selectedCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      {/* Progress section */}
      {progress.length > 0 && (
        <div style={{ background:T.card, border:`1px solid ${T.border}`,
          borderRadius:16, padding:"18px 22px", marginBottom:16 }}>
          <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:17,
            fontWeight:800, marginBottom:14 }}>
            Application Progress
          </h3>
          <div style={{ display:"grid", gap:8 }}>
            {progress.map((p, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center",
                gap:12, padding:"10px 14px", borderRadius:10,
                background: p.status === "applied" ? T.greenL :
                  p.status === "failed" ? T.redL : T.cardAlt,
                border:`1px solid ${
                  p.status === "applied" ? "#6ee7b7" :
                  p.status === "failed" ? "#fca5a5" : T.border}` }}>
                <span style={{ fontSize:18 }}>
                  {p.status === "applied" ? "✅" :
                    p.status === "failed" ? "❌" : "⏳"}
                </span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, fontSize:14,
                    color:T.text }}>{p.title}</div>
                  <div style={{ fontSize:13,
                    color:T.muted }}>{p.company}</div>
                </div>
                <span style={{ fontSize:13, fontWeight:700,
                  color: p.status === "applied" ? T.green :
                    p.status === "failed" ? T.red : T.muted }}>
                  {p.status === "applied" ? "Submitted ✅" :
  p.status === "failed" ? "Failed ❌" : 
  p.status === "needs_attention" ? "Needs Manual Review ⚠️" : "In progress..."}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job list */}
      {loading ? (
        <div style={{ display:"grid", gap:10 }}>
          {[...Array(5)].map((_, i) => <JobSkeleton key={i}/>)}
        </div>
      ) : autoJobs.length === 0 ? (
        <div style={{ padding:56, borderRadius:18, background:T.card,
          border:`1px solid ${T.border}`, textAlign:"center",
          color:T.muted }}>
          <div style={{ fontSize:44, marginBottom:12 }}>🔍</div>
          <h3 style={{ fontFamily:"'Syne',sans-serif", color:T.text,
            marginBottom:8, fontWeight:800 }}>
            No matches found
          </h3>
          <p>Upload your resume so we can find your best matches.</p>
        </div>
      ) : (
        <div style={{ display:"grid", gap:10 }}>
          {autoJobs.map(job => {
            const isSelected = selectedIds.has(job.id);
            const mc = matchColor(job.matchScore || 0);
            return (
              <div key={job.id} style={{
                background:T.card,
                border:`1.5px solid ${isSelected ? T.primary : T.border}`,
                borderRadius:16, padding:"18px 22px",
                display:"grid",
                gridTemplateColumns:"36px 52px minmax(0,1fr) 90px auto",
                gap:14, alignItems:"center", transition:"all .18s",
                boxShadow: isSelected
                  ? `0 0 0 3px ${T.primary}20` : "none" }}>

                <input type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(job.id)}
                  style={{ width:18, height:18,
                    accentColor:T.primary, cursor:"pointer" }}/>

                <div style={{ width:46, height:46, borderRadius:13,
                  background:`${mc}15`, border:`1.5px solid ${mc}30`,
                  color:mc, display:"flex", alignItems:"center",
                  justifyContent:"center",
                  fontFamily:"'Syne',sans-serif",
                  fontWeight:900, fontSize:14 }}>
                  {job.company?.slice(0, 2)?.toUpperCase() || "JB"}
                </div>

                <div style={{ minWidth:0 }}>
                  <h3 style={{ margin:"0 0 3px", color:T.text, fontSize:17,
                    fontFamily:"'Syne',sans-serif", fontWeight:800,
                    whiteSpace:"nowrap", overflow:"hidden",
                    textOverflow:"ellipsis" }}>
                    {job.title}
                  </h3>
                  <p style={{ margin:"0 0 6px", color:T.muted,
                    fontWeight:600, fontSize:14 }}>
                    {job.company}
                  </p>
                  <p style={{ margin:0, color:T.muted, fontSize:13 }}>
                    📍 {job.location}
                  </p>
                </div>

                <CircularGauge score={job.matchScore || 0} size={80}/>

                <button onClick={() => removeJob(job.id)}
                  style={{ padding:"8px 14px", borderRadius:10,
                    border:"1px solid #fca5a5", background:T.redL,
                    color:T.red, fontWeight:700, cursor:"pointer",
                    fontSize:13, whiteSpace:"nowrap" }}>
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
// ════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════
export default function App() {
  const [showLanding, setShowLanding] = useLocalStorage("showLanding", true);
  const [onboardingDone, setOnboardingDone] = useLocalStorage("onboardingDone", false);
  const [onboardStep, setOnboardStep] = useState(1);
  const [onboardData, setOnboardData] = useLocalStorage("onboardData", {});
  const [activePage, setActivePage] = useLocalStorage("activePage", "dashboard");
  const [profileTab,  setProfileTab]  = useState("personal");
  const [backendOk,   setBackendOk]   = useState(false);
  const [status,      setStatus]      = useState("Connecting…");
  const [toasts,      setToasts]      = useState([]);
  const toast = useCallback((msg, type="success") => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message:msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3600);
  }, []);

  // Jobs state
  const [allJobs,       setAllJobs]      = useState([]);
  const [loadingJobs,   setLoadingJobs]  = useState(false);
  const [jobRange, setJobRange] = useState("24h");
  const [countrySearch, setCountrySearch]= useState("");
  const [jobSearch,     setJobSearch]    = useState("");
  const [workType,      setWorkType]     = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [expFilter,     setExpFilter]    = useState("any");
  const [countrySug,    setCountrySug]   = useState([]);
  const [jobSug,        setJobSug]       = useState([]);
  const [expandedId,    setExpandedId]   = useState(null);
  const [hoverAppId,    setHoverAppId]   = useState(null);
  const [stageSearch,   setStageSearch]  = useState({ Applied:"","Phone Screen":"",Interview:"",Offer:"",Rejected:"" });
  const [visibleCount,  setVisibleCount] = useState(30);

  // Resume state
  const [selFile,      setSelFile]      = useState(null);
  const [uploadMsg,    setUploadMsg]    = useState("");
  const [resumeResult,  setResumeResult]  = useLocalStorage("resumeResult", null);
  const [originalResume,setOriginalResume] = useLocalStorage("originalResume", null);
  const [uploading,    setUploading]    = useState(false);
  const [jobDesc,      setJobDesc]      = useState("");
  const [matchResult,  setMatchResult]  = useState(null);
  const [matching,     setMatching]     = useState(false);

  // Tailor state
  const [showTailor,  setShowTailor]  = useState(false);
  const [tailorData,  setTailorData]  = useState(null);
  const [selSkills,   setSelSkills]   = useState([]);
  const [selBullets,  setSelBullets]  = useState([]);
  const [tailoringId, setTailoringId] = useState(null);
  const [genResume,   setGenResume]   = useState(null);
  const [generating,  setGenerating]  = useState(false);
  const [tailoredHist,setTailoredHist]= useLocalStorage("tailoredHist", []);

  // Saved / tracker
  const [savedJobs,    setSavedJobs]   = useLocalStorage("savedJobs", []);
  const [savedNotes,   setSavedNotes]  = useLocalStorage("savedNotes", {});
  const [pendingApply, setPendingApply]= useLocalStorage("pendingApply", null);
  const [showApplyPopup,setShowApplyPopup] = useState(false);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("");
  const [userPlan, setUserPlan] = useState("ultra");
  const [lastVisit,    setLastVisit]   = useLocalStorage("lastVisit", 0);
  const [apps,         setApps]        = useLocalStorage("apps", {});

  // Profile
  const [profile, setProfile] = useLocalStorage("profile", { name:"",targetRole:"",targetRoles:[],email:"",phone:"",location:"United States",workPreference:"Remote / Hybrid" });
  useEffect(() => { if (!Array.isArray(profile.targetRoles)) setProfile(p => ({...p, targetRoles:p.targetRole?[p.targetRole]:[]})); }, [profile, setProfile]);
  const newEdu = () => ({ id:Date.now()+Math.random(), degree:"Bachelor's Degree", field:"", institution:"", startYear:"", endYear:"", gpa:"", extra:"" });
  const newExp = () => ({ id:Date.now()+Math.random(), company:"", title:"", startDate:"", endDate:"Present", description:"" });
  const [eduList, setEduList] = useLocalStorage("eduList", [newEdu()]);
  const [expList, setExpList] = useLocalStorage("expList", [newExp()]);
  const [skillsText, setSkillsText] = useLocalStorage("skillsText", "");
  const [targetSubRoles, setTargetSubRoles] = useLocalStorage("targetSubRoles", {});
const [subRolePopup, setSubRolePopup] = useState(null);
const [tempSubRoles, setTempSubRoles] = useState([]);

  // AI Tools state
  const [aiTab,        setAiTab]       = useState("cover-letter");
  const [aiJobTitle,   setAiJobTitle]  = useState("");
  const [aiCompany,    setAiCompany]   = useState("");
  const [aiJobDesc,    setAiJobDesc]   = useState("");
  const [aiResult,     setAiResult]    = useState({});
  const [aiLoading,    setAiLoading]   = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput,    setChatInput]    = useState("");
  const [chatLoading,  setChatLoading]  = useState(false);

  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [cachedCount,   setCachedCount]   = useState(0);

  // ── Helpers ────────────────────────────────────────────────────────

  const EXP_RULES = { entry:["entry level","entry-level","junior","new grad","0-1 year","intern"], mid:["2+ year","2-4 year","3+ year","mid-level","associate","intermediate"], senior:["senior","5+ year","4+ year","sr.","lead developer","lead engineer"], expert:["8+ year","10+ year","staff engineer","principal","architect"] };

  const matchesExpFilter = useCallback((job, filter) => {
    if (filter === "any") return true;
    if (job.experienceBand && job.experienceBand !== "any") return job.experienceBand === filter;
    const txt = (`${job.title||""} ${job.description||""}`).toLowerCase();
    const rules = EXP_RULES[filter];
    if (!rules) return true;
    const hasKw  = rules.some(k => txt.includes(k));
    const hasAny = Object.values(EXP_RULES).flat().some(k => txt.includes(k));
    if (!hasAny) return true;
    return hasKw;
  }, []);

  const ROLE_KW = { "Software Engineer":["software engineer","software developer","sde"], "Backend Engineer":["backend","back-end","api developer"], "Frontend Engineer":["frontend","front-end","react","ui engineer"], "Full Stack Developer":["full stack","fullstack","full-stack"], "Data Engineer":["data engineer","etl","pipeline","spark"], "Database Administrator":["database administrator","dba","sql server dba"] };

  const jobs = useMemo(() => {
    const skills = resumeResult?.skills || [];
    let result = allJobs.map(j => ({ ...j, matchScore: j.matchScore }));
    result = result.filter(j => !apps[j.id]);
    const effRoles = jobSearch.trim() ? [jobSearch.trim()] : (profile.targetRoles?.length ? profile.targetRoles : []);
    const effLoc   = countrySearch.trim() || profile.location || "";
    if (effRoles.length) result = result.filter(j => {
  const t = `${j.title||""} ${j.description||""}`.toLowerCase();
  return effRoles.some(r => {
    const selectedSubs = targetSubRoles[r];
    if (selectedSubs && selectedSubs.length > 0) {
      return selectedSubs.some(sub => t.includes(sub.toLowerCase()));
    }
    return (ROLE_KW[r]||[r.toLowerCase()]).some(k => t.includes(k));
  });
});
    if (effLoc.trim()) { const q = effLoc.toLowerCase().trim(); const US = ["united states","usa","u.s.","us","new york","san francisco","seattle","austin","chicago","boston","california","texas","virginia","washington","florida","denver","atlanta","dallas","nyc","bay area"]; result = result.filter(j => { const loc = (j.location||"").toLowerCase(); return US.some(t=>q.includes(t.split(" ")[0]))?US.some(t=>loc.includes(t)):loc.includes(q); }); }
    if (expFilter !== "any") result = result.filter(j => matchesExpFilter(j, expFilter));
    if (sortBy === "recommended" || sortBy === "match") result = [...result].sort((a,b) => (b.matchScore||0) - (a.matchScore||0));
    else if (sortBy === "recent") result = [...result].sort((a,b) => new Date(b.updatedAt||0) - new Date(a.updatedAt||0));
    return result;
  }, [allJobs, jobSearch, countrySearch, expFilter, sortBy, resumeResult, apps, profile, matchesExpFilter]);

  const newJobsCount = useMemo(() => { if (!lastVisit) return 0; return jobs.filter(j => new Date(j.updatedAt||0).getTime() > lastVisit).length; }, [jobs, lastVisit]);

  // Effects
  useEffect(() => {
    const poll = () => fetch(`${API}/api/health`).then(r=>r.json()).then(d => { setBackendOk(true); setStatus("Online"); if(d.lastFetchedAt)setLastRefreshed(d.lastFetchedAt); if(d.cachedCount)setCachedCount(d.cachedCount); }).catch(() => { setBackendOk(false); setStatus("Offline"); });
    poll();
    const iv = setInterval(poll, 30000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { document.body.style.overflow = showTailor ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [showTailor]);
  useEffect(() => { fetchJobs(false); const iv = setInterval(() => fetchJobs(false), 15*60*1000); return () => clearInterval(iv); }, [jobRange, resumeResult, workType]);
  useEffect(() => { setCountrySug(!countrySearch.trim()?[]:COUNTRIES.filter(c=>c.toLowerCase().includes(countrySearch.toLowerCase())).slice(0,5)); }, [countrySearch]);
  useEffect(() => { setJobSug(!jobSearch.trim()?[]:JOB_KEYWORDS.filter(k=>k.toLowerCase().includes(jobSearch.toLowerCase())).slice(0,6)); }, [jobSearch]);
  useEffect(() => { return () => setLastVisit(Date.now()); }, []);
  useEffect(() => { const h = () => { if (pendingApply) setShowApplyPopup(true); }; window.addEventListener("focus", h); return () => window.removeEventListener("focus", h); }, [pendingApply]);
  useEffect(() => { const h = e => { if (e.key === "Escape" && showTailor) setShowTailor(false); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [showTailor]);
  useEffect(() => {
  const syncProfileToExtension = async () => {
    if (!profile.name && !profile.email) return;
    try {
      const nameParts = (profile.name || "").split(" ");
      const extProfile = {
        name: profile.name || "",
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: profile.email || "",
        phone: profile.phone || "",
        linkedinUrl: profile.linkedinUrl || "",
        portfolioUrl: profile.portfolioUrl || "",
        expectedSalary: profile.expectedSalary || "",
        workAuth: profile.workAuth || "",
        sponsorshipNow: profile.sponsorshipNow || "",
        sponsorshipFuture: profile.sponsorshipFuture || "",
        gender: profile.gender || "",
        veteranStatus: profile.veteranStatus || "",
        disabilityStatus: profile.disabilityStatus || "",
        ethnicity: profile.ethnicity || "",
        resumeText: resumeResult?.resumeText || "",
      };
      await fetch(`${API}/api/extension/save-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extProfile)
      });
    } catch (e) {
      console.log("Extension sync skipped:", e.message);
    }
  };
  syncProfileToExtension();
}, [profile, resumeResult]);

  // Handlers
  const fetchJobs = async (refresh=false) => {
    try {
      setLoadingJobs(true);
      const cq = resumeResult?.categories?.length
  ? `&categories=${encodeURIComponent(JSON.stringify(resumeResult.categories))}`
  : "";

const res = await fetch(
  `${API}/api/jobs?range=${jobRange}${cq}&workType=${encodeURIComponent(workType)}${refresh ? "&refresh=true" : ""}`
);
      const d   = await res.json();
      setAllJobs(d.jobs || []);
    } catch { setAllJobs([]); } finally { setLoadingJobs(false); }
  };

  const handleUpload = async () => {
    if (!selFile) { toast("Choose a PDF or DOCX file first","warning"); return; }
    try {
      setUploading(true); setUploadMsg("Analyzing…");
      setResumeResult(null); setMatchResult(null); setTailorData(null); setGenResume(null); setShowTailor(false); setSelSkills([]); setSelBullets([]);
      const fd = new FormData(); fd.append("resume", selFile);
      const res = await fetch(`${API}/api/upload-resume`, { method:"POST", body:fd });
      const d   = await res.json();
      if (!res.ok) { toast(d.error||"Upload failed","error"); setUploadMsg(""); return; }
      setUploadMsg("Analysis complete!");
      setResumeResult(d.resume);
      setOriginalResume(d.resume);
      const p = d.resume.profile || {};
      setProfile(prev => ({ ...prev, name:p.name||prev.name, email:p.email||prev.email, phone:p.phone||prev.phone }));
      if (p.education) setEduList([{ ...newEdu(), extra:p.education }]);
      if (p.experience) setExpList([{ ...newExp(), description:p.experience }]);
      if (d.resume.skills?.length) setSkillsText(d.resume.skills.join(", "));
      toast("Resume uploaded & analyzed! 🎉","success");
      setActivePage("jobs");
      setTimeout(() => fetchJobs(false), 150);
    } catch { toast("Upload failed","error"); setUploadMsg(""); } finally { setUploading(false); }
  };

  const handleMatch = async () => {
    if (!resumeResult?.resumeText) { toast("Upload resume first","warning"); setActivePage("resume"); return; }
    if (!jobDesc.trim()) { toast("Paste a job description first","warning"); return; }
    try {
      setMatching(true); setMatchResult(null);
      const res = await fetch(`${API}/api/match-job`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ resumeText:resumeResult.resumeText, jobDescription:jobDesc }) });
      const d = await res.json();
      if (!res.ok) { toast(d.error||"Match failed","error"); return; }
      setMatchResult(d);
    } catch { toast("Match failed","error"); } finally { setMatching(false); }
  };

  const handleTailor = async job => {
    if (!resumeResult?.resumeText) { toast("Upload resume first","warning"); setActivePage("resume"); return; }
    try {
      setTailoringId(job.id); setGenResume(null);
      const res = await fetch(`${API}/api/tailor-analyze`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ resumeText:originalResume?.resumeText || resumeResult.resumeText, job:{ ...job, description: job.description || "" } }) });
      const d = await res.json();
      if (!res.ok) { toast(d.error||"Tailor failed","error"); return; }
      setTailorData({...d, jobUrl: job.url}); setSelSkills(d.missingSkills||[]); setSelBullets(d.bulletSuggestions||[]); setShowTailor(true);
    } catch { toast("Tailor failed","error"); } finally { setTailoringId(null); }
  };

  const handleGenerate = async () => {
    if (!tailorData) return;
    setChatMessages([]);
    setChatInput("");
    try {
      setGenerating(true); setGenResume(null);
      const res = await fetch(`${API}/api/generate-tailored-resume`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ resumeText:originalResume?.resumeText || resumeResult.resumeText, job:{ title:tailorData.jobTitle, company:tailorData.company, description:tailorData.jobDescription || "" }, selectedSkills:selSkills, selectedBullets:selBullets }) });
      const d = await res.json();
      if (!res.ok) { toast(d.error||"Generation failed","error"); return; }
      setGenResume(d);
      setTailoredHist(p => [{ id:Date.now(), jobTitle:tailorData.jobTitle, company:tailorData.company, beforeScore:d.beforeScore, afterScore:d.afterScore, tailoredResume:d.tailoredResume }, ...p].slice(0, 10));
      toast("Tailored resume generated! 🎉");
    } catch { toast("Generation failed","error"); } finally { setGenerating(false); }
  };

  const callAI = async (endpoint, body, tabKey) => {
    try {
      setAiLoading(p => ({...p, [tabKey]:true}));
      setAiResult(p => ({...p, [tabKey]:""}));
      const res = await fetch(`${API}${endpoint}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { toast(d.error||"AI request failed","error"); return; }
      setAiResult(p => ({...p, [tabKey]:d.content}));
    } catch { toast("AI request failed — is your backend running?","error"); } finally { setAiLoading(p => ({...p, [tabKey]:false})); }
  };
const downloadPDF = (text, jobTitle) => {
    const doc = new jsPDF({ unit:"pt", format:"letter" });
    const marginL = 50;
    const marginR = 50;
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - marginL - marginR;
    let y = 50;

    const checkPage = (needed = 14) => {
      if (y + needed > pageHeight - 40) { doc.addPage(); y = 50; }
    };

    const writeLine = (txt, opts = {}) => {
      const {
        fontSize = 10,
        bold     = false,
        color    = [0,0,0],
        center   = false,
        indent   = 0,
        spacing  = 1.45,
      } = opts;

      doc.setFontSize(fontSize);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(...color);

      const x = center ? pageWidth / 2 : marginL + indent;
      const maxW = usableWidth - indent;
      const wrapped = doc.splitTextToSize(txt, maxW);

      wrapped.forEach(line => {
        checkPage(fontSize * spacing);
        doc.text(line, x, y, center ? { align:"center" } : {});
        y += fontSize * spacing;
      });
    };

    const drawDivider = () => {
      checkPage(10);
      doc.setDrawColor(0,0,0);
      doc.setLineWidth(0.5);
      doc.line(marginL, y, pageWidth - marginR, y);
      y += 7;
    };

    const lines = text.split("\n");
    let lineIndex  = 0;
    let firstLine  = true;
    let secondLine = false;

    const SECTION_HEADERS = new Set([
      "PROFESSIONAL SUMMARY","SUMMARY","TECHNICAL SKILLS","SKILLS",
      "PROFESSIONAL EXPERIENCE","EXPERIENCE","WORK EXPERIENCE","EDUCATION",
      "PROJECTS","CERTIFICATIONS","ACHIEVEMENTS","AWARDS",
    ]);

    const isHeader = (t) =>
      SECTION_HEADERS.has(t.toUpperCase()) ||
      (t === t.toUpperCase() && t.length > 3 && t.length < 55 &&
       !t.startsWith("•") && !t.startsWith("-") && !/^\d/.test(t));

    const isBullet = (t) => t.startsWith("•") || t.startsWith("-") || t.startsWith("*");

    const isJobLine = (t) =>
      (t.includes("|") && t.length < 100) ||
      (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(t) && /\d{4}/.test(t) && t.length < 100) ||
      (/\d{4}\s*[–—-]\s*(\d{4}|present)/i.test(t) && t.length < 100);

    lines.forEach(line => {
      const t = line.trim();

      // Skip empty — just add spacing
      if (!t) {
        y += 5;
        return;
      }

      // First line = Name
      if (firstLine) {
        y += 4;
        writeLine(t, { fontSize:17, bold:true, center:true, spacing:1.3 });
        y += 2;
        firstLine  = false;
        secondLine = true;
        return;
      }

      // Second line = Contact info
      if (secondLine) {
        writeLine(t, { fontSize:9, color:[80,80,80], center:true, spacing:1.3 });
        y += 8;
        secondLine = false;
        return;
      }

      // Section headers
      if (isHeader(t)) {
        y += 10;
        writeLine(t, { fontSize:10.5, bold:true, spacing:1.3 });
        drawDivider();
        return;
      }

      // Bullet points
      if (isBullet(t)) {
        const cleaned = t.replace(/^[•\-\*]\s*/, "");
        writeLine("•  " + cleaned, { fontSize:10, indent:12, spacing:1.45 });
        return;
      }

      // Job header lines — company | title | date
      if (isJobLine(t)) {
        y += 4;
        writeLine(t, { fontSize:10, bold:true, spacing:1.35 });
        return;
      }

      // Everything else — regular paragraph text
      writeLine(t, { fontSize:10, spacing:1.45 });
    });

    const safeName = (jobTitle || "tailored-resume")
      .replace(/[^a-z0-9\s]/gi,"_")
      .replace(/\s+/g,"_")
      .slice(0,40);

    doc.save(`${safeName}.pdf`);
  };
 const downloadDOCX = (text, jobTitle) => {
    const lines = text.split("\n");
    let wordContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${jobTitle || "Tailored Resume"}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10pt; margin: 1in; color: #000; line-height: 1.4; }
          .name { font-size: 15pt; font-weight: bold; text-align: center; margin-bottom: 2pt; }
          .contact { font-size: 10pt; text-align: center; margin-bottom: 8pt; color: #333; }
          .section-header { font-size: 10pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid black; margin-top: 10pt; margin-bottom: 3pt; letter-spacing: 0.5pt; }
          p { font-size: 10pt; margin: 1pt 0; line-height: 1.4; }
          ul { margin: 2pt 0; padding-left: 14pt; }
          li { font-size: 10pt; margin: 1pt 0; line-height: 1.4; }
        </style>
      </head>
      <body>
    `;

    let inList = false;
    let isFirstLine = true;
    let isSecondLine = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) { wordContent += "</ul>"; inList = false; }
        return;
      }

      if (isFirstLine) {
        wordContent += `<div class="name">${trimmed}</div>`;
        isFirstLine = false; isSecondLine = true; return;
      }

      if (isSecondLine && (trimmed.includes("|") || trimmed.includes("@"))) {
        wordContent += `<div class="contact">${trimmed}</div>`;
        isSecondLine = false; return;
      }

      isSecondLine = false;

      const isHeader = (
        ["PROFESSIONAL SUMMARY","TECHNICAL SKILLS","PROFESSIONAL EXPERIENCE","EDUCATION","SUMMARY","SKILLS","EXPERIENCE","WORK EXPERIENCE"].includes(trimmed.toUpperCase()) ||
        (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 50 && !trimmed.startsWith("•") && !trimmed.startsWith("-") && !/\d{4}/.test(trimmed))
      );

      if (isHeader) {
        if (inList) { wordContent += "</ul>"; inList = false; }
        wordContent += `<div class="section-header">${trimmed}</div>`;
        return;
      }

      if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
        if (!inList) { wordContent += "<ul>"; inList = true; }
        wordContent += `<li>${trimmed.replace(/^[•\-]\s*/,"")}</li>`;
        return;
      }

      if (inList) { wordContent += "</ul>"; inList = false; }
      wordContent += `<p><strong>${trimmed}</strong></p>`;
    });

    if (inList) wordContent += "</ul>";
    wordContent += "</body></html>";

    const blob = new Blob(["\ufeff", wordContent], { type:"application/msword" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${(jobTitle || "tailored-resume").replace(/[^a-z0-9]/gi,"_")}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResumeChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(p => [...p, { role:"user", content:userMsg }]);
    try {
      setChatLoading(true);
      const res = await fetch(`${API}/api/ai/refine-resume`, {
        method:  "POST",
        headers: {"Content-Type":"application/json"},
        body:    JSON.stringify({
          currentResume: genResume.tailoredResume,
          instruction:   userMsg,
          jobTitle:      tailorData?.jobTitle,
          company:       tailorData?.company,
        }),
      });
      const d = await res.json();
      if (!res.ok) { toast(d.error||"Chat failed","error"); return; }
      setGenResume(prev => ({...prev, tailoredResume: d.resume}));
      setChatMessages(p => [...p, { role:"assistant", content:"✓ Done! Resume updated based on your request." }]);
    } catch { toast("Chat failed","error"); }
    finally { setChatLoading(false); }
  };
  const handleApply = useCallback((job) => {
  // Save signal to localStorage so the extension knows this tab came from SmartApply
  const signal = {
    jobTitle:    job.title   || "",
    company:     job.company || "",
    jobUrl:      job.url     || "",
    isTailored:  false,          // normal apply — use uploaded resume
    timestamp:   Date.now(),
  };
  localStorage.setItem("smartapply_apply_signal", JSON.stringify(signal));
 
  // Track as pending apply
  setPendingApply(job);
  setShowApplyPopup(false);
 
  // Open the job page — extension will detect the signal automatically
  setTimeout(() => window.open(job.url, "_blank"), 50);
}, []);
  const toggleSkill  = s => setSelSkills(p  => p.includes(s)?p.filter(x=>x!==s):[...p,s]);
  const toggleBullet = b => setSelBullets(p => p.includes(b)?p.filter(x=>x!==b):[...p,b]);
  const saveJob      = useCallback(job => { if (savedJobs.some(j=>j.id===job.id)){toast("Already saved","warning");return;} setSavedJobs(p=>[job,...p]);toast(`Saved: ${job.title}`); }, [savedJobs,toast]);
  const addToTracker = useCallback((job,stage="Applied") => { if(apps[job.id]){toast("Already tracked","warning");return;} setApps(p=>({...p,[job.id]:{stage,notes:"",appliedDate:new Date().toISOString(),job}}));toast(`Tracked as: ${stage}`); }, [apps,toast]);
  const moveStage    = (id,stage) => { setApps(p=>({...p,[id]:{...p[id],stage}}));toast(`Moved to: ${stage}`); };
  const removeApp    = id => { setApps(p=>{const n={...p};delete n[id];return n;});toast("Removed","warning"); };
  const removeSaved  = id => { setSavedJobs(p=>p.filter(j=>j.id!==id));toast("Removed","warning"); };
  const clearFilters = () => { setCountrySearch("");setJobSearch("");setWorkType("all");setJobRange("24h");setSortBy("recommended");setExpFilter("any");setCountrySug([]);setJobSug([]);setVisibleCount(30); };

  const isLocked = (feature) => {
  const lockedForFree = ["auto-apply","ai-tools","tailored"];
  if (userPlan === "free" && lockedForFree.includes(feature)) return true;
  return false;
};

const handleLockedClick = (feature) => {
  setUpgradeFeature(feature);
  setShowUpgradePopup(true);
};
  const timeAgo  = d => { if(!d)return"Unknown"; const ms=Date.now()-new Date(d).getTime(),m=Math.floor(ms/60000),h=Math.floor(ms/3600000),dy=Math.floor(ms/86400000); return m<1?"Just now":m<60?`${m}m ago`:h<24?`${h}h ago`:`${dy}d ago`; };
  const matchLabel = s => s>=80?"Strong":s>=50?"Good":"Fair";
  const matchColor = s => s>=80?T.green:s>=50?T.gold:T.primary;
  const appCount   = Object.keys(apps).length;
  const skillList  = skillsText.split(",").map(s=>s.trim()).filter(Boolean);
  const updEdu = (id,f,v) => setEduList(p=>p.map(e=>e.id===id?{...e,[f]:v}:e));
  const updExp = (id,f,v) => setExpList(p=>p.map(e=>e.id===id?{...e,[f]:v}:e));

  const PH = (crumb, title, sub) => (
    <div style={{ marginBottom:24 }}>
      <p style={{ color:T.primary, fontWeight:700, fontSize:11.5, letterSpacing:".09em", textTransform:"uppercase", marginBottom:5 }}>{crumb}</p>
      <h1 style={{ fontFamily:"'Syne',sans-serif", color:T.text, fontSize:28, margin:0, fontWeight:900 }}>{title}</h1>
      {sub && <p style={{ color:T.muted, marginTop:5, fontSize:15 }}>{sub}</p>}
    </div>
  );

  // Show landing page
  if (showLanding) return <><style>{GCSS}</style><LandingPage onGetStarted={() => setShowLanding(false)} cachedCount={cachedCount}/><ToastContainer toasts={toasts}/></>;

  // ══════════════════════════════════════════════
  // FILTERS
  // ══════════════════════════════════════════════
  const renderFilters = () => (
    <div style={{ display:"grid", gridTemplateColumns:"minmax(170px,1.8fr) minmax(130px,1fr) 110px 110px 122px 122px auto auto", gap:8, background:T.card, border:`1px solid ${T.border}`, padding:"10px 12px", borderRadius:14, marginBottom:14, position:"sticky", top:0, zIndex:20, alignItems:"center", boxShadow:"0 4px 16px rgba(79,70,229,.06)" }}>
      <SuggestBox value={jobSearch} onChange={setJobSearch} suggestions={jobSug} onSelect={s=>{setJobSearch(s);setJobSug([]);}} placeholder="🔍  Roles, skills, companies"/>
      <SuggestBox value={countrySearch} onChange={setCountrySearch} suggestions={countrySug} onSelect={s=>{setCountrySearch(s);setCountrySug([]);}} placeholder="📍  Location"/>
      <select value={workType} onChange={e=>setWorkType(e.target.value)} className="finput" style={{ cursor:"pointer", padding:"9px 10px", fontSize:13 }}><option value="all">All types</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select>
      <select value={expFilter} onChange={e=>setExpFilter(e.target.value)} className="finput" style={{ cursor:"pointer", padding:"9px 10px", fontSize:13, background:expFilter!=="any"?T.goldL:T.card, color:expFilter!=="any"?"#b45309":T.muted, border:`1.5px solid ${expFilter!=="any"?"#fde68a":T.border}`, fontWeight:expFilter!=="any"?700:500 }}><option value="any">🎓 Any Exp.</option><option value="entry">0–2 yrs</option><option value="mid">2–5 yrs</option><option value="senior">5–8 yrs</option><option value="expert">8+ yrs</option></select>
      <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="finput" style={{ cursor:"pointer", padding:"9px 10px", fontSize:13, background:sortBy!=="recent"?T.primaryL:T.card, color:sortBy!=="recent"?T.primary:T.muted, fontWeight:sortBy!=="recent"?700:500, border:`1.5px solid ${sortBy!=="recent"?`${T.primary}60`:T.border}` }}><option value="recommended">⭐ Recommended</option><option value="match">🎯 Top Match</option><option value="recent">🕐 Most Recent</option></select>
      <button className="pbtn" onClick={()=>fetchJobs(true)} style={{ padding:"9px 16px", fontSize:13 }}>{loadingJobs?"⏳":"🔄 Refresh"}</button>
      <button className="gbtn" onClick={clearFilters} style={{ padding:"9px 14px", fontSize:13 }}>Clear</button>
    </div>
  );

  // ══════════════════════════════════════════════
  // PAGE: DASHBOARD
  // ══════════════════════════════════════════════
  const renderDashboard = () => {
    const stageBreakdown = PIPELINE_STAGES.map(stage => ({ stage, count:Object.values(apps).filter(a=>a.stage===stage).length, meta:STAGE_META[stage] }));
    const totalApps  = Object.keys(apps).length;
    const topMatches = allJobs.filter(j=>j.matchScore>=80).slice(0,3);
    const skillSet   = new Set(skillsText.toLowerCase().split(",").map(s=>s.trim()));
    const gaps       = (() => { const missing={}; savedJobs.forEach(job => { const t=(`${job.title} ${job.description||""}`).toLowerCase(); ["python","java","react","node","aws","docker","kubernetes","sql","spark","airflow","tableau","power bi","salesforce","linux","cybersecurity"].forEach(skill => { if(t.includes(skill)&&!skillSet.has(skill))missing[skill]=(missing[skill]||0)+1; }); }); return Object.entries(missing).sort((a,b)=>b[1]-a[1]).slice(0,8); })();

    return (
      <section>
        {PH("Home","Dashboard","Your SmartApply command center.")}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
          {[{label:"Live Jobs",val:allJobs.length,icon:"💼",col:T.primary},{label:"Saved",val:savedJobs.length,icon:"⭐",col:T.gold},{label:"Applications",val:totalApps,icon:"📋",col:"#7c3aed"},{label:"Skills",val:skillList.length,icon:"🛠",col:T.green}].map(({label,val,icon,col})=>(
            <div key={label} style={{ background:T.card, borderRadius:16, padding:"20px 22px", border:`1px solid ${T.border}`, boxShadow:"0 2px 8px rgba(79,70,229,.05)" }}>
              <div style={{ fontSize:24, marginBottom:8 }}>{icon}</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:30, fontWeight:700, color:col, lineHeight:1 }}>{val}</div>
              <div style={{ color:T.muted, fontWeight:600, fontSize:13, marginTop:4 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          <div className="panel">
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, marginBottom:16 }}>Application Pipeline</h2>
            {totalApps===0?(<div style={{ textAlign:"center", padding:20, color:T.muted }}><div style={{ fontSize:30, marginBottom:8 }}>📋</div><p style={{ fontWeight:600, marginBottom:10 }}>No applications tracked yet</p><button className="pbtn" onClick={()=>setActivePage("jobs")} style={{ fontSize:13 }}>Browse Jobs</button></div>):(
              <div style={{ display:"grid", gap:10 }}>
                {stageBreakdown.filter(s=>s.count>0).map(({stage,count,meta})=>(
                  <div key={stage} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ width:90, fontSize:12, fontWeight:700, color:meta.color }}>{meta.emoji} {stage}</span>
                    <div style={{ flex:1, height:8, borderRadius:999, background:meta.bg, overflow:"hidden" }}><div style={{ height:"100%", borderRadius:999, background:meta.color, width:`${Math.max(8,(count/totalApps)*100)}%`, transition:"width .8s" }}/></div>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700, color:meta.color, minWidth:20 }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="panel">
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, marginBottom:16 }}>Resume Status</h2>
            {resumeResult?(<><div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:14 }}><CircularGauge score={resumeResult.atsScore} size={80}/><div><div style={{ fontFamily:"'Syne',sans-serif", fontSize:17, color:T.text, fontWeight:800 }}>{resumeResult.atsScore>=80?"Strong":resumeResult.atsScore>=60?"Good":"Needs Work"}</div><div style={{ color:T.muted, fontSize:13, marginBottom:4 }}>{resumeResult.fileName}</div><div style={{ color:T.primary, fontWeight:700, fontSize:13 }}>{resumeResult.skills?.length} skills detected</div></div></div><ATSBar score={resumeResult.atsScore}/></>):(<div style={{ textAlign:"center", padding:20, color:T.muted }}><div style={{ fontSize:30, marginBottom:8 }}>📄</div><p style={{ fontWeight:600, marginBottom:10 }}>No resume uploaded</p><button className="pbtn" onClick={()=>setActivePage("resume")} style={{ fontSize:13 }}>Upload Resume</button></div>)}
          </div>
        </div>

        {topMatches.length>0&&(<div className="panel" style={{ marginBottom:14 }}><h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, marginBottom:14 }}>🔥 Top Matches</h2><div style={{ display:"grid", gap:10 }}>{topMatches.map(job=>(<div key={job.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px", borderRadius:12, background:T.cardAlt, border:`1px solid ${T.border}` }}><CircularGauge score={job.matchScore} size={52}/><div style={{ flex:1, minWidth:0 }}><div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, color:T.text, fontSize:15, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{job.title}</div><div style={{ color:T.muted, fontSize:13, fontWeight:600 }}>{job.company} · {job.location}</div></div><button className="gbtn" onClick={()=>setActivePage("jobs")} style={{ fontSize:12, padding:"7px 12px" }}>View</button></div>))}</div></div>)}

        <div className="panel"><h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, marginBottom:6 }}>📊 Skill Gaps from Saved Jobs</h2><p style={{ color:T.muted, fontSize:13, marginBottom:14 }}>Skills in your saved jobs that aren't in your profile.</p>{gaps.length===0?(<p style={{ color:T.muted, fontWeight:600 }}>{savedJobs.length===0?"Save some jobs first to see skill gaps.":"Great coverage — no major gaps! 🎉"}</p>):(<div style={{ display:"grid", gap:10 }}>{gaps.map(([skill,count])=>(<div key={skill} style={{ display:"flex", alignItems:"center", gap:10 }}><span style={{ width:130, fontSize:13, fontWeight:700, color:T.text, textTransform:"capitalize" }}>{skill}</span><div style={{ flex:1, height:7, borderRadius:999, background:T.border, overflow:"hidden" }}><div style={{ height:"100%", borderRadius:999, background:T.gold, width:`${Math.min((count/Math.max(savedJobs.length,1))*100,100)}%` }}/></div><span style={{ fontSize:12, color:T.muted, fontWeight:600 }}>{count} job{count!==1?"s":""}</span></div>))}</div>)}</div>
      </section>
    );
  };

  // ══════════════════════════════════════════════
  // PAGE: JOBS
  // ══════════════════════════════════════════════
  const renderJobsPage = () => (
    <section>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, gap:16, flexWrap:"wrap" }}>
        <div>{PH("Dashboard / Jobs","Job Board","Live roles matched to your resume in real-time.")}</div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ padding:"8px 16px", borderRadius:999, fontWeight:700, fontSize:13, background:resumeResult?T.greenL:T.goldL, color:resumeResult?"#065f46":"#78350f", border:`1px solid ${resumeResult?"#6ee7b7":"#fde68a"}` }}>{resumeResult?"✓ Resume Active":"⚠ No Resume"}</div>
          <button className="gbtn" onClick={()=>fetchJobs(true)}>{loadingJobs?"⏳ Refreshing…":"🔄 Refresh"}</button>
        </div>
      </div>
      {!resumeResult&&(<div style={{ padding:14, borderRadius:12, background:T.goldL, border:"1px solid #fde68a", color:"#92400e", fontWeight:600, fontSize:14, marginBottom:14 }}>📄 Upload your resume to unlock match scores and AI features.</div>)}
      {newJobsCount>0&&(<div style={{ padding:"10px 16px", borderRadius:11, background:T.greenL, border:"1px solid #6ee7b7", color:"#065f46", fontWeight:700, marginBottom:14 }}>🔥 {newJobsCount} new job{newJobsCount!==1?"s":""} since your last visit</div>)}
      {renderFilters()}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", color:T.muted, fontSize:13, fontWeight:600, margin:"0 2px 12px" }}>
        <span style={{ display:"flex", alignItems:"center", gap:8 }}><strong style={{ color:T.text }}>{jobs.length < allJobs.length?<>{jobs.length} <span style={{ color:T.muted2 }}>of {allJobs.length}</span></>:jobs.length} jobs</strong>{resumeResult&&<span style={{ padding:"3px 10px", borderRadius:999, fontSize:12, background:T.greenL, color:"#065f46", border:"1px solid #6ee7b7", fontWeight:700 }}>✓ Match scored</span>}</span>
      </div>
      {loadingJobs?(<div style={{ display:"grid", gap:10 }}>{[...Array(5)].map((_,i)=><JobSkeleton key={i}/>)}</div>):jobs.length===0?(<div style={{ padding:50, borderRadius:18, background:T.card, border:`1px solid ${T.border}`, textAlign:"center", color:T.muted }}><div style={{ fontSize:44, marginBottom:12 }}>🔍</div><h3 style={{ fontFamily:"'Syne',sans-serif", color:T.text, marginBottom:8, fontWeight:800 }}>No jobs found</h3><p>Try "All time" or clear the filters.</p><button className="pbtn" onClick={clearFilters} style={{ marginTop:12 }}>Clear Filters</button></div>):(
        <>
          <div style={{ display:"grid", gap:10 }}>
            {jobs.slice(0, visibleCount).map(job => <JobCard key={job.id} job={job} expandedId={expandedId} setExpandedId={setExpandedId} apps={apps} resumeResult={resumeResult} tailoringId={tailoringId} onTailor={handleTailor} onSave={saveJob} onTrack={addToTracker} onApply={handleApply} timeAgo={timeAgo} matchLabel={matchLabel} matchColor={matchColor} isTailorLocked={isLocked("tailored")} onLockedClick={handleLockedClick}/>)}
          </div>
          {visibleCount < jobs.length && (
            <div style={{ textAlign:"center", marginTop:20 }}>
              <button className="gbtn" onClick={() => setVisibleCount(p => p + 30)}
                style={{ padding:"12px 32px", fontSize:14, fontWeight:700, color:T.primary, borderColor:`${T.primary}50` }}>
                Load More Jobs ({jobs.length - visibleCount} remaining)
              </button>
            </div>
          )}
          {visibleCount >= jobs.length && jobs.length > 30 && (
            <div style={{ textAlign:"center", marginTop:16, color:T.muted, fontSize:13, fontWeight:600 }}>
              ✓ All {jobs.length} jobs loaded
            </div>
          )}
        </>
      )}
    </section>
  );

  // ══════════════════════════════════════════════
  // PAGE: AI TOOLS
  // ══════════════════════════════════════════════
  const AI_TABS = [
    { id:"cover-letter", icon:"📝", label:"Cover Letter" },
    { id:"interview",    icon:"🎤", label:"Interview Prep" },
    { id:"explainer",    icon:"📊", label:"Resume Explainer" },
    { id:"job-fit",      icon:"🎯", label:"Job Fit Analysis" },
  ];

  const renderAITools = () => {
    const needResume = !resumeResult?.resumeText;
    const r = aiResult[aiTab] || "";
    const loading = aiLoading[aiTab] || false;

    return (
      <section>
        {PH("Dashboard / AI Tools","AI Career Tools","Powered by Llama 3.1 via Groq — free, fast, genuinely useful.")}
        {needResume&&(<div style={{ padding:14, borderRadius:12, background:T.goldL, border:"1px solid #fde68a", color:"#92400e", fontWeight:600, fontSize:14, marginBottom:18, display:"flex", alignItems:"center", gap:10 }}>⚠ <span>Upload your resume first to get personalized AI results. <button onClick={()=>setActivePage("resume")} style={{ background:"none", border:"none", color:T.primary, fontWeight:800, cursor:"pointer", textDecoration:"underline", fontSize:14 }}>Upload now →</button></span></div>)}

        {/* AI Tab buttons */}
        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          {AI_TABS.map(t => (
            <button key={t.id} onClick={()=>{setAiTab(t.id);}} style={{ padding:"10px 18px", borderRadius:12, border:`1.5px solid ${aiTab===t.id?T.primary:T.border}`, background:aiTab===t.id?T.primaryL:T.card, color:aiTab===t.id?T.primary:T.muted, fontWeight:700, fontSize:14, cursor:"pointer", transition:"all .18s", display:"flex", alignItems:"center", gap:8 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {/* Input panel */}
          <div className="panel">
            <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, marginBottom:16 }}>
              {AI_TABS.find(t=>t.id===aiTab)?.icon} {AI_TABS.find(t=>t.id===aiTab)?.label}
            </h3>

            {(aiTab==="cover-letter"||aiTab==="interview"||aiTab==="job-fit")&&(
              <>
                <label className="fl" style={{ marginBottom:12 }}>Job Title<input value={aiJobTitle} onChange={e=>setAiJobTitle(e.target.value)} placeholder="e.g. Database Administrator" className="finput"/></label>
                <label className="fl" style={{ marginBottom:12 }}>Company<input value={aiCompany} onChange={e=>setAiCompany(e.target.value)} placeholder="e.g. Chipotle" className="finput"/></label>
                <label className="fl" style={{ marginBottom:14 }}>Job Description<textarea value={aiJobDesc} onChange={e=>setAiJobDesc(e.target.value)} placeholder="Paste the full job description here…" style={{ width:"100%", minHeight:140, padding:"11px 14px", borderRadius:10, border:`1.5px solid ${T.border}`, background:T.cardAlt, color:T.text, resize:"vertical", fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, outline:"none", lineHeight:1.6, boxSizing:"border-box" }}/></label>
              </>
            )}

            {aiTab==="explainer"&&(<p style={{ color:T.muted, fontSize:14, marginBottom:14, lineHeight:1.6 }}>This will analyze your uploaded resume and explain your ATS score in plain English with specific improvement advice.</p>)}

            <button className="pbtn" disabled={loading||needResume}
              style={{ width:"100%", padding:"13px" }}
              onClick={() => {
                if (aiTab==="cover-letter") callAI("/api/ai/cover-letter", { resumeText:resumeResult?.resumeText, jobTitle:aiJobTitle, company:aiCompany, jobDescription:aiJobDesc }, aiTab);
                else if (aiTab==="interview") callAI("/api/ai/interview-prep", { resumeText:resumeResult?.resumeText, jobTitle:aiJobTitle, company:aiCompany, jobDescription:aiJobDesc }, aiTab);
                else if (aiTab==="explainer") callAI("/api/ai/resume-explainer", { resumeText:resumeResult?.resumeText, atsScore:resumeResult?.atsScore, matchedSkills:resumeResult?.skills?.slice(0,10), missingSkills:[] }, aiTab);
                else if (aiTab==="job-fit") callAI("/api/ai/job-fit", { resumeText:resumeResult?.resumeText, jobTitle:aiJobTitle, company:aiCompany, jobDescription:aiJobDesc }, aiTab);
              }}>
              {loading?"⏳ Generating…":`✨ Generate ${AI_TABS.find(t=>t.id===aiTab)?.label}`}
            </button>
          </div>

          {/* Output panel */}
          <div className="panel">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800 }}>Result</h3>
              {r&&<button className="gbtn" onClick={()=>{navigator.clipboard.writeText(r);toast("Copied!");}} style={{ fontSize:12, padding:"6px 12px" }}>📋 Copy</button>}
            </div>
            {loading?(<div style={{ display:"flex", flexDirection:"column", gap:10 }}>{[...Array(6)].map((_,i)=><div key={i} className="skeleton" style={{ height:14, width:`${[90,75,85,65,80,55][i]}%` }}/>)}</div>):r?(<>
              <pre style={{ whiteSpace:"pre-wrap", fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:T.text, lineHeight:1.75, margin:0, maxHeight:400, overflowY:"auto" }}>{r}</pre>
              {aiTab === "cover-letter" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:14 }}>
                  <button className="pbtn" style={{ fontSize:13 }}
                    onClick={() => downloadPDF(r, `Cover_Letter_${aiJobTitle || ""}`)}>
                    ⬇ Download PDF
                  </button>
                  <button className="gbtn" style={{ fontSize:13, color:T.primary, borderColor:`${T.primary}50` }}
                    onClick={() => downloadDOCX(r, `Cover_Letter_${aiJobTitle || ""}`)}>
                    ⬇ Download Word
                  </button>
                </div>
              )}
            </>):(<div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}><div style={{ fontSize:44, marginBottom:12 }}>{AI_TABS.find(t=>t.id===aiTab)?.icon}</div><p style={{ fontWeight:600 }}>Your AI result will appear here</p><p style={{ fontSize:13, marginTop:6 }}>Fill in the details and click Generate</p></div>)}
          </div>
        </div>
      </section>
    );
  };

  // ══════════════════════════════════════════════
  // PAGE: RESUME
  // ══════════════════════════════════════════════
  const renderResumePage = () => (
    <section>
      {PH("Dashboard / Resume","Resume Center","Upload once. Powers all matching, tailoring, and AI features.")}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        <div className="panel">
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:6 }}>Upload Resume</h2>
          <p style={{ color:T.muted, fontSize:14, marginBottom:16 }}>PDF or DOCX — extracted and analyzed automatically.</p>
          <div style={{ padding:24, borderRadius:14, background:T.cardAlt, border:`2px dashed ${T.border2}`, marginBottom:14, textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:8 }}>📄</div>
            <input type="file" accept=".pdf,.docx" onChange={e=>setSelFile(e.target.files[0])} style={{ display:"block", margin:"0 auto 10px", color:T.muted }}/>
            {selFile&&<p style={{ color:T.primary, fontWeight:700, fontSize:13 }}>{selFile.name}</p>}
          </div>
          <button className="pbtn" onClick={handleUpload} disabled={uploading} style={{ width:"100%", padding:"13px" }}>{uploading?"⏳ Analyzing…":resumeResult?"🔄 Replace Resume":"🚀 Upload & Analyze"}</button>
          {uploadMsg&&<p style={{ color:T.green, fontWeight:700, marginTop:10, fontSize:14 }}>✓ {uploadMsg}</p>}
        </div>
        <div className="panel">
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:14 }}>ATS Score</h2>
          {resumeResult?(<><div style={{ display:"flex", alignItems:"center", gap:18, marginBottom:18 }}><CircularGauge score={resumeResult.atsScore} size={100}/><div><div style={{ fontSize:13, color:T.muted, fontWeight:600, marginBottom:4 }}>{resumeResult.fileName}</div><div style={{ fontFamily:"'Syne',sans-serif", fontSize:19, fontWeight:800, color:T.text, marginBottom:3 }}>{resumeResult.atsScore>=80?"Strong":resumeResult.atsScore>=60?"Good":"Needs Work"}</div><div style={{ color:T.muted, fontSize:13 }}>{resumeResult.skills?.length} skills detected</div></div></div><ATSBar score={resumeResult.atsScore}/></>):(<div style={{ textAlign:"center", padding:28, color:T.muted }}><div style={{ fontSize:44, marginBottom:12 }}>📊</div><p style={{ fontWeight:600 }}>Upload your resume to see your ATS score</p></div>)}
        </div>
      </div>
      {resumeResult&&(<div className="panel"><h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:14 }}>Skills by Category</h2><div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:10, marginBottom:16 }}>{resumeResult.categories?.map(cat=>(<div key={cat.category} style={{ padding:"12px 14px", borderRadius:12, background:T.cardAlt, border:`1px solid ${T.border}` }}><div style={{ fontSize:12, fontWeight:800, color:T.primary, marginBottom:6, textTransform:"capitalize" }}>{cat.category}</div><div style={{ height:4, borderRadius:999, background:T.border, marginBottom:6 }}><div style={{ height:"100%", borderRadius:999, width:`${Math.min(cat.count*15,100)}%`, background:T.primary }}/></div><div style={{ fontSize:12, color:T.muted }}>{cat.count} skill{cat.count!==1?"s":""}</div></div>))}</div><div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{resumeResult.skills?.map((sk,i)=><span key={i} className="chip vi">{sk}</span>)}</div></div>)}
      <div className="panel"><h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:6 }}>Manual Job Match</h2><p style={{ color:T.muted, fontSize:14, marginBottom:14 }}>Paste any job description to instantly see your compatibility.</p><textarea value={jobDesc} onChange={e=>setJobDesc(e.target.value)} placeholder="Paste the full job description here…" style={{ width:"100%", minHeight:150, padding:14, borderRadius:12, border:`1.5px solid ${T.border}`, background:T.cardAlt, color:T.text, resize:"vertical", marginBottom:12, boxSizing:"border-box", fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:14, outline:"none", lineHeight:1.6 }}/><button className="pbtn" onClick={handleMatch} disabled={matching}>{matching?"⏳ Analyzing…":"🔍 Analyze Match"}</button>
        {matchResult&&(<div style={{ marginTop:16, padding:18, borderRadius:14, background:T.cardAlt, border:`1px solid ${T.border}`, animation:"fadeIn .3s ease" }}><div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12 }}><CircularGauge score={matchResult.matchScore} size={78}/><div><h3 style={{ fontFamily:"'Syne',sans-serif", color:T.text, marginBottom:4, fontWeight:800 }}>Match Analysis</h3><p style={{ color:T.muted, fontSize:14 }}>Keyword & skill alignment</p></div></div><p style={{ fontSize:14, marginBottom:5 }}><strong style={{ color:T.green }}>Matched: </strong><span style={{ color:T.muted }}>{matchResult.matched?.join(", ")||"None"}</span></p><p style={{ fontSize:14, marginBottom:14 }}><strong style={{ color:T.gold }}>Missing: </strong><span style={{ color:T.muted }}>{matchResult.missing?.join(", ")||"None"}</span></p>{matchResult.recommendations?.[0]&&(<div style={{ padding:12, borderRadius:10, background:T.primaryL, border:"1px solid #c7d2fe", color:T.primary, fontWeight:600, fontSize:14 }}>💡 {matchResult.recommendations[0]}</div>)}</div>)}
      </div>
    </section>
  );

  // ══════════════════════════════════════════════
  // PAGE: APPLICATIONS
  // ══════════════════════════════════════════════
  const renderApplicationsPage = () => {
    const list = Object.values(apps);
    return (
      <section>
        {PH("Dashboard / Applications","Application Tracker",`${list.length} application${list.length!==1?"s":""} across your pipeline.`)}
        {list.length===0?(<div style={{ padding:56, borderRadius:18, background:T.card, border:`1px solid ${T.border}`, textAlign:"center", color:T.muted }}><div style={{ fontSize:44, marginBottom:12 }}>📋</div><h3 style={{ fontFamily:"'Syne',sans-serif", color:T.text, marginBottom:8, fontWeight:800 }}>No applications tracked yet</h3><p>Click "+ Track" on any job card.</p></div>):(
          <div style={{ display:"flex", gap:12, overflowX:"auto", overflowY:"visible", paddingBottom:10 }}>
            {PIPELINE_STAGES.map(stage => {
              const meta = STAGE_META[stage];
              const allCount = list.filter(a=>a.stage===stage).length;
              const cols = list.filter(a=>a.stage===stage).filter(a => { const q=(stageSearch[stage]||"").toLowerCase(); return (`${a.job?.title||""} ${a.job?.company||""}`).toLowerCase().includes(q); });
              return (
                <div key={stage} style={{ minWidth:190, overflow:"visible" }}>
                  <div style={{ padding:"12px 14px", borderRadius:12, marginBottom:10, background:meta.bg, border:`1px solid ${meta.border}`, borderTop:`3px solid ${meta.color}` }}>
                    <div style={{ fontWeight:800, color:meta.color, fontSize:13 }}>{meta.emoji} {stage}</div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:24, fontWeight:700, color:meta.color, marginTop:2 }}>{allCount}</div>
                    <input value={stageSearch[stage]||""} onChange={e=>setStageSearch(p=>({...p,[stage]:e.target.value}))} placeholder="Search…" style={{ width:"100%", marginTop:8, padding:"6px 9px", borderRadius:7, border:`1px solid ${meta.border}`, background:"#fff", fontSize:11, outline:"none" }}/>
                  </div>
                  <div style={{ display:"grid", gap:6, overflow:"visible" }}>
                    {cols.map(app => {
                      const jobId = app.job.id, isHov = hoverAppId===jobId;
                      return (
                        <div key={jobId} onMouseEnter={()=>setHoverAppId(jobId)} onMouseLeave={()=>setHoverAppId(null)}
                          style={{ position:"relative", padding:"8px 10px", background:T.card, border:`1px solid ${T.border}`, borderRadius:10, cursor:"pointer", overflow:"visible", zIndex:isHov?999:1, boxShadow:isHov?"0 18px 45px rgba(15,23,42,.15)":"none" }}>
                          <div style={{ fontWeight:800, color:T.text, fontSize:12.5, lineHeight:1.25, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{app.job.title}</div>
                          <div style={{ color:T.muted, fontSize:11.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{app.job.company}</div>
                          {isHov&&(<div style={{ position:"absolute", top:"100%", left:0, width:260, background:"#fff", border:`1px solid ${T.border}`, borderRadius:14, padding:14, marginTop:6, boxShadow:"0 14px 40px rgba(79,70,229,.15)", zIndex:100 }}>
                            <div style={{ fontWeight:800, fontSize:13, color:T.text, marginBottom:3 }}>{app.job.title}</div>
                            <div style={{ fontSize:12, color:T.muted, marginBottom:10 }}>{app.job.company}</div>
                            <textarea value={app.notes||""} onChange={e=>setApps(p=>({...p,[jobId]:{...p[jobId],notes:e.target.value}}))} placeholder="Notes…" style={{ width:"100%", minHeight:56, padding:"8px 10px", borderRadius:9, border:`1px solid ${T.border}`, background:T.cardAlt, fontSize:12, marginBottom:9, resize:"vertical", outline:"none" }}/>
                            <select value={app.stage} onChange={e=>moveStage(jobId,e.target.value)} style={{ width:"100%", padding:"8px 10px", borderRadius:9, border:`1px solid ${T.border}`, background:T.cardAlt, fontSize:12, marginBottom:9 }}>{PIPELINE_STAGES.map(s=><option key={s} value={s}>{s}</option>)}</select>
                            <div style={{ display:"grid", gap:6 }}>
                              <button className="gbtn" onClick={()=>window.open(app.job.url,"_blank")} style={{ padding:"7px", fontSize:12 }}>View Job</button>
                              <button onClick={()=>removeApp(jobId)} style={{ padding:"7px 10px", borderRadius:9, background:T.redL, border:"1px solid #fca5a5", color:T.red, fontWeight:800, cursor:"pointer", fontSize:12 }}>✕ Remove</button>
                            </div>
                          </div>)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  // ══════════════════════════════════════════════
  // PAGE: PROFILE
  // ══════════════════════════════════════════════
  const renderProfilePage = () => (
    <section>
      {PH("Dashboard / Profile","My Profile","Auto-populated from your uploaded resume.")}
      <div className="panel">
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24, paddingBottom:20, borderBottom:`1px solid ${T.border}` }}>
          <div style={{ width:60, height:60, borderRadius:"50%", background:T.grad, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:22, fontWeight:900, fontFamily:"'Syne',sans-serif", boxShadow:"0 4px 16px rgba(79,70,229,.3)", flexShrink:0 }}>{profile.name?.charAt(0)||"U"}</div>
          <div><h2 style={{ margin:0, color:T.text, fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800 }}>{profile.name||"Your Name"}</h2><p style={{ margin:"3px 0 0", color:T.primary, fontWeight:700, fontSize:14 }}>{profile.targetRole||"Target Role"}</p><p style={{ margin:"2px 0 0", color:T.muted, fontSize:13 }}>{profile.location} · {profile.workPreference}</p></div>
        </div>
        <div style={{ display:"flex", gap:6, marginBottom:22, borderBottom:`1px solid ${T.border}`, paddingBottom:14 }}>
          {[["personal","👤 Personal"],["education","🎓 Education"],["experience","💼 Experience"],["skills","🛠 Skills"],["additional","⚡ Auto Apply Info"]].map(([id,label])=>(
            <button key={id} onClick={()=>setProfileTab(id)} style={{ padding:"9px 16px", borderRadius:10, border:"none", fontWeight:700, cursor:"pointer", fontSize:13, transition:"all .15s", background:profileTab===id?T.primary:"transparent", color:profileTab===id?"#fff":T.muted }}>{label}</button>
          ))}
        </div>
        {profileTab==="personal"&&(<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          {[["Full Name","name","text"],["Email","email","email"],["Phone","phone","tel"]].map(([l,k,t])=>(<label key={k} className="fl">{l}<input type={t} value={profile[k]||""} onChange={e=>setProfile({...profile,[k]:e.target.value})} className="finput"/></label>))}
          <label className="fl" style={{ gridColumn:"1/-1" }}>
  Target Roles
  <p style={{ color:T.muted, fontSize:12, margin:"4px 0 8px", fontWeight:500 }}>
    Click a role to select it and customize which specific job titles you want to see
  </p>
  <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:4 }}>
    {JOB_KEYWORDS.map(role => {
      const sel = profile.targetRoles?.includes(role);
      const subCount = targetSubRoles[role]?.length || 0;
      return (
        <div key={role} style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <button type="button"
            onClick={() => {
              if (!sel) {
                setProfile(p => ({...p, targetRoles:[...(p.targetRoles||[]),role]}));
                setTempSubRoles(targetSubRoles[role] || ROLE_SUBROLES[role] || []);
                setSubRolePopup(role);
              } else {
                setProfile(p => ({...p, targetRoles:p.targetRoles.filter(r=>r!==role)}));
              }
            }}
            style={{ padding:"7px 12px", borderRadius:999, border:`1.5px solid ${sel?T.primary:T.border}`, background:sel?T.primary:"#fff", color:sel?"#fff":T.muted, fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            {sel?"✓ ":""}{role}
            {sel && subCount > 0 && (
              <span style={{ background:"rgba(255,255,255,.3)", borderRadius:999, padding:"1px 7px", fontSize:11 }}>
                {subCount}
              </span>
            )}
          </button>
          {sel && (
            <button type="button"
              onClick={() => {
                setTempSubRoles(targetSubRoles[role] || ROLE_SUBROLES[role] || []);
                setSubRolePopup(role);
              }}
              style={{ padding:"3px 10px", borderRadius:999, border:`1px solid ${T.primary}50`, background:T.primaryL, color:T.primary, fontSize:11, fontWeight:700, cursor:"pointer" }}>
              ✏ Edit roles
            </button>
          )}
        </div>
      );
    })}
  </div>
</label>
          <label className="fl">Location
            <select value={profile.location||"United States"} onChange={e=>setProfile({...profile,location:e.target.value})} className="finput" style={{ cursor:"pointer" }}>
              {["United States","Remote - United States","New York, NY","San Francisco, CA","Seattle, WA","Austin, TX","Chicago, IL","Boston, MA","Los Angeles, CA","Denver, CO","Atlanta, GA","Dallas, TX","Washington, DC","Miami, FL","Portland, OR","Nashville, TN","Phoenix, AZ"].map(l=><option key={l}>{l}</option>)}
            </select>
          </label>
          <label className="fl">Work Preference<select value={profile.workPreference} onChange={e=>setProfile({...profile,workPreference:e.target.value})} className="finput" style={{ cursor:"pointer" }}><option>Any</option><option>Remote</option><option>Hybrid</option><option>On-site</option><option>Remote / Hybrid</option></select></label>
        </div>)}
        {profileTab==="education"&&(<div>{eduList.map((edu,idx)=>(<div key={edu.id} className="ecard"><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}><span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15 }}>Education #{idx+1}</span>{eduList.length>1&&<button onClick={()=>setEduList(p=>p.filter(e=>e.id!==edu.id))} style={{ padding:"4px 10px", borderRadius:7, border:"1px solid #fca5a5", background:T.redL, color:T.red, fontWeight:700, cursor:"pointer", fontSize:12 }}>Remove</button>}</div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}><label className="fl">Degree<select value={edu.degree} onChange={e=>updEdu(edu.id,"degree",e.target.value)} className="finput" style={{ cursor:"pointer" }}>{DEGREE_OPTIONS.map(d=><option key={d}>{d}</option>)}</select></label><label className="fl">Field of Study<input value={edu.field} onChange={e=>updEdu(edu.id,"field",e.target.value)} placeholder="e.g. Computer Science" className="finput"/></label><label className="fl" style={{ gridColumn:"1/-1" }}>Institution<input value={edu.institution} onChange={e=>updEdu(edu.id,"institution",e.target.value)} placeholder="e.g. University of Illinois" className="finput"/></label><label className="fl">Start Year<input value={edu.startYear} onChange={e=>updEdu(edu.id,"startYear",e.target.value)} placeholder="2019" className="finput"/></label><label className="fl">End Year<input value={edu.endYear} onChange={e=>updEdu(edu.id,"endYear",e.target.value)} placeholder="2023" className="finput"/></label></div></div>))}<button className="gbtn" onClick={()=>setEduList(p=>[...p,newEdu()])} style={{ color:T.primary, borderColor:`${T.primary}50` }}>+ Add Education</button></div>)}
        {profileTab==="experience"&&(<div>{expList.map((exp,idx)=>(<div key={exp.id} className="ecard"><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}><span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15 }}>Experience #{idx+1}</span>{expList.length>1&&<button onClick={()=>setExpList(p=>p.filter(e=>e.id!==exp.id))} style={{ padding:"4px 10px", borderRadius:7, border:"1px solid #fca5a5", background:T.redL, color:T.red, fontWeight:700, cursor:"pointer", fontSize:12 }}>Remove</button>}</div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}><label className="fl" style={{ gridColumn:"1/-1" }}>Job Title<input value={exp.title} onChange={e=>updExp(exp.id,"title",e.target.value)} placeholder="e.g. Database Administrator" className="finput"/></label><label className="fl" style={{ gridColumn:"1/-1" }}>Company<input value={exp.company} onChange={e=>updExp(exp.id,"company",e.target.value)} placeholder="e.g. Chipotle Mexican Grill" className="finput"/></label><label className="fl">Start Date<input value={exp.startDate} onChange={e=>updExp(exp.id,"startDate",e.target.value)} placeholder="Jan 2022" className="finput"/></label><label className="fl">End Date<input value={exp.endDate} onChange={e=>updExp(exp.id,"endDate",e.target.value)} placeholder="Present" className="finput"/></label><label className="fl" style={{ gridColumn:"1/-1" }}>Key Responsibilities<textarea value={exp.description||""} onChange={e=>updExp(exp.id,"description",e.target.value)} placeholder={"• Optimized SQL queries reducing run time by 40%\n• Maintained 99.9% uptime of production database cluster"} style={{ width:"100%", minHeight:110, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${T.border}`, background:T.card, color:T.text, resize:"vertical", fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, outline:"none", lineHeight:1.6, boxSizing:"border-box" }}/></label></div></div>))}<button className="gbtn" onClick={()=>setExpList(p=>[...p,newExp()])} style={{ color:T.primary, borderColor:`${T.primary}50` }}>+ Add Experience</button></div>)}
        {profileTab==="additional"&&(
  <div>
    <p style={{ color:T.muted, fontSize:14, marginBottom:20, lineHeight:1.7 }}>
      These details are used for auto-filling job applications. 
      Filled once, saved forever.
    </p>

    {/* Work Authorization */}
    <div style={{ marginBottom:20 }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, 
        fontWeight:800, color:T.text, marginBottom:14, 
        paddingBottom:8, borderBottom:`1px solid ${T.border}` }}>
        🇺🇸 Work Authorization
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <label className="fl">Are you authorized to work in the US?
          <select value={profile.workAuth||""} 
            onChange={e=>setProfile({...profile,workAuth:e.target.value})} 
            className="finput" style={{ cursor:"pointer" }}>
            <option value="">Select...</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="fl">Do you require visa sponsorship now?
          <select value={profile.sponsorshipNow||""} 
            onChange={e=>setProfile({...profile,sponsorshipNow:e.target.value})} 
            className="finput" style={{ cursor:"pointer" }}>
            <option value="">Select...</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="fl">Will you require sponsorship in the future?
          <select value={profile.sponsorshipFuture||""} 
            onChange={e=>setProfile({...profile,sponsorshipFuture:e.target.value})} 
            className="finput" style={{ cursor:"pointer" }}>
            <option value="">Select...</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>
    </div>

    {/* Equal Opportunity */}
    <div style={{ marginBottom:20 }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, 
        fontWeight:800, color:T.text, marginBottom:14,
        paddingBottom:8, borderBottom:`1px solid ${T.border}` }}>
        📋 Equal Opportunity Information
      </div>
      <p style={{ color:T.muted, fontSize:13, marginBottom:14, lineHeight:1.6 }}>
        This information is optional and used only for equal opportunity 
        reporting by employers. It does not affect your application.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <label className="fl">Gender
          <select value={profile.gender||""} 
            onChange={e=>setProfile({...profile,gender:e.target.value})} 
            className="finput" style={{ cursor:"pointer" }}>
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="nonbinary">Non-binary</option>
            <option value="other">Other</option>
            <option value="decline">Decline to self-identify</option>
          </select>
        </label>
        <label className="fl">Ethnicity
          <select value={profile.ethnicity||""} 
            onChange={e=>setProfile({...profile,ethnicity:e.target.value})} 
            className="finput" style={{ cursor:"pointer" }}>
            <option value="">Prefer not to say</option>
            <option value="hispanic">Hispanic or Latino</option>
            <option value="asian">Asian</option>
            <option value="black">Black or African American</option>
            <option value="white">White</option>
            <option value="native">American Indian or Alaska Native</option>
            <option value="pacific">Native Hawaiian or Pacific Islander</option>
            <option value="two_or_more">Two or more races</option>
            <option value="decline">Decline to self-identify</option>
          </select>
        </label>
        <label className="fl">Veteran Status
          <select value={profile.veteranStatus||""} 
            onChange={e=>setProfile({...profile,veteranStatus:e.target.value})} 
            className="finput" style={{ cursor:"pointer" }}>
            <option value="">Prefer not to say</option>
            <option value="not_veteran">Not a protected veteran</option>
            <option value="veteran">Protected veteran</option>
            <option value="decline">Decline to self-identify</option>
          </select>
        </label>
        <label className="fl">Disability Status
          <select value={profile.disabilityStatus||""} 
            onChange={e=>setProfile({...profile,disabilityStatus:e.target.value})} 
            className="finput" style={{ cursor:"pointer" }}>
            <option value="">Prefer not to say</option>
            <option value="no">No, I do not have a disability</option>
            <option value="yes">Yes, I have a disability</option>
            <option value="decline">Decline to self-identify</option>
          </select>
        </label>
      </div>
    </div>

    {/* Salary */}
    <div style={{ marginBottom:20 }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, 
        fontWeight:800, color:T.text, marginBottom:14,
        paddingBottom:8, borderBottom:`1px solid ${T.border}` }}>
        💰 Salary Expectations
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <label className="fl">Expected Salary (USD)
          <input 
            type="number"
            value={profile.expectedSalary||""} 
            onChange={e=>setProfile({...profile,expectedSalary:e.target.value})} 
            placeholder="e.g. 95000"
            className="finput"/>
        </label>
        <label className="fl">LinkedIn Profile URL
          <input 
            type="url"
            value={profile.linkedinUrl||""} 
            onChange={e=>setProfile({...profile,linkedinUrl:e.target.value})} 
            placeholder="https://linkedin.com/in/yourname"
            className="finput"/>
        </label>
        <label className="fl" style={{ gridColumn:"1/-1" }}>
          GitHub / Portfolio URL
          <input 
            type="url"
            value={profile.portfolioUrl||""} 
            onChange={e=>setProfile({...profile,portfolioUrl:e.target.value})} 
            placeholder="https://github.com/yourname"
            className="finput"/>
        </label>
      </div>
    </div>

   <div style={{padding:"14px 18px",borderRadius:12,background:profile.workAuth&&profile.sponsorshipNow&&profile.sponsorshipFuture&&profile.expectedSalary?T.greenL:T.goldL,border:"1px solid "+(profile.workAuth&&profile.sponsorshipNow&&profile.sponsorshipFuture&&profile.expectedSalary?"#6ee7b7":"#fde68a"),color:profile.workAuth&&profile.sponsorshipNow&&profile.sponsorshipFuture&&profile.expectedSalary?"#065f46":"#92400e",fontWeight:600,fontSize:14,marginBottom:16}}>
      {profile.workAuth&&profile.sponsorshipNow&&profile.sponsorshipFuture&&profile.expectedSalary?"Profile complete - Auto Apply is ready!":"Complete your profile for Auto Apply to work"}
    </div>
  </div>
)}
        <button className="pbtn" onClick={()=>toast("Profile saved!")} style={{ marginTop:20 }}>💾 Save Profile</button>
      </div>
    </section>
  );

  // ══════════════════════════════════════════════
  // PAGE: SAVED + TAILORED
  // ══════════════════════════════════════════════
  const renderSavedPage = () => (
    <section>
      {PH("Dashboard / Saved","Saved Jobs",`${savedJobs.length} job${savedJobs.length!==1?"s":""} saved.`)}
      {savedJobs.length===0?(<div style={{ padding:56, borderRadius:18, background:T.card, border:`1px solid ${T.border}`, textAlign:"center", color:T.muted }}><div style={{ fontSize:44, marginBottom:12 }}>⭐</div><h3 style={{ fontFamily:"'Syne',sans-serif", color:T.text, marginBottom:8, fontWeight:800 }}>No saved jobs</h3><p>Click "♡ Save" on any listing.</p></div>):(
        <div style={{ display:"grid", gap:12 }}>
          {savedJobs.map(job=>(<div key={job.id} className="panel" style={{ display:"grid", gridTemplateColumns:"50px minmax(0,1fr) auto", gap:16, alignItems:"start", padding:20 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:T.primaryL, border:"1px solid #c7d2fe", color:T.primary, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:14, flexShrink:0 }}>{job.company?.slice(0,2)?.toUpperCase()||"JB"}</div>
            <div>
              <h3 style={{ margin:"0 0 2px", color:T.text, fontSize:16, fontFamily:"'Syne',sans-serif", fontWeight:800 }}>{job.title}</h3>
              <p style={{ margin:"0 0 4px", color:T.muted, fontWeight:600, fontSize:14 }}>{job.company}</p>
              <p style={{ margin:"0 0 12px", color:T.muted, fontSize:13 }}>📍 {job.location}</p>
              <textarea placeholder="Add notes…" value={savedNotes[job.id]||""} onChange={e=>setSavedNotes(p=>({...p,[job.id]:e.target.value}))} style={{ width:"100%", minHeight:56, padding:"9px 11px", borderRadius:9, border:`1px solid ${T.border}`, background:T.cardAlt, color:T.muted, fontSize:13, resize:"vertical", fontFamily:"'Plus Jakarta Sans',sans-serif", outline:"none", marginBottom:10, boxSizing:"border-box" }}/>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <button className="pbtn" onClick={()=>handleApply(job)} style={{ padding:"9px 16px", fontSize:13 }}>Apply Now →</button>
                <button className="gbtn" onClick={()=>addToTracker(job)} style={{ color:T.primary, borderColor:`${T.primary}50` }}>+ Track</button>
                <button className="gbtn" onClick={()=>removeSaved(job.id)} style={{ color:T.red, borderColor:"#fca5a5" }}>Remove</button>
              </div>
            </div>
            {resumeResult&&job.matchScore!==undefined&&<CircularGauge score={job.matchScore} size={70}/>}
          </div>))}
        </div>
      )}
    </section>
  );

  const renderTailoredPage = () => (
    <section>
      {PH("Dashboard / Tailored","Tailored Resumes","Your job-specific resume versions.")}
      {tailoredHist.length===0?(<div style={{ padding:56, borderRadius:18, background:T.card, border:`1px solid ${T.border}`, textAlign:"center", color:T.muted }}><div style={{ fontSize:44, marginBottom:12 }}>✨</div><h3 style={{ fontFamily:"'Syne',sans-serif", color:T.text, marginBottom:8, fontWeight:800 }}>No tailored resumes yet</h3><p>Click "Tailor Resume" on any job listing.</p><button className="pbtn" onClick={()=>setActivePage("jobs")} style={{ marginTop:12 }}>Browse Jobs</button></div>):(
        <div style={{ display:"grid", gap:14 }}>
          {tailoredHist.map(item=>(<div key={item.id} className="panel">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:12 }}>
              <div><h3 style={{ fontFamily:"'Syne',sans-serif", color:T.text, margin:"0 0 3px", fontWeight:800 }}>{item.jobTitle}</h3><p style={{ color:T.muted, fontWeight:600 }}>{item.company}</p></div>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}><div style={{ textAlign:"center" }}><CircularGauge score={item.beforeScore} size={60}/><div style={{ fontSize:11, color:T.muted, marginTop:4 }}>Before</div></div><div style={{ color:T.muted, fontSize:18 }}>→</div><div style={{ textAlign:"center" }}><CircularGauge score={item.afterScore} size={60}/><div style={{ fontSize:11, color:T.muted, marginTop:4 }}>After</div></div></div>
            </div>
            <pre style={{ whiteSpace:"pre-wrap", background:T.cardAlt, border:`1px solid ${T.border}`, borderRadius:12, padding:14, maxHeight:260, overflowY:"auto", color:T.text, lineHeight:1.65, fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13 }}>{item.tailoredResume}</pre>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginTop:12 }}>
              <button className="gbtn" onClick={()=>{navigator.clipboard.writeText(item.tailoredResume);toast("Copied!");}}>📋 Copy</button>
              <button className="pbtn" style={{ fontSize:12 }} onClick={() => downloadPDF(item.tailoredResume, item.jobTitle)}>⬇ PDF</button>
              <button className="gbtn" style={{ fontSize:12, color:T.primary, borderColor:`${T.primary}50` }} onClick={() => downloadDOCX(item.tailoredResume, item.jobTitle)}>⬇ Word</button>
              <button onClick={() => { setTailoredHist(p => p.filter(h => h.id !== item.id)); toast("Deleted","warning"); }}
                style={{ padding:"9px 16px", borderRadius:10, border:"1px solid #fca5a5", background:T.redL, color:T.red, fontWeight:700, cursor:"pointer", fontSize:12 }}>
                🗑 Delete
              </button>
            </div>
          </div>))}
        </div>
      )}
    </section>
  );

 const renderTailorPanel = () => {
    if (!showTailor) return null;
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(30,27,75,.35)", display:"flex", justifyContent:"flex-end", zIndex:1000, backdropFilter:"blur(6px)", animation:"fadeIn .22s ease" }}>
        <div style={{ width:"56%", maxWidth:800, minWidth:500, height:"100vh", background:T.card, overflowY:"auto", boxShadow:"-6px 0 40px rgba(79,70,229,.15), inset 1px 0 0 #E8E8F0" }}>
          <div style={{ padding:"20px 24px", borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, background:T.card, zIndex:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <h2 style={{ fontFamily:"'Syne',sans-serif", color:T.text, margin:"0 0 3px", fontSize:20, fontWeight:900 }}>✨ Tailor Resume</h2>
                <p style={{ color:T.primary, fontWeight:700, margin:0, fontSize:14 }}>{tailorData?.jobTitle} · {tailorData?.company}</p>
              </div>
              <button onClick={() => setShowTailor(false)} style={{ width:34, height:34, borderRadius:"50%", border:"none", background:T.redL, color:T.red, fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, flexShrink:0 }}>×</button>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:14, flexWrap:"wrap" }}>
              <button className="gbtn" style={{ fontSize:12 }} onClick={() => { setSelSkills(tailorData?.missingSkills||[]); setSelBullets(tailorData?.bulletSuggestions||[]); }}>Select All</button>
              <button className="gbtn" style={{ fontSize:12 }} onClick={() => { setSelSkills([]); setSelBullets([]); }}>Clear All</button>
              <button className="pbtn" onClick={handleGenerate} disabled={generating}>{generating ? "⏳ Generating…" : "🚀 Generate Resume"}</button>
            </div>
          </div>
          <div style={{ padding:"22px 24px" }}>
            {tailorData && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
                <div style={{ padding:16, borderRadius:14, background:T.cardAlt, border:`1px solid ${T.border}`, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:36, fontWeight:900, color:T.primary, lineHeight:1 }}>
                    {parseFloat((tailorData.currentScore / 10).toFixed(1))}
                  </div>
                  <div style={{ fontSize:10, color:T.muted2, fontWeight:700 }}>OUT OF 10</div>
                  <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>Current Match</div>
                  <div style={{ fontSize:11, fontWeight:700, color: (tailorData.currentScore/10) >= 7 ? T.green : (tailorData.currentScore/10) >= 5 ? T.gold : T.red }}>
                    {(tailorData.currentScore/10) >= 7 ? "Strong" : (tailorData.currentScore/10) >= 5 ? "Good" : "Needs Work"}
                  </div>
                </div>
                <div style={{ padding:16, borderRadius:14, background:T.cardAlt, border:`1px solid ${T.border}` }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:26, fontWeight:700, color:T.primary }}>{tailorData.resumeStrengths?.length || 0}</div>
                  <div style={{ fontSize:12, color:T.muted, marginBottom:14 }}>Strong points</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:26, fontWeight:700, color:T.gold }}>{tailorData.missingSkills?.length || 0}</div>
                  <div style={{ fontSize:12, color:T.muted }}>Gaps to address</div>
                </div>
              </div>
            )}
            <SL>✅ Already Matched</SL>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
              {tailorData?.matchedSkills?.length
                ? tailorData.matchedSkills.map((sk, i) => <span key={i} className="chip ok">{sk}</span>)
                : <span style={{ color:T.muted, fontSize:13 }}>None detected yet</span>}
            </div>
            <SL>⚡ Missing Skills — Click to Select</SL>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
              {tailorData?.missingSkills?.map((sk, i) => {
                const on = selSkills.includes(sk);
                return (
                  <button key={i} onClick={() => toggleSkill(sk)} style={{ padding:"7px 13px", borderRadius:999, border:"none", background:on ? T.primary : T.primaryL, color:on ? "#fff" : T.primary, fontWeight:700, cursor:"pointer", fontSize:12, boxShadow:on ? "0 2px 8px rgba(79,70,229,.25)" : "none", transition:"all .15s" }}>
                    {on ? "✓ " : ""}{sk}
                  </button>
                );
              })}
            </div>
            <SL>💡 ATS Improvement Tips</SL>
            <div style={{ padding:14, borderRadius:12, background:T.cardAlt, border:`1px solid ${T.border}`, marginBottom:20 }}>
              <ul style={{ margin:0, paddingLeft:18, color:T.muted, lineHeight:1.85, fontSize:14 }}>
                {tailorData?.improvementSuggestions?.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            </div>
            <SL>📝 Suggested Bullets — Check to Include</SL>
            <div style={{ display:"grid", gap:8, marginBottom:24 }}>
              {tailorData?.bulletSuggestions?.map((b, i) => {
                const on = selBullets.includes(b);
                return (
                  <label key={i} onClick={() => toggleBullet(b)} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", borderRadius:11, cursor:"pointer", border:`1.5px solid ${on ? T.primary + "60" : T.border}`, background:on ? T.primaryL : T.cardAlt, lineHeight:1.6, fontSize:13, color:on ? T.text : T.muted, transition:"all .15s" }}>
                    <input type="checkbox" checked={on} readOnly style={{ marginTop:2, accentColor:T.primary, flexShrink:0 }}/>
                    {b}
                  </label>
                );
              })}
            </div>
            {genResume && (
              <div style={{ animation:"fadeIn .3s ease" }}>
                <h3 style={{ fontFamily:"'Syne',sans-serif", margin:"0 0 6px", color:T.text, fontWeight:800, fontSize:18 }}>🎉 Your Tailored Resume</h3>

               {/* Score comparison */}
                <div style={{ display:"flex", gap:14, marginBottom:16, alignItems:"center" }}>
                  <div style={{ textAlign:"center", padding:"14px 20px", borderRadius:14, background:T.cardAlt, border:`1px solid ${T.border}`, minWidth:90 }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:28, fontWeight:900, color:T.primary, lineHeight:1 }}>{genResume.beforeScore}</div>
                    <div style={{ fontSize:10, color:T.muted2, fontWeight:700, marginTop:2 }}>OUT OF 10</div>
                    <div style={{ fontSize:11, color:T.muted, fontWeight:600, marginTop:4 }}>Before</div>
                    <div style={{ fontSize:11, fontWeight:700, marginTop:2, color: genResume.beforeScore >= 7 ? T.green : genResume.beforeScore >= 5 ? T.gold : T.red }}>
                      {genResume.beforeScore >= 7 ? "Strong" : genResume.beforeScore >= 5 ? "Good" : "Needs Work"}
                    </div>
                  </div>
                  <div style={{ color:T.muted, fontSize:22, fontWeight:900 }}>→</div>
                  <div style={{ textAlign:"center", padding:"14px 20px", borderRadius:14, background:T.greenL, border:"1px solid #6ee7b7", minWidth:90 }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:28, fontWeight:900, color:T.green, lineHeight:1 }}>{genResume.afterScore}</div>
                    <div style={{ fontSize:10, color:T.muted2, fontWeight:700, marginTop:2 }}>OUT OF 10</div>
                    <div style={{ fontSize:11, color:T.muted, fontWeight:600, marginTop:4 }}>After</div>
                    <div style={{ fontSize:11, fontWeight:700, marginTop:2, color: genResume.afterScore >= 7 ? T.green : genResume.afterScore >= 5 ? T.gold : T.red }}>
                      {genResume.afterScore >= 7 ? "Strong" : genResume.afterScore >= 5 ? "Good" : "Needs Work"}
                    </div>
                  </div>
                  <div style={{ flex:1, padding:"10px 14px", borderRadius:10, background:T.greenL, border:"1px solid #6ee7b7", fontSize:13, color:"#065f46", fontWeight:600 }}>
                    ✓ Resume scored by AI against the job description. Edit anything using the chat.
                    {genResume.afterScore > genResume.beforeScore && (
                      <div style={{ marginTop:6, fontSize:12, color:T.green, fontWeight:800 }}>
                        ↑ Improved by {(genResume.afterScore - genResume.beforeScore).toFixed(1)} points
                      </div>
                    )}
                  </div>
                </div>

                {/* Resume + Chat side by side */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>

                  {/* Resume preview */}
                  <div>
                    <div style={{ fontWeight:700, fontSize:13, color:T.muted, marginBottom:8 }}>📄 Tailored Resume</div>
                    <pre style={{ whiteSpace:"pre-wrap", background:T.cardAlt, border:`1px solid ${T.border}`,
                      borderRadius:12, padding:14, height:380, overflowY:"auto",
                      color:T.text, lineHeight:1.7, fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:12, margin:0 }}>
                      {genResume.tailoredResume}
                    </pre>

                    {/* Download buttons */}
<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:10 }}>
  <button className="gbtn"
    onClick={() => { navigator.clipboard.writeText(genResume.tailoredResume); toast("Copied!"); }}
    style={{ fontSize:12, padding:"9px 8px" }}>
    📋 Copy
  </button>
  <button className="pbtn"
    onClick={() => downloadPDF(genResume.tailoredResume, tailorData?.jobTitle)}
    style={{ fontSize:12, padding:"9px 8px" }}
    title="Opens print dialog — select Save as PDF">
    ⬇ Save as PDF
  </button>
  <button className="gbtn"
    onClick={() => downloadDOCX(genResume.tailoredResume, tailorData?.jobTitle)}
    style={{ fontSize:12, padding:"9px 8px", color:T.primary, borderColor:`${T.primary}50` }}>
    ⬇ Word
  </button>
</div>

{/* Continue to Apply button */}
<button
 onClick={() => {
  const signal = {
    jobTitle:       tailorData?.jobTitle || "",
    company:        tailorData?.company  || "",
    jobUrl:         tailorData?.jobUrl   || "",
    isTailored:     true,
    tailoredResume: genResume.tailoredResume,
    coverLetter:    genResume.coverLetter || "",
    timestamp:      Date.now(),
  };
  localStorage.setItem("smartapply_apply_signal", JSON.stringify(signal));
 
  toast("Resume ready! Opening job page...", "success");
 
  if (tailorData?.jobUrl) {
    setPendingApply({
      id:      `tailor-${Date.now()}`,
      title:   tailorData?.jobTitle,
      company: tailorData?.company,
      url:     tailorData?.jobUrl,
    });
    window.open(tailorData.jobUrl, "_blank");
  } else {
    toast("No job URL found. Please apply manually.", "warning");
  }
  setShowTailor(false);
}}
  style={{
    width:"100%", marginTop:12, padding:"13px",
    borderRadius:12, border:"none", cursor:"pointer",
    background:"linear-gradient(135deg, #059669, #047857)",
    color:"#fff", fontWeight:800, fontSize:15,
    fontFamily:"'Plus Jakarta Sans',sans-serif",
    boxShadow:"0 4px 14px rgba(5,150,105,.3)",
    display:"flex", alignItems:"center",
    justifyContent:"center", gap:10,
    transition:"all .18s"
  }}
  onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
  onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
  🚀 Continue to Apply
  <span style={{ fontSize:12, opacity:0.8, fontWeight:600 }}>
    — Extension will auto-fill
  </span>
</button>

                  </div>

                  {/* Chat box */}
                  <div style={{ display:"flex", flexDirection:"column", background:T.cardAlt,
                    border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden", height:430 }}>

                    <div style={{ padding:"12px 14px", borderBottom:`1px solid ${T.border}`,
                      fontWeight:800, fontSize:14, color:T.text, background:T.card }}>
                      💬 Refine With AI Chat
                    </div>

                    {/* Messages */}
                    <div style={{ flex:1, overflowY:"auto", padding:12, display:"flex", flexDirection:"column", gap:8 }}>
                      {chatMessages.length === 0 && (
                        <div style={{ color:T.muted, fontSize:13, textAlign:"center", marginTop:30 }}>
                          <div style={{ fontSize:30, marginBottom:10 }}>🤖</div>
                          <p style={{ fontWeight:600 }}>Resume is ready!</p>
                          <p style={{ marginTop:6, fontSize:12, lineHeight:1.6 }}>
                            Don't like something? Just tell me.<br/>
                            <span style={{ color:T.primary }}>"Make the summary shorter"</span><br/>
                            <span style={{ color:T.primary }}>"Add more SQL keywords"</span><br/>
                            <span style={{ color:T.primary }}>"Improve the third bullet point"</span>
                          </p>
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div key={i} style={{
                          padding:"9px 12px", borderRadius:10, fontSize:13, lineHeight:1.6,
                          background: msg.role === "user" ? T.primaryL : T.card,
                          color:      msg.role === "user" ? T.primary   : T.text,
                          alignSelf:  msg.role === "user" ? "flex-end"  : "flex-start",
                          maxWidth: "88%",
                          border: `1px solid ${msg.role === "user" ? "#c7d2fe" : T.border}`,
                        }}>
                          {msg.content}
                        </div>
                      ))}
                      {chatLoading && (
                        <div style={{ padding:"9px 12px", borderRadius:10, fontSize:13,
                          background:T.card, color:T.muted, alignSelf:"flex-start",
                          border:`1px solid ${T.border}`, animation:"pulse 1.4s infinite" }}>
                          ⏳ Updating your resume...
                        </div>
                      )}
                    </div>

                    {/* Input */}
                    <div style={{ padding:10, borderTop:`1px solid ${T.border}`, display:"flex", gap:8, background:T.card }}>
                      <input
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !chatLoading) handleResumeChat(); }}
                        placeholder="e.g. Make the summary shorter..."
                        style={{ flex:1, padding:"9px 12px", borderRadius:9,
                          border:`1.5px solid ${T.border}`, fontSize:13, outline:"none",
                          fontFamily:"'Plus Jakarta Sans',sans-serif",
                          transition:"border-color .15s" }}
                        onFocus={e => e.target.style.borderColor = T.primary}
                        onBlur={e  => e.target.style.borderColor = T.border}
                      />
                      <button className="pbtn" onClick={handleResumeChat} disabled={chatLoading}
                        style={{ padding:"9px 16px", fontSize:13 }}>
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSubRolePopup = () => {
  if (!subRolePopup) return null;
  const subroles = ROLE_SUBROLES[subRolePopup] || [];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(30,27,75,.45)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
      <div style={{ background:"#fff", width:560, maxHeight:"80vh", borderRadius:24, padding:28, boxShadow:"0 28px 80px rgba(79,70,229,.2)", border:`1px solid ${T.border}`, display:"flex", flexDirection:"column", gap:16, animation:"fadeUp .25s ease" }}>
        
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:900, color:T.text, margin:0 }}>
              {subRolePopup}
            </h2>
            <p style={{ color:T.muted, fontSize:13, margin:"4px 0 0" }}>
              Select the specific roles you want to see jobs for
            </p>
          </div>
          <button onClick={() => setSubRolePopup(null)}
            style={{ width:34, height:34, borderRadius:"50%", border:"none", background:T.redL, color:T.red, fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900 }}>
            ×
          </button>
        </div>

        {/* Quick actions */}
        <div style={{ display:"flex", gap:8 }}>
          <button className="gbtn" style={{ fontSize:12, padding:"6px 12px" }}
            onClick={() => setTempSubRoles(subroles)}>
            Select All
          </button>
          <button className="gbtn" style={{ fontSize:12, padding:"6px 12px" }}
            onClick={() => setTempSubRoles([])}>
            Clear All
          </button>
          <span style={{ color:T.muted, fontSize:13, fontWeight:600, alignSelf:"center" }}>
            {tempSubRoles.length} selected
          </span>
        </div>

        {/* Sub-roles grid */}
        <div style={{ overflowY:"auto", flex:1 }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {subroles.map((role, i) => {
              const selected = tempSubRoles.includes(role);
              return (
                <button key={i}
                  onClick={() => setTempSubRoles(p => selected ? p.filter(r => r !== role) : [...p, role])}
                  style={{ padding:"8px 14px", borderRadius:999, border:`1.5px solid ${selected ? T.primary : T.border}`, background: selected ? T.primary : T.card, color: selected ? "#fff" : T.muted, fontWeight:700, cursor:"pointer", fontSize:13, transition:"all .15s" }}>
                  {selected ? "✓ " : ""}{role}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save button */}
        <div style={{ display:"flex", gap:10 }}>
          <button className="pbtn" style={{ flex:1, padding:"13px" }}
            onClick={() => {
              setTargetSubRoles(p => ({ ...p, [subRolePopup]: tempSubRoles }));
              setSubRolePopup(null);
              toast(`Saved ${tempSubRoles.length} roles for ${subRolePopup} ✓`);
            }}>
            Save Selection
          </button>
          <button className="gbtn" style={{ padding:"13px 20px" }}
            onClick={() => setSubRolePopup(null)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
const renderOnboarding = () => {
  const steps = [
    { n: 1, label: "Personal Info" },
    { n: 2, label: "Resume" },
    { n: 3, label: "Target Roles" },
    { n: 4, label: "Auto Apply Info" },
  ];

  const updateOnboard = (key, val) => setOnboardData(p => ({ ...p, [key]: val }));

  const canProceed = () => {
    if (onboardStep === 1) return onboardData.firstName?.trim() && onboardData.lastName?.trim() && onboardData.email?.trim();
    if (onboardStep === 2) return resumeResult !== null;
    if (onboardStep === 3) return (onboardData.selectedRoles || []).length > 0;
    if (onboardStep === 4) return onboardData.workAuth?.trim();
    return true;
  };

  const handleComplete = () => {
    // Save all onboarding data to profile
    setProfile(p => ({
      ...p,
      name: `${onboardData.firstName || ""} ${onboardData.lastName || ""}`.trim(),
      email: onboardData.email || p.email,
      phone: onboardData.phone || p.phone,
      location: onboardData.location || p.location || "United States",
      workPreference: onboardData.workPreference || p.workPreference || "Remote / Hybrid",
      targetRoles: onboardData.selectedRoles || [],
      workAuth: onboardData.workAuth || "",
      sponsorshipNow: onboardData.sponsorshipNow || "",
      sponsorshipFuture: onboardData.sponsorshipFuture || "",
      expectedSalary: onboardData.expectedSalary || "",
      linkedinUrl: onboardData.linkedinUrl || "",
      portfolioUrl: onboardData.portfolioUrl || "",
      gender: onboardData.gender || "",
      ethnicity: onboardData.ethnicity || "",
      veteranStatus: onboardData.veteranStatus || "",
      disabilityStatus: onboardData.disabilityStatus || "",
    }));
    setOnboardingDone(true);
    setActivePage("dashboard");
    toast("Welcome to SmartApply! 🎉");
  };

  return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse 80% 50% at 50% -10%, #EEF2FF 0%, #F7F7FF 70%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <style>{GCSS}</style>
      <div style={{ width:"100%", maxWidth:560 }}>

        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"center", marginBottom:32 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:T.grad, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:18, fontFamily:"'Syne',sans-serif", boxShadow:"0 4px 12px rgba(79,70,229,.3)" }}>S</div>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:24, color:T.text }}>SmartApply</span>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom:28 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
            {steps.map(s => (
              <div key={s.n} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, flex:1 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background: onboardStep > s.n ? T.green : onboardStep === s.n ? T.primary : T.border, color: onboardStep >= s.n ? "#fff" : T.muted, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, transition:"all .3s" }}>
                  {onboardStep > s.n ? "✓" : s.n}
                </div>
                <span style={{ fontSize:11, fontWeight:700, color: onboardStep === s.n ? T.primary : T.muted2, textAlign:"center" }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={{ height:4, borderRadius:999, background:T.border, overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:999, background:T.grad, width:`${((onboardStep-1)/3)*100}%`, transition:"width .4s ease" }}/>
          </div>
        </div>

        {/* Card */}
        <div style={{ background:T.card, borderRadius:24, padding:32, border:`1px solid ${T.border}`, boxShadow:"0 8px 32px rgba(79,70,229,.08)", animation:"fadeUp .3s ease" }}>

          {/* Step 1 — Personal Info */}
          {onboardStep === 1 && (
            <div>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:900, color:T.text, marginBottom:6 }}>Welcome! Tell us about yourself</h2>
              <p style={{ color:T.muted, fontSize:14, marginBottom:24 }}>This helps us personalize your job search experience.</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <label className="fl">First Name *
                  <input value={onboardData.firstName||""} onChange={e=>updateOnboard("firstName",e.target.value)} placeholder="John" className="finput"/>
                </label>
                <label className="fl">Last Name *
                  <input value={onboardData.lastName||""} onChange={e=>updateOnboard("lastName",e.target.value)} placeholder="Doe" className="finput"/>
                </label>
                <label className="fl" style={{ gridColumn:"1/-1" }}>Email Address *
                  <input type="email" value={onboardData.email||""} onChange={e=>updateOnboard("email",e.target.value)} placeholder="john@example.com" className="finput"/>
                </label>
                <label className="fl" style={{ gridColumn:"1/-1" }}>Phone Number
                  <input type="tel" value={onboardData.phone||""} onChange={e=>updateOnboard("phone",e.target.value)} placeholder="+1 (555) 000-0000" className="finput"/>
                </label>
                <label className="fl">Location
                  <select value={onboardData.location||"United States"} onChange={e=>updateOnboard("location",e.target.value)} className="finput" style={{ cursor:"pointer" }}>
                    {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="fl">Work Preference
                  <select value={onboardData.workPreference||"Remote / Hybrid"} onChange={e=>updateOnboard("workPreference",e.target.value)} className="finput" style={{ cursor:"pointer" }}>
                    <option>Any</option>
<option>Remote</option>
<option>Hybrid</option>
<option>On-site</option>
<option>Remote / Hybrid</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* Step 2 — Resume Upload */}
          {onboardStep === 2 && (
            <div>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:900, color:T.text, marginBottom:6 }}>Upload Your Resume</h2>
              <p style={{ color:T.muted, fontSize:14, marginBottom:24 }}>We'll extract your skills automatically and use them to match you with the best jobs.</p>

              {!resumeResult ? (
                <div style={{ padding:32, borderRadius:16, background:T.cardAlt, border:`2px dashed ${T.border2}`, textAlign:"center", marginBottom:16 }}>
                  <div style={{ fontSize:44, marginBottom:12 }}>📄</div>
                  <p style={{ color:T.muted, fontWeight:600, marginBottom:16 }}>PDF or DOCX — max 5MB</p>
                  <input type="file" accept=".pdf,.docx" onChange={e=>setSelFile(e.target.files[0])} style={{ display:"block", margin:"0 auto 16px", color:T.muted }}/>
                  {selFile && <p style={{ color:T.primary, fontWeight:700, fontSize:13, marginBottom:16 }}>📎 {selFile.name}</p>}
                  <button className="pbtn" onClick={handleUpload} disabled={!selFile||uploading} style={{ width:"100%" }}>
                    {uploading ? "⏳ Analyzing…" : "🚀 Upload & Analyze Resume"}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ padding:16, borderRadius:14, background:T.greenL, border:"1px solid #6ee7b7", marginBottom:16, display:"flex", alignItems:"center", gap:14 }}>
                    <CircularGauge score={resumeResult.atsScore} size={70}/>
                    <div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, color:T.text, fontSize:16 }}>Resume Analyzed!</div>
                      <div style={{ color:T.green, fontWeight:700, fontSize:13 }}>{resumeResult.skills?.length} skills detected</div>
                      <div style={{ color:T.muted, fontSize:12 }}>{resumeResult.fileName}</div>
                    </div>
                  </div>

                  {/* Skills display */}
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:T.muted, marginBottom:8 }}>Detected Skills:</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, maxHeight:120, overflowY:"auto" }}>
                      {resumeResult.skills?.map((sk,i) => <span key={i} className="chip vi">{sk}</span>)}
                    </div>
                  </div>

                  {/* Add more skills */}
                  <div>
                    <div style={{ fontWeight:700, fontSize:13, color:T.muted, marginBottom:8 }}>Add more skills (optional):</div>
                    <input
                      placeholder="Type a skill and press Enter e.g. React, Python..."
                      className="finput"
                      onKeyDown={e => {
                        if (e.key === "Enter" && e.target.value.trim()) {
                          setSkillsText(p => p ? `${p}, ${e.target.value.trim()}` : e.target.value.trim());
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>

                  <button className="gbtn" style={{ marginTop:12, fontSize:12, color:T.muted }}
                    onClick={() => { setResumeResult(null); setSelFile(null); }}>
                    ↩ Upload different resume
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Target Roles */}
          {onboardStep === 3 && (
            <div>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:900, color:T.text, marginBottom:6 }}>What roles are you targeting?</h2>
              <p style={{ color:T.muted, fontSize:14, marginBottom:20 }}>Select all that apply. Click a role to customize specific job titles.</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, maxHeight:320, overflowY:"auto" }}>
                {JOB_KEYWORDS.map(role => {
                  const sel = (onboardData.selectedRoles||[]).includes(role);
                  const subCount = targetSubRoles[role]?.length || 0;
                  return (
                    <div key={role} style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      <button type="button"
                        onClick={() => {
                          const current = onboardData.selectedRoles || [];
                          if (!sel) {
                            updateOnboard("selectedRoles", [...current, role]);
                            setTempSubRoles(targetSubRoles[role] || ROLE_SUBROLES[role] || []);
                            setSubRolePopup(role);
                          } else {
                            updateOnboard("selectedRoles", current.filter(r => r !== role));
                          }
                        }}
                        style={{ padding:"8px 14px", borderRadius:999, border:`1.5px solid ${sel?T.primary:T.border}`, background:sel?T.primary:"#fff", color:sel?"#fff":T.muted, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                        {sel ? "✓ " : ""}{role}
                        {sel && subCount > 0 && <span style={{ background:"rgba(255,255,255,.3)", borderRadius:999, padding:"1px 7px", fontSize:11 }}>{subCount}</span>}
                      </button>
                      {sel && (
                        <button type="button"
                          onClick={() => { setTempSubRoles(targetSubRoles[role] || ROLE_SUBROLES[role] || []); setSubRolePopup(role); }}
                          style={{ padding:"3px 10px", borderRadius:999, border:`1px solid ${T.primary}50`, background:T.primaryL, color:T.primary, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                          ✏ Edit roles
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {(onboardData.selectedRoles||[]).length === 0 && (
                <p style={{ color:T.red, fontSize:12, fontWeight:600, marginTop:12 }}>⚠ Please select at least one role to continue</p>
              )}
            </div>
          )}

          {/* Step 4 — Auto Apply Info */}
          {onboardStep === 4 && (
            <div>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:900, color:T.text, marginBottom:6 }}>Auto Apply Information</h2>
              <p style={{ color:T.muted, fontSize:14, marginBottom:20 }}>Used to auto-fill job applications. Saved securely on your device only.</p>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <label className="fl" style={{ gridColumn:"1/-1" }}>Are you authorized to work in the US? *
                  <select value={onboardData.workAuth||""} onChange={e=>updateOnboard("workAuth",e.target.value)} className="finput" style={{ cursor:"pointer" }}>
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className="fl">Require sponsorship now?
                  <select value={onboardData.sponsorshipNow||""} onChange={e=>updateOnboard("sponsorshipNow",e.target.value)} className="finput" style={{ cursor:"pointer" }}>
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className="fl">Sponsorship in future?
                  <select value={onboardData.sponsorshipFuture||""} onChange={e=>updateOnboard("sponsorshipFuture",e.target.value)} className="finput" style={{ cursor:"pointer" }}>
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className="fl">Expected Salary (USD)
                  <input type="number" value={onboardData.expectedSalary||""} onChange={e=>updateOnboard("expectedSalary",e.target.value)} placeholder="e.g. 95000" className="finput"/>
                </label>
                <label className="fl">Gender
                  <select value={onboardData.gender||""} onChange={e=>updateOnboard("gender",e.target.value)} className="finput" style={{ cursor:"pointer" }}>
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="nonbinary">Non-binary</option>
                    <option value="decline">Decline to self-identify</option>
                  </select>
                </label>
                <label className="fl">Ethnicity
                  <select value={onboardData.ethnicity||""} onChange={e=>updateOnboard("ethnicity",e.target.value)} className="finput" style={{ cursor:"pointer" }}>
                    <option value="">Prefer not to say</option>
                    <option value="hispanic">Hispanic or Latino</option>
                    <option value="asian">Asian</option>
                    <option value="black">Black or African American</option>
                    <option value="white">White</option>
                    <option value="two_or_more">Two or more races</option>
                    <option value="decline">Decline to self-identify</option>
                  </select>
                </label>
                <label className="fl">Veteran Status
                  <select value={onboardData.veteranStatus||""} onChange={e=>updateOnboard("veteranStatus",e.target.value)} className="finput" style={{ cursor:"pointer" }}>
                    <option value="">Prefer not to say</option>
                    <option value="not_veteran">Not a protected veteran</option>
                    <option value="veteran">Protected veteran</option>
                    <option value="decline">Decline to self-identify</option>
                  </select>
                </label>
                <label className="fl">Disability Status
                  <select value={onboardData.disabilityStatus||""} onChange={e=>updateOnboard("disabilityStatus",e.target.value)} className="finput" style={{ cursor:"pointer" }}>
                    <option value="">Prefer not to say</option>
                    <option value="no">No disability</option>
                    <option value="yes">Yes, I have a disability</option>
                    <option value="decline">Decline to self-identify</option>
                  </select>
                </label>
                <label className="fl" style={{ gridColumn:"1/-1" }}>LinkedIn URL
                  <input type="url" value={onboardData.linkedinUrl||""} onChange={e=>updateOnboard("linkedinUrl",e.target.value)} placeholder="https://linkedin.com/in/yourname" className="finput"/>
                </label>
                <label className="fl" style={{ gridColumn:"1/-1" }}>GitHub / Portfolio URL
                  <input type="url" value={onboardData.portfolioUrl||""} onChange={e=>updateOnboard("portfolioUrl",e.target.value)} placeholder="https://github.com/yourname" className="finput"/>
                </label>
              </div>

              {/* Info banner */}
              <div style={{ marginTop:16, padding:"12px 16px", borderRadius:12, background:T.primaryL, border:`1px solid #c7d2fe`, color:T.primary, fontSize:13, fontWeight:600 }}>
                ℹ You can edit all of this anytime in your Profile section.
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div style={{ display:"flex", gap:10, marginTop:24 }}>
            {onboardStep > 1 && (
              <button className="gbtn" onClick={() => setOnboardStep(p => p - 1)} style={{ padding:"13px 20px", fontSize:14 }}>
                ← Back
              </button>
            )}
            {onboardStep < 4 ? (
              <button className="pbtn"
                disabled={!canProceed()}
                onClick={() => setOnboardStep(p => p + 1)}
                style={{ flex:1, padding:"13px", fontSize:15 }}>
                Continue →
              </button>
            ) : (
              <button className="pbtn"
                disabled={!canProceed()}
                onClick={handleComplete}
                style={{ flex:1, padding:"13px", fontSize:15 }}>
                🚀 Get Started!
              </button>
            )}
          </div>
        </div>

        {/* Skip option */}
        <div style={{ textAlign:"center", marginTop:16 }}>
          <button onClick={() => setOnboardingDone(true)}
            style={{ background:"none", border:"none", color:T.muted2, fontSize:13, cursor:"pointer", textDecoration:"underline" }}>
            Skip for now
          </button>
        </div>
      </div>
      {renderSubRolePopup()}
    </div>
  );
};  
const renderPage = () => {
    if (activePage === "dashboard")    return renderDashboard();
    if (activePage === "auto-apply") return (
  <AutoApplyPage
    resumeResult={resumeResult}
    profile={profile}
    apps={apps}
    setApps={setApps}
    setActivePage={setActivePage}
    toast={toast}
    matchColor={matchColor}
  />
);
    if (activePage === "jobs")         return renderJobsPage();
    if (activePage === "ai-tools")     return renderAITools();
    if (activePage === "resume")       return renderResumePage();
    if (activePage === "applications") return renderApplicationsPage();
    if (activePage === "profile")      return renderProfilePage();
    if (activePage === "tailored")     return renderTailoredPage();
    if (activePage === "saved")        return renderSavedPage();
    return renderDashboard();
  };

  const tailorLocked = userPlan === "free";
const aiLocked = userPlan === "free";
const autoApplyLocked = userPlan === "free";

const NAV = [
  { id:"dashboard",    icon:"🏠", label:"Dashboard",   locked:false },
  { id:"auto-apply",   icon:"🚀", label:"Auto Apply",  locked:autoApplyLocked },
  { id:"jobs",         icon:"💼", label:"Job Board",   locked:false },
  { id:"ai-tools",     icon:"✨", label:"AI Tools",    locked:aiLocked },
  { id:"resume",       icon:"📄", label:"Resume",      locked:false },
  { id:"applications", icon:"📋", label:"Tracker",     locked:false, badge:appCount },
  { id:"profile",      icon:"👤", label:"Profile",     locked:false },
  { id:"tailored",     icon:"🪄", label:"Tailored",    locked:tailorLocked },
  { id:"saved",        icon:"⭐", label:"Saved",        locked:false, badge:savedJobs.length },
];

if (!onboardingDone) return <>{renderOnboarding()}<ToastContainer toasts={toasts}/></>; 
return (
  <>
    <style>{GCSS}</style>
    <div style={{ minHeight:"100vh", display:"flex", background:T.pageBg }}>
        <aside style={{ width:216, minWidth:216, minHeight:"100vh", background:T.sidebar, position:"sticky", top:0, alignSelf:"flex-start", display:"flex", flexDirection:"column", padding:"18px 10px", boxShadow:"1px 0 0 #E8E8F0, 2px 0 12px rgba(79,70,229,.05)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:22, padding:"0 6px" }}>
            <div style={{ width:34, height:34, borderRadius:10, background:T.grad, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:15, fontFamily:"'Syne',sans-serif", boxShadow:"0 4px 12px rgba(79,70,229,.3)", flexShrink:0 }}>S</div>
            <div>
              <div style={{ color:T.text, fontWeight:900, fontSize:15, lineHeight:1, fontFamily:"'Syne',sans-serif" }}>SmartApply</div>
              <div style={{ color:T.muted2, fontWeight:600, fontSize:11, marginTop:1 }}>Career OS</div>
            </div>
          </div>
          <nav style={{ display:"grid", gap:2, flex:1 }}>
            {NAV.map(item => (
  <button key={item.id}
    onClick={() => {
      if (item.locked) {
        handleLockedClick(item.id);
      } else {
        setActivePage(item.id);
      }
    }}
    className={`nbtn${activePage === item.id ? " active" : ""}`}
    style={{ opacity: item.locked ? 0.7 : 1 }}>
    <span style={{ display:"flex", alignItems:"center", gap:9 }}>
      <span style={{ fontSize:15 }}>{item.icon}</span>
      <span style={{ fontSize:13.5 }}>{item.label}</span>
      {item.locked && (
        <span style={{ fontSize:11, background:T.goldL, color:"#b45309", border:"1px solid #fde68a", borderRadius:999, padding:"1px 6px", fontWeight:800 }}>
          🔒
        </span>
      )}
    </span>
    {item.badge > 0 && (
      <span style={{ padding:"2px 7px", borderRadius:999, fontSize:11, fontWeight:800, background:T.primaryL, color:T.primary, minWidth:20, textAlign:"center" }}>{item.badge}</span>
    )}
  </button>
))}
          </nav>
          <div style={{ marginTop:14, padding:"12px 14px", borderRadius:12, background:T.cardAlt, border:`1px solid ${T.border}` }}>
            <div style={{ color:T.muted2, fontSize:10, fontWeight:800, letterSpacing:".09em", textTransform:"uppercase", marginBottom:7 }}>Backend</div>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4 }}>
              <span style={{ width:7, height:7, borderRadius:"50%", flexShrink:0, background:backendOk ? "#4ade80" : "#f87171", boxShadow:backendOk ? "0 0 7px #4ade80" : "0 0 7px #f87171" }}/>
              <span style={{ color:backendOk ? T.green : T.red, fontWeight:700, fontSize:13 }}>{status}</span>
            </div>
            {cachedCount > 0 && <div style={{ color:T.muted, fontSize:11, fontWeight:600, marginBottom:2 }}>{cachedCount.toLocaleString()} jobs cached</div>}
            {lastRefreshed && <div style={{ color:T.muted2, fontSize:10 }}>Updated {timeAgo(lastRefreshed)}</div>}
            <button onClick={() => setShowLanding(true)}
              style={{ marginTop:10, width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:"transparent", color:T.muted, fontWeight:600, fontSize:11, cursor:"pointer", textAlign:"center", transition:"all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.color = T.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
              ← Back to Home
            </button>
          </div>
        </aside>
        <main style={{ flex:1, minWidth:0, padding:"28px 32px", overflowX:"hidden" }}>
          {renderPage()}
          {showUpgradePopup && (
  <div style={{ position:"fixed", inset:0, background:"rgba(30,27,75,.45)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
    <div style={{ background:"#ffffff", width:460, borderRadius:24, padding:32, boxShadow:"0 28px 80px rgba(79,70,229,.2)", border:`1px solid ${T.border}`, animation:"fadeUp .25s ease" }}>
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ width:56, height:56, borderRadius:16, background:T.primaryL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 14px" }}>🚀</div>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:900, color:T.text, marginBottom:8 }}>Unlock This Feature</h2>
        <p style={{ color:T.muted, fontSize:14, lineHeight:1.6 }}>
          {upgradeFeature === "tailored" && "Tailored resumes require a Plus or Ultra plan."}
          {upgradeFeature === "auto-apply" && "Auto Apply requires a Plus or Ultra plan."}
          {upgradeFeature === "ai-tools" && "AI Tools require a Plus or Ultra plan."}
          {!upgradeFeature && "This feature requires a Plus or Ultra plan."}
        </p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
        <div style={{ padding:18, borderRadius:16, border:`2px solid ${T.primary}`, background:T.primaryL }}>
          <div style={{ fontWeight:800, color:T.primary, fontSize:13, marginBottom:4 }}>Plus</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:900, color:T.text, marginBottom:8 }}>$9.99<span style={{ fontSize:13, fontWeight:600, color:T.muted }}>/mo</span></div>
          <div style={{ display:"grid", gap:6 }}>
            {["20 auto applies/day","15 tailored resumes/day","15 cover letters/day","All AI tools","Chrome extension"].map((f,i) => (
              <div key={i} style={{ display:"flex", gap:8, fontSize:12, color:T.text }}>
                <span style={{ color:T.green, fontWeight:900 }}>✓</span>{f}
              </div>
            ))}
          </div>
          <button className="pbtn" style={{ width:"100%", marginTop:14, padding:"10px", fontSize:13 }}
            onClick={() => { setShowUpgradePopup(false); toast("Stripe payments coming soon!","info"); }}>
            Get Plus →
          </button>
        </div>
        <div style={{ padding:18, borderRadius:16, background:T.grad }}>
          <div style={{ fontWeight:800, color:"rgba(255,255,255,.8)", fontSize:13, marginBottom:4 }}>Ultra</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:900, color:"#fff", marginBottom:8 }}>$29.99<span style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,.7)" }}>/mo</span></div>
          <div style={{ display:"grid", gap:6 }}>
            {["50 auto applies/day","50 tailored resumes/day","50 cover letters/day","Priority matching","Priority support"].map((f,i) => (
              <div key={i} style={{ display:"flex", gap:8, fontSize:12, color:"#fff" }}>
                <span style={{ fontWeight:900 }}>✓</span>{f}
              </div>
            ))}
          </div>
          <button style={{ width:"100%", marginTop:14, padding:"10px", fontSize:13, fontWeight:700, borderRadius:10, border:"2px solid rgba(255,255,255,.4)", background:"rgba(255,255,255,.15)", color:"#fff", cursor:"pointer", fontFamily:"inherit" }}
            onClick={() => { setShowUpgradePopup(false); toast("Stripe payments coming soon!","info"); }}>
            Get Ultra →
          </button>
        </div>
      </div>
      <button className="gbtn" style={{ width:"100%", padding:"11px", fontSize:14 }}
        onClick={() => setShowUpgradePopup(false)}>
        Maybe Later
      </button>
    </div>
  </div>
)}
          {showApplyPopup && pendingApply && (
            <div style={{ position:"fixed", inset:0, background:"rgba(30,27,75,.45)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
              <div style={{ background:"#ffffff", width:420, borderRadius:24, padding:28, boxShadow:"0 28px 80px rgba(79,70,229,.2)", border:`1px solid ${T.border}`, animation:"fadeUp .25s ease" }}>
                <div style={{ width:50, height:50, borderRadius:15, background:T.primaryL, color:T.primary, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, marginBottom:16 }}>✅</div>
                <h2 style={{ margin:0, fontSize:22, color:T.text, fontWeight:900, fontFamily:"'Syne',sans-serif" }}>Did you apply?</h2>
                <p style={{ margin:"10px 0 20px", color:T.muted, fontSize:14, lineHeight:1.6 }}>
                  Did you complete the application for <strong style={{ color:T.text }}>{pendingApply.title}</strong> at <strong style={{ color:T.text }}>{pendingApply.company}</strong>?
                </p>
                <div style={{ display:"flex", gap:10 }}>
                  <button className="pbtn" style={{ flex:1 }} onClick={() => { setApps(prev => ({...prev, [pendingApply.id]:{ stage:"Applied", notes:"", appliedDate:new Date().toISOString(), job:pendingApply }})); setPendingApply(null); setShowApplyPopup(false); toast("Added to Applications! 🎉","success"); }}>✓ Yes, I applied</button>
                  <button className="gbtn" style={{ flex:1 }} onClick={() => { setPendingApply(null); setShowApplyPopup(false); }}>Not yet</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    {renderTailorPanel()}
    {renderSubRolePopup()}
    <ToastContainer toasts={toasts}/>
  </>
  );
}