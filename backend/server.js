require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const multer    = require("multer");
const pdfParse  = require("pdf-parse");
const mammoth   = require("mammoth");
const rateLimit = require("express-rate-limit");
const helmet    = require("helmet");
const { z }     = require("zod");
const puppeteer = require("puppeteer");

const app = express();

// ─── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    const allowed = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000","http://localhost:5173"];
    if (!origin || allowed.includes(origin) || origin.startsWith("chrome-extension://")) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  methods: ["GET","POST"],
}));
app.use(express.json({ limit: "20mb" }));
app.use("/api/", rateLimit({
  windowMs: 60_000, max: 120,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// ─── Groq AI ───────────────────────────────────────────────────────────────────
async function callGroq(messages, maxTokens = 1200) {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set in .env");
  
  const makeRequest = async (retries = 3) => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (res.status === 429 && retries > 0) {
      // Rate limited — wait and retry automatically
      const retryAfter = res.headers.get("retry-after") || 5;
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return makeRequest(retries - 1);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Groq error: ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  };

  return makeRequest();
}

// ─── Validation Schemas ────────────────────────────────────────────────────────
const matchSchema = z.object({
  resumeText:     z.string().min(50).max(50_000),
  jobDescription: z.string().min(20).max(20_000),
});
const tailorSchema = z.object({
  resumeText: z.string().min(50).max(50_000),
  job: z.object({
    id:          z.string().optional(),
    title:       z.string().min(1).max(200),
    company:     z.string().min(1).max(200),
    location:    z.string().optional(),
    description: z.string().optional(),
  }),
});
const generateSchema = z.object({
  resumeText:      z.string().min(50).max(50_000),
  job:             z.object({ title: z.string(), company: z.string(), description: z.string().optional() }),
  selectedSkills:  z.array(z.string()).max(50).optional(),
  selectedBullets: z.array(z.string()).max(20).optional(),
});
const aiSchema = z.object({
  resumeText:     z.string().min(10).max(50_000).optional(),
  jobTitle:       z.string().min(1).max(200).optional(),
  company:        z.string().min(1).max(200).optional(),
  jobDescription: z.string().min(10).max(20_000).optional(),
  atsScore:       z.number().optional(),
  matchedSkills:  z.array(z.string()).optional(),
  missingSkills:  z.array(z.string()).optional(),
  matchScore:     z.number().optional(),
});
const refineSchema = z.object({
  currentResume: z.string().min(50).max(50_000),
  instruction:   z.string().min(3).max(2000),
  jobTitle:      z.string().optional(),
  company:       z.string().optional(),
});

// ─── Skill Groups ──────────────────────────────────────────────────────────────
const SKILL_GROUPS = {
  software:     ["java","python","c++","c#",".net","go","golang","javascript","typescript","node","node.js","spring","spring boot","django","flask","express","api","rest","restful","web services","graphql","microservices","object oriented","oop","solid","ruby","rails","php","scala","kotlin","swift"],
  frontend:     ["react","angular","vue","html","css","redux","typescript","javascript","web components","frontend","ui","responsive design","next.js","svelte","tailwind","webpack","vite"],
  data:         ["sql","mysql","postgres","postgresql","sql server","mongodb","redis","snowflake","databricks","spark","pyspark","airflow","etl","elt","data pipeline","data warehouse","bigquery","power bi","tableau","excel","analytics","reporting","dbt","kafka","flink","pandas","numpy","looker"],
  cloudDevops:  ["aws","azure","gcp","docker","kubernetes","jenkins","terraform","ci/cd","devops","lambda","ec2","s3","iam","api gateway","ecs","ecr","cloudwatch","kinesis","sqs","linux","shell","helm","ansible","pulumi","github actions","circleci"],
  networking:   ["networking","tcp/ip","dns","dhcp","vpn","lan","wan","routing","switching","firewall","cisco","ccna","load balancer","wireshark","network security","active directory","subnet","vlan","ospf","bgp","nat"],
  cybersecurity:["cybersecurity","security","siem","splunk","soc","incident response","vulnerability","penetration testing","zero trust","nist","encryption","risk assessment","security analyst","devsecops"],
  qaTesting:    ["qa","quality assurance","manual testing","automation testing","selenium","cypress","junit","testng","postman","api testing","regression testing","functional testing","unit testing","tdd","playwright","jest"],
  platform:     ["salesforce","apex","visualforce","crm","service cloud","sales cloud","workday","servicenow","sap","oracle"],
  business:     ["business analyst","requirements gathering","stakeholder","documentation","jira","agile","scrum","user stories","process improvement","kpi","dashboard","confluence"],
  aiMl:         ["machine learning","ml","ai","llm","openai","bedrock","langchain","rag","tensorflow","scikit-learn","nlp","semantic search","pytorch","hugging face","transformers","computer vision","generative ai","fine-tuning"],
  database:     ["dba","database administrator","sql server","oracle dba","mysql","postgresql","mongodb","nosql","query optimization","indexing","always on","replication","backup","restore","performance tuning","stored procedure","partitioning","ssrs","ssis"],
  mobile:       ["ios","android","swift","kotlin","react native","flutter","mobile","xcode","android studio"],
};

const SYNONYMS = {
  rest:["rest api","restful","web services","api development"],
  api:["web services","backend services","integrations"],
  "ci/cd":["jenkins","pipelines","deployment automation","github actions"],
  aws:["amazon web services","cloud services","amazon aws"],
  kubernetes:["k8s","container orchestration"],
  docker:["containers","containerization"],
  sql:["relational database","queries","database"],
  postgres:["postgresql"],
  python:["python scripting","python3"],
  networking:["tcp/ip","routing","switching","lan","wan"],
  cybersecurity:["security operations","soc","information security","infosec"],
  qa:["testing","quality assurance"],
  "business analyst":["requirements","stakeholder","user stories","ba"],
  "machine learning":["ml","predictive modeling","deep learning"],
  dba:["database administrator","db admin","database admin"],
};

const ALL_SKILLS = [...new Set(Object.values(SKILL_GROUPS).flat())];

// ─── Job Sources ───────────────────────────────────────────────────────────────
const GREENHOUSE_SOURCES = [
  {company:"Stripe",board:"stripe"},{company:"Brex",board:"brex"},
  {company:"Ramp",board:"ramp"},
  {company:"Pinterest",board:"pinterest"},
  {company:"Squarespace",board:"squarespace"},
  {company:"Typeform",board:"typeform"},
  {company:"GoFundMe",board:"gofundme"},
  {company:"Chime",board:"chime"},{company:"Coinbase",board:"coinbase"},
  {company:"Robinhood",board:"robinhood"},{company:"NerdWallet",board:"nerdwallet"},
  {company:"Gusto",board:"gusto"},{company:"Carta",board:"carta"},
  {company:"Rippling",board:"rippling"},{company:"Adyen",board:"adyen"},
  {company:"Anthropic",board:"anthropic"},{company:"OpenAI",board:"openai"},
  {company:"Scale AI",board:"scaleai"},{company:"Weights & Biases",board:"wandb"},
  {company:"Cohere",board:"cohere"},{company:"Hugging Face",board:"huggingface"},
  {company:"Databricks",board:"databricks"},{company:"dbt Labs",board:"dbtlabs"},
  {company:"Amplitude",board:"amplitude"},{company:"Mixpanel",board:"mixpanel"},
  {company:"Grafana",board:"grafana"},{company:"Fivetran",board:"fivetran"},
  {company:"Airbyte",board:"airbyte"},{company:"HashiCorp",board:"hashicorp"},
  {company:"Cloudflare",board:"cloudflare"},{company:"Datadog",board:"datadog"},
  {company:"PagerDuty",board:"pagerduty"},{company:"LaunchDarkly",board:"launchdarkly"},
  {company:"Sourcegraph",board:"sourcegraph"},{company:"Snyk",board:"snyk"},
  {company:"Samsara",board:"samsara"},{company:"Notion",board:"notion"},
  {company:"Airtable",board:"airtable"},{company:"Asana",board:"asana"},
  {company:"Loom",board:"loom"},{company:"Linear",board:"linear"},
  {company:"Retool",board:"retool"},{company:"Lattice",board:"lattice"},
  {company:"Ironclad",board:"ironclad"},{company:"Faire",board:"faire"},
  {company:"Instacart",board:"instacart"},{company:"Reddit",board:"reddit"},
  {company:"Discord",board:"discord"},{company:"Dropbox",board:"dropbox"},
  {company:"MongoDB",board:"mongodb"},{company:"Elastic",board:"elastic"},
  {company:"Confluent",board:"confluent"},{company:"Okta",board:"okta"},
  {company:"Twilio",board:"twilio"},{company:"Intercom",board:"intercom"},
  {company:"Lyft",board:"lyft"},{company:"Navan",board:"navan"},
  {company:"HubSpot",board:"hubspot"},{company:"Zendesk",board:"zendesk"},
  {company:"Duolingo",board:"duolingo"},{company:"Vercel",board:"vercel"},
  {company:"GitLab",board:"gitlab"},{company:"Benchling",board:"benchling"},
  {company:"Figma",board:"figma"},
{company:"Airbnb",board:"airbnb"},
{company:"DoorDash",board:"doordashusa"},
{company:"Shopify",board:"shopify?department=Engineering"},
{company:"Zoom",board:"zoomvideo"},
{company:"Palantir",board:"palantir"},
{company:"Canva",board:"canva"},
{company:"Affirm",board:"affirm"},
{company:"Checkr",board:"checkr"},
{company:"Klaviyo",board:"klaviyo"},
{company:"Rivian",board:"rivian"},
{company:"Anduril",board:"anduril"},
{company:"Plaid",board:"plaid"},
{company:"Coda",board:"coda"},
{company:"Gem",board:"gem"},
{company:"Superhuman",board:"superhuman"},
{company:"Mistral",board:"mistral"},
{company:"Perplexity",board:"perplexity"},
{company:"Vanta",board:"vanta"},
{company:"Cribl",board:"cribl"},
{company:"Cockroach Labs",board:"cockroachlabs"},
{company:"Celonis",board:"celonis"},
{company:"Temporal",board:"temporal"},
{company:"Pendo",board:"pendo"},
{company:"Ripple",board:"ripple"},
{company:"Hex",board:"hex"},
{company:"Dremio",board:"dremio"},
{company:"Harness",board:"harness"},
{company:"Nerdio",board:"nerdio"},
{company:"Observe",board:"observeinc"},
{company:"Monte Carlo",board:"montecarlodata"},
{company:"Immuta",board:"immuta"},
{company:"Replit",board:"replit"},
{company:"Cursor",board:"cursor"},
{company:"Abnormal Security",board:"abnormalsecurity"},
{company:"Lacework",board:"lacework"},
{company:"Astronomer",board:"astronomer"},
{company:"Starburst",board:"starburst"},
{company:"Imply",board:"imply"},
{company:"Securly",board:"securly"},
{company:"Collibra",board:"collibra"},
{company:"Alation",board:"alation"},
{company:"Atlan",board:"atlan"},
{company:"Acceldata",board:"acceldata"},
{company:"Privacera",board:"privacera"},
{company:"Nexla",board:"nexla"},
{company:"Preset",board:"preset"},
{company:"Cube",board:"cube"},
{company:"Metaplane",board:"metaplane"},
{company:"Select Star",board:"selectstar"},
{company:"Datafold",board:"datafold"},
];
const LEVER_SOURCES = [
  {company:"Docker",board:"docker"},
  {company:"Postman",board:"postman"},
  {company:"Miro",board:"miro"},
  {company:"Hightouch",board:"hightouch"},
  {company:"Stytch",board:"stytch"},
];
const WORKDAY_SOURCES = [
  {company:"Apple",tenant:"apple",instance:5,path:"apple"},
  {company:"Microsoft",tenant:"microsoft",instance:5,path:"microsoft"},
  {company:"Cisco",tenant:"cisco",instance:5,path:"cisco"},
  {company:"Salesforce",tenant:"salesforce",instance:12,path:"salesforce"},
  {company:"Adobe",tenant:"adobe",instance:5,path:"adobe"},
  {company:"ServiceNow",tenant:"servicenow",instance:1,path:"servicenow"},
  {company:"Oracle",tenant:"oracle",instance:5,path:"oracle"},
  {company:"Capital One",tenant:"capitalone",instance:5,path:"capitalone"},
  {company:"JPMorgan",tenant:"jpmorgan",instance:5,path:"jpmorgan"},
  {company:"Deloitte",tenant:"deloitte",instance:5,path:"deloitte"},
];

// ─── Text Helpers ──────────────────────────────────────────────────────────────
const cleanHtml    = h => String(h).replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
const normalizeText= t => String(t).toLowerCase().replace(/\s+/g," ").trim();
const textHasSkill = (text,skill) => { const l=normalizeText(text); return l.includes(skill.toLowerCase())||(SYNONYMS[skill.toLowerCase()]||[]).some(s=>l.includes(s.toLowerCase())); };
const extractSkills= t => [...new Set(ALL_SKILLS.filter(s=>textHasSkill(t,s)))];
const detectCategories = t => Object.entries(SKILL_GROUPS).map(([category,skills])=>({category,count:skills.filter(s=>textHasSkill(t,s)).length})).filter(i=>i.count>0).sort((a,b)=>b.count-a.count);

// ─── Resume Helpers ─────────────────────────────────────────────────────────────
function extractSection(text,sn,stop){
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const lo=n=>n.map(s=>s.toLowerCase());
  let start=-1,end=lines.length;
  for(let i=0;i<lines.length;i++){if(lo(sn).some(n=>lines[i].toLowerCase().includes(n))){start=i+1;break;}}
  if(start===-1)return"";
  for(let i=start;i<lines.length;i++){if(lo(stop).some(n=>lines[i].toLowerCase()===n||lines[i].toLowerCase().includes(n))){end=i;break;}}
  return lines.slice(start,end).join("\n");
}

function extractProfileFromResume(text=""){
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const emailMatch=text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch=text.match(/(\+?\d[\d\s().-]{8,}\d)/);
  const name=lines.find(l=>l.length>3&&l.length<60&&!l.includes("@")&&!/\d{3}/.test(l)&&!l.toLowerCase().includes("resume"))||"";
  return{
    name,
    email:emailMatch?emailMatch[0]:"",
    phone:phoneMatch?phoneMatch[0]:"",
    education:extractSection(text,["education","academic background"],["experience","work experience","skills","projects","certifications"]),
    experience:extractSection(text,["experience","work experience","professional experience"],["education","skills","projects","certifications","technical skills"]),
    skillsText:extractSection(text,["skills","technical skills","technologies"],["education","experience","projects","certifications"]),
  };
}

async function extractResumeText(file){
  const name=file.originalname.toLowerCase();
  if(name.endsWith(".pdf")){const d=await pdfParse(file.buffer);return d.text||"";}
  if(name.endsWith(".docx")){const r=await mammoth.extractRawText({buffer:file.buffer});return r.value||"";}
  throw new Error("Only PDF and DOCX files are supported");
}

function analyzeResumeText(text){
  const skills=extractSkills(text);
  const lower=normalizeText(text);
  let score=45;
  score+=Math.min(skills.length*2.5,35);
  if(lower.length>1500)score+=5;
  if(lower.length>3000)score+=5;
  if(lower.includes("experience"))score+=4;
  if(lower.includes("education"))score+=4;
  if(lower.includes("skills"))score+=4;
  if(lower.includes("projects"))score+=3;
  return{
    atsScore:Math.min(Math.round(score),95),
    skills,
    categories:detectCategories(text),
    resumeText:text.slice(0,25000),
    profile:extractProfileFromResume(text),
  };
}

// ─── Job Fetchers ──────────────────────────────────────────────────────────────
async function fetchGreenhouseJobs(s){
  try{
    const res=await fetch(`https://boards-api.greenhouse.io/v1/boards/${s.board}/jobs?content=true&per_page=500`,{signal:AbortSignal.timeout(15000)});
    if(!res.ok)return[];
    const d=await res.json();
    return(d.jobs||[]).map(j=>({id:`gh-${s.company}-${j.id}`,title:j.title||"Untitled",company:s.company,location:j.location?.name||"United States",url:j.absolute_url,source:"Greenhouse",updatedAt:j.updated_at||null,description:cleanHtml(j.content||"")}));
  }catch(e){if(process.env.NODE_ENV!=="production")console.warn(`[GH/${s.company}] ${e.message}`);return[];}
}

async function fetchLeverJobs(s){
  try{
    const res=await fetch(`https://api.lever.co/v0/postings/${s.board}?mode=json`,{signal:AbortSignal.timeout(15000)});
    if(!res.ok)return[];
    const d=await res.json();
    return(d||[]).map(j=>({id:`lv-${s.company}-${j.id||j.text}`,title:j.text||"Untitled",company:s.company,location:j.categories?.location||"United States",url:j.hostedUrl||j.applyUrl,source:"Lever",updatedAt:j.createdAt?new Date(j.createdAt).toISOString():null,description:cleanHtml(`${j.descriptionPlain||""} ${(j.lists||[]).map(l=>l.content).join(" ")}`)}));
  }catch(e){if(process.env.NODE_ENV!=="production")console.warn(`[LV/${s.company}] ${e.message}`);return[];}
}

async function fetchWWRJobs(){
  try{
    const res=await fetch("https://weworkremotely.com/remote-jobs.rss",{headers:{"User-Agent":"SmartApply/1.0"},signal:AbortSignal.timeout(10000)});
    if(!res.ok)return[];
    const xml=await res.text();
    return[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([,item])=>{
      const tr=item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]||"";
      const link=item.match(/<link>(.*?)<\/link>/)?.[1]||"";
      const pubDate=item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]||"";
      const desc=item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]||"";
      const ci=tr.indexOf(":");
      return{id:`wwr-${encodeURIComponent(link)}`,title:ci>-1?tr.slice(ci+1).trim():tr,company:ci>-1?tr.slice(0,ci).trim():"Unknown",location:"Remote (US)",url:link,source:"We Work Remotely",updatedAt:pubDate?new Date(pubDate).toISOString():null,description:cleanHtml(desc)};
    }).filter(j=>j.url&&j.title);
  }catch(e){if(process.env.NODE_ENV!=="production")console.warn(`[WWR] ${e.message}`);return[];}
}

async function fetchRemotiveJobs(){
  try{
    const res=await fetch("https://remotive.com/api/remote-jobs",{signal:AbortSignal.timeout(10000)});
    if(!res.ok)return[];
    const d=await res.json();
    const US_LOC2 = ["remote","usa","united states","u.s.","anywhere","worldwide","north america"];
return(d.jobs||[]).map(j=>({id:`rm-${j.id}`,title:j.title||"Untitled",company:j.company_name||"Unknown",location:j.candidate_required_location||"Remote",url:j.url,source:"Remotive",updatedAt:j.publication_date||null,description:cleanHtml(j.description||"")}))
.filter(j=>{const loc=(j.location||"").toLowerCase();return!loc||US_LOC2.some(t=>loc.includes(t));});
  }catch(e){if(process.env.NODE_ENV!=="production")console.warn(`[Remotive] ${e.message}`);return[];}
}

async function fetchRemoteOkJobs(){
  try{
    const res=await fetch("https://remoteok.com/api",{headers:{"User-Agent":"SmartApply/1.0"},signal:AbortSignal.timeout(10000)});
    if(!res.ok)return[];
    const d=await res.json();
    const US_LOC = ["remote","usa","united states","u.s.","new york","san francisco","seattle","austin","chicago","boston","california","texas","florida","washington","colorado","georgia","virginia","massachusetts","arizona","oregon","ohio","michigan","north carolina","illinois","pennsylvania","new jersey","maryland","connecticut","minnesota","wisconsin","denver","atlanta","dallas","los angeles","nyc","sf","bay area","anywhere","worldwide"];
return(d||[]).filter(j=>j&&j.position).map(j=>({id:`rok-${j.id}`,title:j.position||"Untitled",company:j.company||"Unknown",location:j.location||"Remote",url:j.url||j.apply_url,source:"RemoteOK",updatedAt:j.date||null,description:cleanHtml(`${j.description||""} ${(j.tags||[]).join(" ")}`)}))
.filter(j=>{const loc=(j.location||"").toLowerCase();return!loc||US_LOC.some(t=>loc.includes(t));});
  }catch(e){if(process.env.NODE_ENV!=="production")console.warn(`[RemoteOK] ${e.message}`);return[];}
}

async function fetchArbeitnowJobs() {
  try {
    const res = await fetch("https://arbeitnow.com/api/job-board-api", 
      { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.data || []).map(j => ({
      id: `an-${j.slug}`,
      title: j.title || "Untitled",
      company: j.company_name || "Unknown",
      location: j.location || "Remote",
      url: j.url,
      source: "Arbeitnow",
      updatedAt: j.created_at || null,
      description: j.description || ""
    }));
  } catch(e) {
    console.warn(`[Arbeitnow] ${e.message}`);
    return [];
  }
}

async function fetchFindWorkJobs() {
  try {
    const res = await fetch(
      "https://findwork.dev/api/jobs/?remote=true",
      { 
        headers: { "User-Agent": "SmartApply/1.0" },
        signal: AbortSignal.timeout(10000) 
      }
    );
    if (!res.ok) return [];
    const d = await res.json();
    return (d.results || []).map(j => ({
      id: `fw-${j.id}`,
      title: j.role || "Untitled",
      company: j.company_name || "Unknown",
      location: j.location || "Remote",
      url: j.url || "",
      source: "FindWork",
      updatedAt: j.date_posted || null,
      description: j.text || ""
    })).filter(j => j.url);
  } catch(e) {
    console.warn(`[FindWork] ${e.message}`);
    return [];
  }
}

async function fetchJobicyJobs() {
  try {
    const res = await fetch(
      "https://jobicy.com/api/v2/remote-jobs?count=100&geo=usa",
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const d = await res.json();
    return (d.jobs || []).map(j => ({
      id: `jc-${j.id}`,
      title: j.jobTitle || "Untitled",
      company: j.companyName || "Unknown",
      location: j.jobGeo || "Remote (US)",
      url: j.url || "",
      source: "Jobicy",
      updatedAt: j.pubDate || j.jobPosted || j.datePosted || null,
      description: cleanHtml(j.jobDescription || "")
    }));
  } catch(e) {
    if (process.env.NODE_ENV !== "production") console.warn(`[Jobicy] ${e.message}`);
    return [];
  }
}

async function fetchJSearchJobs(pageLimit = 1) {
  if (!process.env.JSEARCH_API_KEY) {
    console.warn("[JSearch] Missing JSEARCH_API_KEY in .env");
    return [];
  }

  const allJobs = [];
  const query = "technology jobs in United States";

  for (let page = 1; page <= pageLimit; page++) {
    try {
      const url = new URL("https://api.openwebninja.com/jsearch/search-v2");

      url.searchParams.set("query", query);
      url.searchParams.set("country", "us");
      url.searchParams.set("language", "en");
      url.searchParams.set("date_posted", "3days");
      url.searchParams.set("page", String(page));

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-api-key": process.env.JSEARCH_API_KEY,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[JSearch/page-${page}] HTTP ${res.status} ${text.slice(0, 250)}`);
        break;
      }

      const d = await res.json();

      const rawJobs =
        Array.isArray(d.data) ? d.data :
        Array.isArray(d.jobs) ? d.jobs :
        Array.isArray(d.results) ? d.results :
        Array.isArray(d.data?.jobs) ? d.data.jobs :
        Array.isArray(d.data?.results) ? d.data.results :
        [];

      console.log(`[JSearch/page-${page}] raw=${rawJobs.length}`);

      if (!rawJobs.length) break;

      const jobs = rawJobs
        .map(j => ({
          id: `js-${j.job_id || j.id || j.job_apply_link || j.job_google_link || `${j.job_title}-${j.employer_name}`}`,
          title: j.job_title || j.title || "Untitled",
          company: j.employer_name || j.company || j.company_name || "Unknown",
          location:
            j.job_location ||
            j.location ||
            [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") ||
            "United States",
          url:
            j.job_apply_link ||
            j.job_google_link ||
            j.url ||
            j.apply_options?.[0]?.apply_link ||
            "",
          source: "JSearch",
          updatedAt:
            j.job_posted_at_datetime_utc ||
            j.posted_at ||
            j.date_posted ||
            (j.job_posted_at_timestamp
              ? new Date(j.job_posted_at_timestamp * 1000).toISOString()
              : new Date().toISOString()),
          description: cleanHtml(j.job_description || j.description || ""),
        }))
        .filter(j => j.url && j.title && j.updatedAt);

      allJobs.push(...jobs);

      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.warn(`[JSearch/page-${page}] ${e.message}`);
      break;
    }
  }

  console.log(`[JSearch] final jobs=${allJobs.length}`);
  return allJobs;
}

function parseJobPostedDate(value) {
  if (!value) return new Date().toISOString();

  const raw = String(value).trim();
  const lower = raw.toLowerCase();

  const direct = new Date(raw).getTime();
  if (Number.isFinite(direct)) {
    return new Date(direct).toISOString();
  }

  if (lower.includes("just now") || lower.includes("today")) {
    return new Date().toISOString();
  }

  if (lower.includes("yesterday")) {
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  }

  const match = lower.match(/(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months)/);
  if (!match) return new Date().toISOString();

  const n = Number(match[1]);
  const unit = match[2];

  let ms = 0;
  if (unit.startsWith("minute")) ms = n * 60 * 1000;
  else if (unit.startsWith("hour")) ms = n * 60 * 60 * 1000;
  else if (unit.startsWith("day")) ms = n * 24 * 60 * 60 * 1000;
  else if (unit.startsWith("week")) ms = n * 7 * 24 * 60 * 60 * 1000;
  else if (unit.startsWith("month")) ms = n * 30 * 24 * 60 * 60 * 1000;

  return new Date(Date.now() - ms).toISOString();
}


async function fetchFlyByJobs(pageLimit = 1) {
  const apiKey =
    process.env.FLYBY_RAPIDAPI_KEY ||
    process.env.flybyAPIKey ||
    process.env.FLYBY_API_KEY ||
    process.env.RAPIDAPI_KEY;

  if (!apiKey) {
    console.warn("[FlyByAPIs] Missing FLYBY_RAPIDAPI_KEY or flybyAPIKey in .env");
    return [];
  }

  const allJobs = [];
  const query = "technology jobs in United States";

  for (let page = 1; page <= pageLimit; page++) {
    try {
      const url = new URL("https://jobs-search-api.p.rapidapi.com/jobs/search");

      url.searchParams.set("query", query);
      url.searchParams.set("type", "full-time");
      url.searchParams.set("date_posted", "3days");
      url.searchParams.set("page", String(page));

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "jobs-search-api.p.rapidapi.com",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[FlyByAPIs/page-${page}] HTTP ${res.status} ${text.slice(0, 250)}`);
        break;
      }

      const d = await res.json();

      const rawJobs =
        Array.isArray(d.data?.jobs) ? d.data.jobs :
        Array.isArray(d.jobs) ? d.jobs :
        Array.isArray(d.results) ? d.results :
        Array.isArray(d.data) ? d.data :
        [];

      console.log(`[FlyByAPIs/page-${page}] raw=${rawJobs.length}`);

      if (!rawJobs.length) break;

      const jobs = rawJobs
        .map(j => {
          const primaryApply =
            j.apply_link ||
            j.url ||
            j.apply_links?.find(a => a.is_primary)?.url ||
            j.apply_links?.[0]?.url ||
            "";

          return {
            id: `fb-${j.job_id || j.id || primaryApply || `${j.title}-${j.company}`}`,
            title: j.title || j.job_title || "Untitled",
            company: j.company || j.employer_name || j.company_name || "Unknown",
            location: j.location || j.job_location || "United States",
            url: primaryApply,
            source: "FlyByAPIs",
            updatedAt: parseJobPostedDate(
              j.posted_date ||
              j.date_posted ||
              j.job_posted_at_datetime_utc ||
              j.created_at ||
              j.updated_at
            ),
            description: cleanHtml(
              [
                j.description || j.job_description || "",
                Array.isArray(j.qualifications) ? j.qualifications.join(" ") : "",
                Array.isArray(j.benefits) ? j.benefits.join(" ") : "",
                j.salary || "",
                j.employment_type || "",
              ].join(" ")
            ),
          };
        })
        .filter(j => j.url && j.title && j.updatedAt);

      allJobs.push(...jobs);

      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.warn(`[FlyByAPIs/page-${page}] ${e.message}`);
      break;
    }
  }

  console.log(`[FlyByAPIs] final jobs=${allJobs.length}`);
  return allJobs;
}


async function fetchAdzunaJobs(pageLimit = 3) {
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
    console.warn("[Adzuna] Missing ADZUNA_APP_ID or ADZUNA_APP_KEY in .env");
    return [];
  }

  const allJobs = [];
  const RESULTS_PER_PAGE = 50;
  const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const isRecentJob = (job) => {
    if (!job.updatedAt) return false;

    const t = new Date(job.updatedAt).getTime();
    if (!Number.isFinite(t)) return false;

    const age = now - t;
    return age >= 0 && age <= MAX_AGE_MS;
  };

  for (let page = 1; page <= pageLimit; page++) {
    try {
      const url =
        `https://api.adzuna.com/v1/api/jobs/us/search/${page}` +
        `?app_id=${process.env.ADZUNA_APP_ID}` +
        `&app_key=${process.env.ADZUNA_APP_KEY}` +
        `&results_per_page=${RESULTS_PER_PAGE}` +
        `&category=it-jobs` +
        `&sort_by=date` +
        `&content-type=application/json`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        console.warn(`[Adzuna/page-${page}] HTTP ${res.status}`);
        break;
      }

      const d = await res.json();
      const rawResults = d.results || [];

      console.log(`[Adzuna/page-${page}] raw=${rawResults.length}`);

      if (!rawResults.length) break;

      const pageJobs = rawResults
        .map(j => ({
          id: `az-${j.id}`,
          title: j.title || "Untitled",
          company: j.company?.display_name || "Unknown",
          location: j.location?.display_name || "United States",
          url: j.redirect_url || "",
          source: "Adzuna",
          updatedAt: j.created || null,
          description: cleanHtml(j.description || ""),
        }))
        .filter(j => j.url);

      const recentJobs = pageJobs.filter(isRecentJob);
      allJobs.push(...recentJobs);

      console.log(
        `[Adzuna/page-${page}] usable=${pageJobs.length}, recent=${recentJobs.length}`
      );

      if (pageJobs.length > 0 && recentJobs.length === 0) {
        break;
      }

      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.warn(`[Adzuna/page-${page}] ${e.message}`);
      break;
    }
  }

  console.log(`[Adzuna] final recent jobs before dedupe=${allJobs.length}`);
  return allJobs;
}



async function fetchHimalayasJobs(){
  try{
    const res=await fetch("https://himalayas.app/jobs/api?limit=300",{signal:AbortSignal.timeout(10000)});
    if(!res.ok)return[];
    const d=await res.json();
    return(d.jobs||[]).map(j=>({id:`hm-${j.id||j.slug}`,title:j.title||"Untitled",company:j.companyName||j.company?.name||"Unknown",location:(j.locationRestrictions||[]).join(", ")||"Remote",url:j.applicationLink||j.url||"",source:"Himalayas",updatedAt:j.publishedAt||j.createdAt||null,description:cleanHtml(j.description||"")}))
.filter(j=>{const loc=(j.location||"").toLowerCase();return!loc||loc.includes("remote")||loc.includes("united states")||loc.includes("usa")||loc.includes("anywhere")||loc.includes("worldwide")||loc.includes("north america");});
  }catch(e){if(process.env.NODE_ENV!=="production")console.warn(`[Himalayas] ${e.message}`);return[];}
}

async function fetchMuseJobs() {
  const categories = [
    "Software Engineer",
    "Data Science",
    "DevOps & Sysadmin",
    "IT & Networking",
    "QA & Testing",
    "Database Administration",
    "Product Management",
    "Machine Learning",
    "Business & Strategy",
  ];

  const allJobs = [];

  try {
    for (const category of categories) {
      for (let page = 1; page <= 6; page++) {
        try {
          const url = `https://www.themuse.com/api/public/jobs?api_key=${process.env.MUSE_API_KEY}&page=${page}&category[]=${encodeURIComponent(category)}&location[]=United%20States`;
          const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (!res.ok) continue;
          const d = await res.json();
          const jobs = (d.results || []).map(j => ({
            id: `muse-${j.id}`,
            title: j.name || "Untitled",
            company: j.company?.name || "Unknown",
            location: j.locations?.map(l => l.name).join(", ") || "United States",
            url: j.refs?.landing_page || "",
            source: "The Muse",
            updatedAt: j.publication_date || j.created_at || j.updated_at || null,
            description: cleanHtml(j.contents || ""),
          })).filter(j => j.url);
          allJobs.push(...jobs);
          await new Promise(r => setTimeout(r, 100));
        } catch (e) {
          if (process.env.NODE_ENV !== "production") console.warn(`[Muse/${category}/page${page}] ${e.message}`);
        }
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn(`[Muse] ${e.message}`);
  }

  return allJobs;
}
async function fetchHackerNewsJobs() {
  try {
    const searchRes = await fetch(
      "https://hn.algolia.com/api/v1/search_by_date?query=Ask+HN+Who+is+hiring&tags=story&hitsPerPage=1",
      { signal: AbortSignal.timeout(10000) }
    );
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const storyId = searchData.hits?.[0]?.objectID;
    if (!storyId) return [];

    const commentsRes = await fetch(
      `https://hn.algolia.com/api/v1/search?tags=comment,story_${storyId}&hitsPerPage=500`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!commentsRes.ok) return [];
    const commentsData = await commentsRes.json();

    return (commentsData.hits || [])
      .filter(hit => hit.comment_text && hit.comment_text.length > 100)
      .map(hit => {
        const text = hit.comment_text.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
        const firstLine = text.split(".")[0] || text.slice(0,80);
        const company = firstLine.slice(0,60).trim() || "HN Company";
        const titleMatch = text.match(/hiring\s+(?:a\s+)?([^|.\n]{5,60})/i);
        const title = titleMatch ? titleMatch[1].trim() : "Software Engineer";
        const isRemote = /remote/i.test(text);
const isUS = /united states|usa|u\.s\.|new york|san francisco|seattle|austin|chicago|boston|california|texas|los angeles|denver|atlanta|dallas|miami|portland|nashville|phoenix|minneapolis/i.test(text);
if (!isRemote && !isUS) return null;
        return {
          id: `hn-${hit.objectID}`,
          title: title.slice(0,100),
          company: company.slice(0,80),
          location: isRemote ? "Remote" : "United States",
          url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          source: "HackerNews",
          updatedAt: j.created || null,
          description: text.slice(0,2000),
        };
      })
      .filter(Boolean);
  } catch(e) {
    if(process.env.NODE_ENV !== "production") console.warn(`[HackerNews] ${e.message}`);
    return [];
  }
}
async function fetchDevITJobs() {
  try {
    const res = await fetch(
      "https://devitjobs.us/api/jobsLight",
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const d = await res.json();
    const US_STATES = ["remote","anywhere","united states","usa","new york","san francisco","seattle","austin","chicago","boston","california","texas","florida","washington","colorado","georgia","virginia","massachusetts","arizona","oregon","ohio","michigan","north carolina","illinois","pennsylvania","new jersey","maryland","connecticut","minnesota","wisconsin","denver","atlanta","dallas","los angeles","nyc","sf"];
return (Array.isArray(d) ? d : []).map(j => ({
  id: `dit-${j._id}`,
  title: j.name || "Untitled",
  company: j.company || "Unknown",
  location: j.actualCity || j.remoteType === "anywhere" ? "Remote" : "United States",
  url: j.redirectJobUrl || j.jobUrl || "",
  source: "DevITjobs",
  updatedAt: j.publishedAt || j.createdAt || j.updatedAt || null,
  description: cleanHtml([
    j.techCategory,
    j.metaCategory,
    (j.technologies || []).join(", "),
    (j.filterTags || []).join(", "),
  ].filter(Boolean).join(" | "))
}))
.filter(j => j.url)
.filter(j => {
  const loc = (j.location || "").toLowerCase();
  const country = (j.stateCategory || j.countryCode || "").toLowerCase();
  return j.remoteType === "anywhere" || 
    country === "us" || 
    country === "usa" ||
    US_STATES.some(t => loc.includes(t));
});
  } catch(e) {
    if (process.env.NODE_ENV !== "production") console.warn(`[DevITjobs] ${e.message}`);
    return [];
  }
}
async function fetchWorkingNomadsJobs() {
  try {
    const res = await fetch(
      "https://www.workingnomads.com/api/exposed_jobs/",
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const d = await res.json();
    const TECH_CATEGORIES = [
      "development", "programming", "devops", "sysadmin",
      "data", "design", "product", "engineering", "security",
      "mobile", "backend", "frontend", "fullstack", "cloud"
    ];
    return (Array.isArray(d) ? d : [])
      .filter(j => {
        const cat = (j.category_name || "").toLowerCase();
        const title = (j.title || "").toLowerCase();
        return TECH_CATEGORIES.some(t => cat.includes(t) || title.includes(t));
      })
      .map(j => ({
  id: `wn-${j.id}`,
  title: j.title || "Untitled",
  company: j.company_name || "Unknown",
  location: j.location || "Remote",
  url: j.url || "",
  source: "WorkingNomads",
  updatedAt: j.pub_date || j.created_at || j.updated_at || null,
  description: cleanHtml(j.description || ""),
}))
.filter(j => j.url)
.filter(j => {
  const loc = (j.location || "").toLowerCase();
  return !loc || loc.includes("remote") || loc.includes("united states") || loc.includes("usa") || loc.includes("anywhere") || loc.includes("worldwide") || loc.includes("north america");
});
  } catch(e) {
    if (process.env.NODE_ENV !== "production") console.warn(`[WorkingNomads] ${e.message}`);
    return [];
  }
}
async function fetchWorkdayJobs(s){
  try{
    const url=`https://${s.tenant}.wd${s.instance}.myworkdayjobs.com/wday/cxs/${s.tenant}/${s.path}/jobs`;
    const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({limit:20,offset:0,searchText:"engineer OR developer OR analyst OR data"}),signal:AbortSignal.timeout(9000)});
    if(!res.ok)return[];
    const d=await res.json();
    return(d.jobPostings||d.jobs||[]).map(j=>({id:`wd-${s.company}-${j.title||Math.random()}`,title:j.title||"Untitled",company:s.company,location:j.locationsText||j.locations?.[0]?.city||"Not specified",url:j.externalPath?`https://${s.tenant}.wd${s.instance}.myworkdayjobs.com/en-US/${s.path}${j.externalPath}`:`https://${s.tenant}.wd${s.instance}.myworkdayjobs.com/en-US/${s.path}`,source:"Workday",updatedAt:j.postedOn?new Date(j.postedOn).toISOString():null,description:cleanHtml(j.jobDescription?.content||j.shortDescription||"")}));
  }catch(e){if(process.env.NODE_ENV!=="production")console.warn(`[WD/${s.company}] ${e.message}`);return[];}
}

// ─── Plan Limits ───────────────────────────────────────────────────────────────
const dailyUsage = {};

const PLAN_LIMITS = {
  free:  { tailor:0,  coverLetter:0,  autoApply:0,  interview:0,  explainer:0,  jobFit:0  },
  plus:  { tailor:15, coverLetter:15, autoApply:20, interview:15, explainer:15, jobFit:15 },
  ultra: { tailor:50, coverLetter:50, autoApply:50, interview:50, explainer:50, jobFit:50 },
};

function getUserPlan(req) {
  // TEST MODE — change this to test different plans
  // "free" | "plus" | "ultra"
  const TEST_PLAN = "ultra"; // ← change this to test

  // When Stripe is added this will check real subscription
  return TEST_PLAN;
}

function checkLimit(req, feature) {
  const plan = getUserPlan(req);
  const limits = PLAN_LIMITS[plan];
  const max = limits[feature];

  // Free plan — block everything
  if (max === 0) {
    return {
      allowed: false,
      plan,
      message: "This feature requires a Plus or Ultra plan.",
      upgrade: true
    };
  }

  // Check daily usage
  const ip = req.ip;
  const today = new Date().toDateString();
  const key = `${ip}-${feature}-${today}`;

  if (!dailyUsage[key]) dailyUsage[key] = 0;

  if (dailyUsage[key] >= max) {
    return {
      allowed: false,
      plan,
      message: `Daily limit reached. You have used all ${max} ${feature} for today. Come back tomorrow!`,
      upgrade: false,
      resetTime: "midnight"
    };
  }

  dailyUsage[key]++;
  return { allowed: true, plan };
}

// Clean up old usage data every hour
setInterval(() => {
  const today = new Date().toDateString();
  Object.keys(dailyUsage).forEach(key => {
    if (!key.includes(today)) delete dailyUsage[key];
  });
}, 3600000);

// ─── Cache ─────────────────────────────────────────────────────────────────────
let cachedJobs = [];
let lastFetchedAt = null;
let isFetching = false;
let isFetchingAdzuna = false;
let isFetchingJSearch = false;
let isFetchingFlyBy = false;

const getJobTime=j=>{const t=new Date(j.updatedAt||0).getTime();return Number.isFinite(t)?t:0;};
const dedupeJobs=jobs=>{const seen=new Set();return jobs.filter(j=>{if(!j||!j.url||!j.title)return false;const k=`${normalizeText(j.title)}-${normalizeText(j.company||"")}`;if(seen.has(k))return false;seen.add(k);return true;});};

const TECH_WORDS=new Set(["engineer","developer","software","backend","frontend","fullstack","full stack","data","machine learning","ai","architect","analyst","cloud","devops","python","java","react","sql","aws","network","security","qa","tester","salesforce","business analyst","systems","infrastructure","database","dba","administrator","platform","mobile","ios","android","sre","scientist","ml","llm","automation"]);
const US_TERMS=new Set(["united states","usa","u.s.","remote","us only","anywhere","worldwide","north america","new york","nyc","san francisco","sf","bay area","seattle","austin","chicago","boston","los angeles","denver","atlanta","dallas","washington dc","california","texas","illinois","florida","remote (us)","remote - us","remote, us","new jersey","pennsylvania","ohio","michigan","georgia","north carolina","virginia","massachusetts","colorado","arizona","oregon","washington state","minnesota","wisconsin","maryland","connecticut"]);

function preComputeJob(job){
  const tl=normalizeText(job.title),cl=normalizeText(job.company),ll=normalizeText(job.location||""),ds=normalizeText((job.description||"").slice(0,1200)),ft=`${tl} ${cl} ${ds}`;
  const relevant=[...TECH_WORDS].some(w=>tl.includes(w)||ds.includes(w));
  const isUS=!ll||ll==="not specified"||[...US_TERMS].some(t=>ll.includes(t))||job.source==="Greenhouse"||job.source==="Lever"||ds.includes("authorized to work in the us");
  const jobSkills=extractSkills(ft),jobCategories=detectCategories(ft),searchText=`${tl} ${cl} ${ll}`,et=`${tl} ${ds}`;
  let experienceBand="any";
  if(/\b(8|9|10|10\+|15)\+?\s*year|\bstaff\b|\bprincipal\b|\barchitect\b/i.test(et))experienceBand="expert";
  else if(/\b(5|6|7)\+?\s*year|\bsenior\b|\bsr\.\b|\blead\s+(developer|engineer)/i.test(et))experienceBand="senior";
  else if(/\b(2|3|4)\+?\s*year|\bmid.?level\b|\bintermediate\b|\bassociate\b/i.test(et))experienceBand="mid";
  else if(/\b(0|1)\+?\s*year|\bentry.?level\b|\bjunior\b|\bnew\s+grad\b|\bintern\b/i.test(et))experienceBand="entry";
  return{...job,_relevant:relevant,_isUS:isUS,_jobSkills:jobSkills,_jobCategories:jobCategories,_searchText:searchText,experienceBand};
}

function getJobDedupeKey(job) {
  const url = normalizeText(job.url || "");
  if (url) {
    return `url:${url}`;
  }

  const id = normalizeText(job.id || "");
  const source = normalizeText(job.source || "");
  if (id && source) {
    return `id:${source}:${id}`;
  }

  const title = normalizeText(job.title || "");
  const company = normalizeText(job.company || "");
  const location = normalizeText(job.location || "");

  return `fallback:${title}:${company}:${location}`;
}

function mergeAndCacheJobs(newJobs = []) {
  const nowIso = new Date().toISOString();

  const mergedMap = new Map();

  // 1. Keep existing cached jobs first
  for (const oldJob of cachedJobs || []) {
    const key = getJobDedupeKey(oldJob);
    if (!key) continue;

    mergedMap.set(key, {
      ...oldJob,
      firstSeenAt: oldJob.firstSeenAt || oldJob.updatedAt || nowIso,
    });
  }

  // 2. Add/replace with newly fetched jobs
  for (const newJob of newJobs || []) {
    if (!newJob || !newJob.title || !newJob.company) continue;

    const key = getJobDedupeKey(newJob);
    if (!key) continue;

    const existing = mergedMap.get(key);

    mergedMap.set(key, {
      ...(existing || {}),
      ...newJob,

      // posted date should come from the job source
      updatedAt: newJob.updatedAt || existing?.updatedAt || null,

      // firstSeenAt should NOT change every refresh
      firstSeenAt: existing?.firstSeenAt || nowIso,
    });
  }

  let mergedJobs = [...mergedMap.values()];

  // 3. Keep only jobs with real posted date
  mergedJobs = mergedJobs.filter(j => {
    if (!j.updatedAt) return false;
    const t = new Date(j.updatedAt).getTime();
    return Number.isFinite(t);
  });

  // 4. Keep max 3 days only
  const maxAge = 3 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  mergedJobs = mergedJobs.filter(j => {
    const postedTime = new Date(j.updatedAt).getTime();
    const age = now - postedTime;
    return age >= 0 && age <= maxAge;
  });

  // 5. Sort newest first before source balancing
  mergedJobs.sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // 6. Balance sources so Greenhouse/big companies do not dominate top feed
  const sourceBuckets = new Map();

  for (const job of mergedJobs) {
    const source = job.source || "Unknown";
    if (!sourceBuckets.has(source)) sourceBuckets.set(source, []);
    sourceBuckets.get(source).push(job);
  }

  for (const jobs of sourceBuckets.values()) {
    jobs.sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  const sourceOrder = [
    "JSearch",
    "FlyByAPIs",
    "Adzuna",
    "The Muse",
    "DevITjobs",
    "RemoteOK",
    "Remotive",
    "Jobicy",
    "Arbeitnow",
    "Himalayas",
    "WorkingNomads",
    "We Work Remotely",
    "FindWork",
    "Greenhouse",
    "Lever",
    "Workday"
  ];

  const orderedSources = [
    ...sourceOrder.filter(s => sourceBuckets.has(s)),
    ...[...sourceBuckets.keys()].filter(s => !sourceOrder.includes(s))
  ];

  const balancedJobs = [];
  const companyCount = new Map();

  let added = true;

  while (added) {
    added = false;

    for (const source of orderedSources) {
      const bucket = sourceBuckets.get(source);
      if (!bucket || bucket.length === 0) continue;

      let pickedIndex = -1;

      for (let i = 0; i < bucket.length; i++) {
        const job = bucket[i];
        const company = normalizeText(job.company || "unknown");
        const count = companyCount.get(company) || 0;

        // In top 500, avoid same company dominating
        if (count < 3 || balancedJobs.length > 500) {
          pickedIndex = i;
          break;
        }
      }

      if (pickedIndex === -1) pickedIndex = 0;

      const [pickedJob] = bucket.splice(pickedIndex, 1);
      const company = normalizeText(pickedJob.company || "unknown");

      companyCount.set(company, (companyCount.get(company) || 0) + 1);
      balancedJobs.push(pickedJob);
      added = true;

      // no fixed job count limit
    }
  }

  cachedJobs = balancedJobs.map(preComputeJob);
  lastFetchedAt = nowIso;

  return cachedJobs;
}
async function refreshJobs(){
  if(isFetching){console.log("[SmartApply] Already refreshing.");return cachedJobs;}
  isFetching=true;

  const run = async(name, fn) => {
    try {
      const jobs = await fn();
      console.log(`${name}: ${jobs.length} ✅`);
      return Array.isArray(jobs) ? jobs : [];
    } catch(e) {
      console.log(`${name}: FAILED ❌ ${e.message}`);
      return [];
    }
  };

  // Run in batches of 5 to avoid network flooding
  const runBatch = async(items) => {
    const results = [];
    for(let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(([name, fn]) => run(name, fn)));
      results.push(...batchResults);
      // Small pause between batches to avoid network flooding
      await new Promise(r => setTimeout(r, 500));
    }
    return results;
  };

  try {
    console.log("\n======= SMARTAPPLY JOB REFRESH =======");

    // Build all sources as named pairs
    const greenhouseSources = GREENHOUSE_SOURCES.map(s => [`GH/${s.company}`, () => fetchGreenhouseJobs(s)]);
    const leverSources = LEVER_SOURCES.map(s => [`LV/${s.company}`, () => fetchLeverJobs(s)]);
    const workdaySources = WORKDAY_SOURCES.map(s => [`WD/${s.company}`, () => fetchWorkdayJobs(s)]);

    const aggregatorSources = [
  ["WeWorkRemotely", fetchWWRJobs],
  ["Remotive", fetchRemotiveJobs],
  ["RemoteOK", fetchRemoteOkJobs],
  ["Himalayas", fetchHimalayasJobs],
  ["Arbeitnow", fetchArbeitnowJobs],
  ["FindWork", fetchFindWorkJobs],
  ["Jobicy", fetchJobicyJobs],
  ["DevITjobs", fetchDevITJobs],
  ["WorkingNomads", fetchWorkingNomadsJobs],
  ["HackerNews", fetchHackerNewsJobs],
];

const slowSources = [
  ["TheMuse", fetchMuseJobs],
];

    // Run all sources in batches
    const allSources = [...greenhouseSources, ...leverSources, ...aggregatorSources, ...workdaySources];
    const allResults = await runBatch(allSources);
    const slowResults = await runBatch(slowSources);
    const slowJobs = slowResults.flat();

    // Separate greenhouse, lever, aggregator and workday results
    const ghCount = greenhouseSources.length;
    const lvCount = leverSources.length;
    const agCount = aggregatorSources.length;

    const ghJobs = allResults.slice(0, ghCount).flat();
    const lvJobs = allResults.slice(ghCount, ghCount + lvCount).flat();
    const agJobs = allResults.slice(ghCount + lvCount, ghCount + lvCount + agCount).flat();
    const wdJobs = allResults.slice(ghCount + lvCount + agCount).flat();

    const all = [
  ...ghJobs,
  ...lvJobs,
  ...agJobs,
  ...wdJobs,
  ...slowJobs,
];

    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    const filtered = dedupeJobs(all)
      .filter(j => j.url && j.title)
      .filter(j => {
        if (!j.updatedAt) return false;
        return new Date(j.updatedAt).getTime() > threeDaysAgo;
      })
      .sort((a, b) => getJobTime(b) - getJobTime(a));

    const FRESH_WINDOW_MS = 60 * 60 * 1000; // last 1 hour
const nowForFreshSort = Date.now();

const freshJobs = [];
const olderJobs = [];

for (const job of filtered) {
  const postedTime = new Date(job.updatedAt || 0).getTime();

  if (
    Number.isFinite(postedTime) &&
    nowForFreshSort - postedTime >= 0 &&
    nowForFreshSort - postedTime <= FRESH_WINDOW_MS
  ) {
    freshJobs.push(job);
  } else {
    olderJobs.push(job);
  }
}

const companyCategories = {};

const olderDiversified = olderJobs.filter(j => {
  const company = normalizeText(j.company || "unknown");
  const title = normalizeText(j.title || "");

  let category = "general";
  if (/frontend|react|angular|vue|ui engineer|css|html/.test(title)) category = "frontend";
  else if (/machine learning|ml engineer|ai engineer|llm|nlp/.test(title)) category = "aiml";
  else if (/data engineer|data scientist|data analyst|etl|spark|airflow/.test(title)) category = "data";
  else if (/devops|cloud engineer|sre|platform engineer|infrastructure|kubernetes|docker/.test(title)) category = "clouddevops";
  else if (/database|dba|sql server|oracle dba|postgresql admin/.test(title)) category = "database";
  else if (/security|cybersecurity|soc analyst|penetration/.test(title)) category = "cybersecurity";
  else if (/mobile|ios|android|flutter|react native/.test(title)) category = "mobile";
  else if (/network engineer|network administrator|cisco/.test(title)) category = "networking";
  else if (/qa|quality assurance|test engineer|sdet/.test(title)) category = "qa";
  else if (/business analyst|product manager|product owner/.test(title)) category = "business";
  else if (/salesforce|servicenow|workday/.test(title)) category = "platform";
  else if (/software engineer|backend|full stack|fullstack|developer/.test(title)) category = "software";
  else if (/manager|director|vp |vice president|head of/.test(title)) category = "management";
  else if (/analyst|research|scientist/.test(title)) category = "analyst";
  else if (/designer|ux|ui design/.test(title)) category = "design";
  else if (/sales|marketing|growth/.test(title)) category = "sales";
  else if (/recruiter|hr |people ops/.test(title)) category = "hr";

  let seniority = "mid";
  if (/\bstaff\b|\bprincipal\b|\bdistinguished\b/.test(title)) seniority = "staff";
  else if (/\bsenior\b|\bsr\b|\blead\b/.test(title)) seniority = "senior";
  else if (/\bjunior\b|\bjr\b|\bentry\b|\bassociate\b|\bnew grad\b/.test(title)) seniority = "junior";
  else if (/\bmanager\b|\bdirector\b|\bvp\b|\bhead\b/.test(title)) seniority = "manager";
  else if (/\bintern\b/.test(title)) seniority = "intern";

  const key = `${company}__${category}__${seniority}`;
  if (!companyCategories[key]) companyCategories[key] = 0;
  companyCategories[key]++;

  return companyCategories[key] <= 1;
});

const diversified = [...freshJobs, ...olderDiversified]
  .sort((a, b) => getJobTime(b) - getJobTime(a));

mergeAndCacheJobs(diversified);

console.log(`TOTAL: ${cachedJobs.length} jobs cached`);
console.log("======================================\n");
return cachedJobs;

  } finally {
    isFetching = false;
  }
}

setInterval(()=>refreshJobs().catch(e=>console.error("[Auto-refresh]",e.message)),20*60*1000);

function getChicagoScheduleParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type)?.value;

  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
    hour: Number(get("hour")),
  };
}

let lastAdzunaRunKey = "";
let lastJSearchRunKey = "";
let lastFlyByRunKey = "";

function getLimitedApiPageLimit() {
  const { weekday, hour } = getChicagoScheduleParts();

  const isWeekend = weekday === "Sat" || weekday === "Sun";

  if (!isWeekend) {
    if ([8, 10, 12].includes(hour)) return 2;
    if (hour === 13) return 1; // 1 PM
    return 0;
  }

  // Weekend: 10 AM only, 1 page
  if (hour === 10) return 1;

  return 0;
}

async function refreshAdzunaOnly(pageLimit = 3) {
  if (isFetchingAdzuna) {
    console.log("[Adzuna] Already refreshing.");
    return cachedJobs;
  }

  isFetchingAdzuna = true;

  try {
    console.log(`\n======= ADZUNA REFRESH pageLimit=${pageLimit} =======`);

    const jobs = await fetchAdzunaJobs(pageLimit);
    console.log(`Adzuna separate: ${jobs.length} ✅`);

    mergeAndCacheJobs(jobs);

    console.log(`TOTAL after Adzuna: ${cachedJobs.length} jobs cached`);
    console.log("======================================\n");

    return cachedJobs;
  } catch (e) {
    console.warn(`[Adzuna refresh] ${e.message}`);
    return cachedJobs;
  } finally {
    isFetchingAdzuna = false;
  }
}

async function refreshFlyByOnly(pageLimit = 1) {
  if (isFetchingFlyBy) {
    console.log("[FlyByAPIs] Already refreshing.");
    return cachedJobs;
  }

  isFetchingFlyBy = true;

  try {
    console.log(`\n======= FLYBYAPIS REFRESH pageLimit=${pageLimit} =======`);

    const jobs = await fetchFlyByJobs(pageLimit);
    console.log(`FlyByAPIs separate: ${jobs.length} ✅`);

    const filtered = jobs
      .filter(isRelevantTechJob)
      .filter(isUSJob);

    mergeAndCacheJobs(filtered);

    console.log(`TOTAL after FlyByAPIs: ${cachedJobs.length} jobs cached`);
    console.log("======================================\n");

    return cachedJobs;
  } catch (e) {
    console.warn(`[FlyByAPIs refresh] ${e.message}`);
    return cachedJobs;
  } finally {
    isFetchingFlyBy = false;
  }
}


async function refreshJSearchOnly(pageLimit = 1) {
  if (isFetchingJSearch) {
    console.log("[JSearch] Already refreshing.");
    return cachedJobs;
  }

  isFetchingJSearch = true;

  try {
    console.log(`\n======= JSEARCH REFRESH pageLimit=${pageLimit} =======`);

    const jobs = await fetchJSearchJobs(pageLimit);
    console.log(`JSearch separate: ${jobs.length} ✅`);

    const filtered = jobs
      .filter(isRelevantTechJob)
      .filter(isUSJob);

    mergeAndCacheJobs(filtered);

    console.log(`TOTAL after JSearch: ${cachedJobs.length} jobs cached`);
    console.log("======================================\n");

    return cachedJobs;
  } catch (e) {
    console.warn(`[JSearch refresh] ${e.message}`);
    return cachedJobs;
  } finally {
    isFetchingJSearch = false;
  }
}

// Adzuna schedule:
// Monday-Friday: every hour
// Saturday-Sunday: only 10 AM
// Weekday normal hour = 3 pages
// Weekday every 3rd hour = 4 pages
// Weekend 10 AM = 3 pages only
setInterval(() => {
  const { dateKey, weekday, hour } = getChicagoScheduleParts();

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const weekends = ["Sat", "Sun"];

  let shouldRun = false;
  let pageLimit = 3;

  if (weekdays.includes(weekday)) {
    shouldRun = true;
    pageLimit = hour % 3 === 0 ? 4 : 3;
  }

  if (weekends.includes(weekday) && hour === 10) {
    shouldRun = true;
    pageLimit = 3;
  }

  if (!shouldRun) return;

  const runKey = `${dateKey}-${hour}`;
  if (lastAdzunaRunKey === runKey) return;

  lastAdzunaRunKey = runKey;

  refreshAdzunaOnly(pageLimit)
    .catch(e => console.error("[Adzuna Auto-refresh]", e.message));
}, 60 * 1000);

// JSearch + FlyByAPIs schedule:
// Monday-Friday:
// 8 AM  = 2 pages
// 10 AM = 2 pages
// 12 PM = 2 pages
// 1 PM  = 1 page
//
// Saturday-Sunday:
// 10 AM = 1 page
setInterval(async () => {
  try {
    const { dateKey, hour } = getChicagoScheduleParts();
    const pageLimit = getLimitedApiPageLimit();

    if (!pageLimit) return;

    const runKey = `${dateKey}-${hour}`;

    if (lastJSearchRunKey !== runKey) {
      lastJSearchRunKey = runKey;
      await refreshJSearchOnly(pageLimit);
    }

    if (lastFlyByRunKey !== runKey) {
      lastFlyByRunKey = runKey;
      await refreshFlyByOnly(pageLimit);
    }
  } catch (e) {
    console.error("[Limited API Auto-refresh]", e.message);
  }
}, 60 * 1000);

// ─── Filtering ─────────────────────────────────────────────────────────────────
const TRUSTED_SOURCES = new Set([
  "JSearch",
  "FlyByAPIs",
  "Adzuna",
  "The Muse",
  "DevITjobs",
  "WorkingNomads",
  "HackerNews",
  "Remotive",
  "RemoteOK",
  "Himalayas",
  "Arbeitnow",
  "Jobicy",
  "Greenhouse",
  "Lever",
  "Workday"
]);
const isRelevantTechJob=j=>{
  if(TRUSTED_SOURCES.has(j.source))return true;
  if(j._relevant!==undefined)return j._relevant;
  return[...TECH_WORDS].some(w=>normalizeText(`${j.title} ${j.description}`).includes(w));
};
const isUSJob = j => {
  if(TRUSTED_SOURCES.has(j.source))return true;
  if (j._isUS !== undefined) return j._isUS;
  const loc = (j.location || "").toLowerCase();
  if (!loc || loc === "n/a" || loc === "not specified") return false;
  const US_TERMS = ["united states","usa","u.s.","remote","us only",
    "anywhere","north america","new york","nyc","san francisco","sf",
    "bay area","seattle","austin","chicago","boston","los angeles",
    "denver","atlanta","dallas","washington dc","california","texas",
    "illinois","florida","new jersey","pennsylvania","ohio","michigan",
    "georgia","north carolina","virginia","massachusetts","colorado",
    "arizona","oregon","washington state","minnesota","wisconsin",
    "maryland","connecticut","remote (us)","remote - us","remote, us"];
  return US_TERMS.some(t => loc.includes(t));
};

function filterByRange(jobs, r = "24h") {
  const now = Date.now();

  // We do not want old jobs in the main feed.
  // "all" will also behave like max 3 days, not unlimited old jobs.
  const RANGE_MS = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "3d": 3 * 24 * 60 * 60 * 1000,
    "all": 3 * 24 * 60 * 60 * 1000,
  };

  const maxAge = RANGE_MS[r] || RANGE_MS["3d"];

  return jobs.filter(j => {
    if (!j.updatedAt) return false;

    const postedTime = new Date(j.updatedAt).getTime();
    if (!Number.isFinite(postedTime)) return false;

    const age = now - postedTime;

    // Remove future dates and anything older than selected range
    return age >= 0 && age <= maxAge;
  });
}

function filterByWorkType(jobs,wt){
  if(!wt||wt==="all")return jobs;
  return jobs.filter(j=>{
    const loc=normalizeText(j.location||""),text=normalizeText(`${j.location} ${(j.description||"").slice(0,400)}`);
    return wt==="remote"?loc.includes("remote")||text.includes("work from home"):wt==="hybrid"?text.includes("hybrid"):!loc.includes("remote")&&!text.includes("remote")&&!text.includes("hybrid");
  });
}

const ROLE_SEARCH_TERMS = {
  "Software Engineer": [
    "software engineer",
    "software developer",
    "application developer",
    "backend engineer",
    "full stack developer",
    "sde"
  ],
  "Frontend Engineer": [
    "frontend engineer",
    "front end developer",
    "react developer",
    "angular developer",
    "vue developer",
    "ui engineer",
    "javascript developer",
    "typescript developer"
  ],
  "Data Engineer": [
    "data engineer",
    "etl developer",
    "pipeline engineer",
    "analytics engineer",
    "big data engineer",
    "spark developer",
    "airflow engineer",
    "data platform engineer"
  ],
  "Data Analyst": [
    "data analyst",
    "business intelligence analyst",
    "bi developer",
    "reporting analyst",
    "sql analyst",
    "tableau developer",
    "power bi developer",
    "analytics analyst"
  ],
  "DevOps Engineer": [
    "devops engineer",
    "cloud engineer",
    "infrastructure engineer",
    "site reliability engineer",
    "sre",
    "platform engineer",
    "ci/cd engineer",
    "kubernetes engineer"
  ],
  "Cloud Engineer": [
    "cloud engineer",
    "aws engineer",
    "azure engineer",
    "gcp engineer",
    "cloud infrastructure engineer",
    "cloud devops engineer",
    "cloud platform engineer"
  ],
  "Machine Learning Engineer": [
    "machine learning engineer",
    "ml engineer",
    "ai engineer",
    "mlops engineer",
    "nlp engineer",
    "computer vision engineer",
    "deep learning engineer"
  ],
  "AI Engineer": [
    "ai engineer",
    "llm engineer",
    "generative ai engineer",
    "prompt engineer",
    "ai platform engineer",
    "ai product engineer"
  ],
  "Data Scientist": [
    "data scientist",
    "applied scientist",
    "research scientist",
    "machine learning scientist",
    "statistical analyst",
    "quantitative analyst"
  ],
  "Database Administrator": [
    "database administrator",
    "dba",
    "sql server dba",
    "oracle dba",
    "postgresql dba",
    "mysql dba",
    "database engineer",
    "database reliability engineer"
  ],
  "QA Engineer": [
    "qa engineer",
    "quality assurance engineer",
    "test engineer",
    "sdet",
    "automation engineer",
    "qa automation engineer",
    "manual tester",
    "performance test engineer"
  ],
  "Cybersecurity Analyst": [
    "cybersecurity analyst",
    "security analyst",
    "soc analyst",
    "security engineer",
    "information security analyst",
    "application security engineer",
    "cloud security engineer",
    "threat analyst"
  ],
  "Network Engineer": [
    "network engineer",
    "network administrator",
    "network operations engineer",
    "noc engineer",
    "cisco engineer",
    "infrastructure network engineer",
    "wireless network engineer"
  ],
  "Business Analyst": [
    "business analyst",
    "technical business analyst",
    "systems analyst",
    "requirements analyst",
    "product analyst",
    "functional analyst",
    "process analyst"
  ],
  "Salesforce Developer": [
    "salesforce developer",
    "salesforce engineer",
    "apex developer",
    "salesforce admin",
    "salesforce administrator",
    "crm developer",
    "salesforce consultant"
  ],
  "Systems Engineer": [
    "systems engineer",
    "systems administrator",
    "linux engineer",
    "windows systems engineer",
    "it systems engineer",
    "infrastructure engineer",
    "systems reliability engineer"
  ],
  "Mobile Developer": [
    "mobile developer",
    "ios developer",
    "android developer",
    "react native developer",
    "flutter developer",
    "swift developer",
    "kotlin developer",
    "mobile engineer"
  ],
  "Site Reliability Engineer": [
    "site reliability engineer",
    "sre",
    "production engineer",
    "reliability engineer",
    "devops sre",
    "cloud reliability engineer",
    "infrastructure reliability engineer"
  ],
  "Solutions Architect": [
    "solutions architect",
    "cloud architect",
    "technical architect",
    "enterprise architect",
    "software architect",
    "data architect",
    "integration architect"
  ],
  "Java Developer": [
    "java developer",
    "java engineer",
    "spring boot developer",
    "java backend developer",
    "j2ee developer",
    "java full stack developer"
  ],
  "Python Developer": [
    "python developer",
    "python engineer",
    "django developer",
    "flask developer",
    "python backend developer",
    "python full stack developer"
  ],
  "Full Stack Developer": [
    "full stack developer",
    "full stack engineer",
    "mern stack developer",
    "mean stack developer",
    "web application developer",
    "full stack javascript developer",
    "full stack python developer"
  ]
};

function getRoleSearchTerms(role = "") {
  const cleanRole = String(role || "").trim();
  if (!cleanRole) return [];

  return ROLE_SEARCH_TERMS[cleanRole] || [cleanRole.toLowerCase()];
}

function filterJobsByRoleTerms(jobs, keyword = "") {
  const role = String(keyword || "").trim();
  if (!role) return jobs;

  const terms = getRoleSearchTerms(role).map(t => t.toLowerCase());

  return jobs.filter(j => {
    const text = `${j.title || ""} ${j.description || ""}`.toLowerCase();
    return terms.some(term => text.includes(term));
  });
}

// ─── Match Logic ───────────────────────────────────────────────────────────────
function calculateJobMatch(job,resumeSkills=[],resumeCategories=[]){
  const jobSkills=job._jobSkills||extractSkills(normalizeText(`${job.title} ${job.company} ${job.description}`));
  const jobCategories=job._jobCategories||detectCategories(normalizeText(`${job.title} ${job.company} ${job.description}`));
  const resumeSet=new Set(resumeSkills.map(s=>s.toLowerCase()));
  const resumeText=normalizeText(resumeSkills.join(" "));
  const jobTitle=normalizeText(job.title);
  const matched=jobSkills.filter(s=>resumeSet.has(s.toLowerCase()));
  const missing=jobSkills.filter(s=>!resumeSet.has(s.toLowerCase()));
  let score=25;
  if(jobSkills.length>0)score+=Math.round((matched.length/jobSkills.length)*45);else score+=10;
  if(matched.length>=2)score+=5;if(matched.length>=4)score+=7;if(matched.length>=7)score+=7;if(matched.length>=10)score+=5;
  [
    ["database",["sql","sql server","oracle","postgresql","dba","query optimization","indexing"]],
    ["dba",["sql","sql server","oracle","query optimization","always on"]],
    ["software",["java","python","javascript","typescript"]],
    ["backend",["api","java","python","spring","node"]],
    ["frontend",["react","javascript","typescript","vue"]],
    ["data",["sql","spark","airflow","snowflake","dbt","python"]],
    ["cloud",["aws","azure","gcp","docker","kubernetes"]],
    ["devops",["docker","kubernetes","jenkins","terraform"]],
    ["security",["security","cybersecurity","siem"]],
    ["machine learning",["python","tensorflow","pytorch","scikit-learn"]],
  ].forEach(([kw,skills])=>{if(jobTitle.includes(kw)&&skills.some(s=>resumeText.includes(s)))score+=10;});
  const rcSet=new Set(resumeCategories.map(i=>i.category));
  jobCategories.slice(0,2).forEach(i=>{if(rcSet.has(i.category))score+=8;});
  if(matched.length===0&&jobSkills.length>=4)score-=12;
  return{...job,jobSkills,jobCategories,matchedSkills:matched,missingSkills:missing,matchCount:matched.length,matchScore:Math.max(15,Math.min(95,Math.round(score)))};
}

function applyAutoMatch(jobs,rsk,rca=""){
  const resumeSkills=rsk?rsk.split("|").map(s=>s.trim()).filter(Boolean):[];
  let resumeCategories=[];try{resumeCategories=rca?JSON.parse(rca):[];}catch{}
  return jobs.map(j=>calculateJobMatch(j,resumeSkills,resumeCategories)).sort((a,b)=>b.matchScore-a.matchScore);
}

function makeTailorAnalysis(resumeText,job){
  const rs=extractSkills(resumeText),rc=detectCategories(resumeText);
  // Make sure job has description for proper matching
  const enrichedJob = {
    ...job,
    description: job.description || "",
    _jobSkills: extractSkills(`${job.title} ${job.description||""}`),
  };
  const m=calculateJobMatch(enrichedJob,rs,rc);
  return{
    jobTitle:job.title,company:job.company,currentScore:m.matchScore,
    matchedSkills:m.matchedSkills,missingSkills:m.missingSkills.slice(0,12),
    improvementSuggestions:[
      "Mirror key job keywords naturally in your summary and experience bullets.",
      "Move the most relevant role-specific bullets closer to the top of each position.",
      "Add measurable impact: performance %, uptime %, time saved, query speed gains.",
    ],
    bulletSuggestions:m.missingSkills.slice(0,6).map(s=>`Applied ${s} in production workflows to improve reliability, efficiency, or business impact.`),
    resumeStrengths:rs.slice(0,18),
    jobDescription:job.description||"",
  };
}
// ─── Auto Apply Helpers ────────────────────────────────────────────────────────

// Rate limit storage (use Redis in production)
const autoApplyLimits = {};

function checkAutoApplyLimit(userId) {
  const today = new Date().toDateString();
  const key = `${userId}-${today}`;
  if (!autoApplyLimits[key]) autoApplyLimits[key] = 0;
  if (autoApplyLimits[key] >= 20) return false;
  autoApplyLimits[key]++;
  return true;
}

// Get only Greenhouse and Lever jobs for auto apply
function getAutoApplyJobs(skills = [], categories = []) {
  const US_LOCATIONS = [
    "united states","usa","u.s.", "remote","us only","anywhere",
    "north america","new york","nyc","san francisco","sf","bay area",
    "seattle","austin","chicago","boston","los angeles","denver",
    "atlanta","dallas","washington dc","california","texas","illinois",
    "florida","new jersey","pennsylvania","ohio","michigan","georgia",
    "north carolina","virginia","massachusetts","colorado","arizona",
    "oregon","minnesota","wisconsin","maryland","connecticut",
    "remote (us)","remote - us","remote, us"
  ];

  const isRealUSJob = (job) => {
    const loc = (job.location || "").toLowerCase().trim();
    if (!loc || loc === "n/a" || loc === "not specified" || loc === "") {
      return false;
    }
    return US_LOCATIONS.some(t => loc.includes(t));
  };

  const eligible = cachedJobs.filter(j =>
    (j.source === "Greenhouse" || j.source === "Lever") &&
    isRealUSJob(j)
  );

  const scored = eligible
    .map(j => calculateJobMatch(j, skills, categories))
    .filter(j => j.matchScore >= 15)
    .sort((a, b) => b.matchScore - a.matchScore);

  // Max 2 jobs per company
  const companyCounts = {};
const diversified = scored.filter(j => {
  const company = normalizeText(j.company || "unknown");
  companyCounts[company] = (companyCounts[company] || 0) + 1;
  return companyCounts[company] <= 2;
});

  return diversified.slice(0, 20);
}
async function submitGreenhouse(job, userData, resumeText, coverLetter) {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: false, args: ["--no-sandbox","--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    console.log(`[Puppeteer] Opening: ${job.url}`);
    
    await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log(`[Puppeteer] Page loaded`);
    
    await new Promise(r => setTimeout(r, 3000));
    console.log(`[Puppeteer] Taking screenshot`);
    
    await page.screenshot({ path: `C:/Users/muvva/OneDrive/Desktop/SR-Applied/backend/apply-test.png` });
    console.log(`[Puppeteer] Screenshot saved`);

    // Detect if form is in iframe or on main page
    const frames = page.frames();
    const ghFrame = frames.find(f => f.url().includes("greenhouse.io"));
    const target = ghFrame || page;
    console.log(`[Puppeteer] Using ${ghFrame ? "iframe" : "main page"}`);

    const typeInto = async (selector, value) => {
      try {
        await target.waitForSelector(selector, { timeout: 3000 });
        await target.click(selector, { clickCount: 3 });
        await target.type(selector, value, { delay: 50 });
      } catch(e) {}
    };

    await typeInto("input[name='first_name']", userData.firstName || "");
    await typeInto("input[name='last_name']", userData.lastName || "");
    await typeInto("input[name='email']", userData.email || "");
    await typeInto("input[name='phone']", userData.phone || "");
    await typeInto("textarea[name='cover_letter_text']", coverLetter || "");

    const emailValue = await target.$eval("input[name='email']", el => el.value).catch(() => "");
    console.log(`[Puppeteer] Email filled: "${emailValue}"`);

    if (!emailValue) {
      await page.screenshot({ path: `C:/Users/muvva/OneDrive/Desktop/SR-Applied/backend/apply-empty.png` });
      await browser.close();
      return "needs_attention";
    }

    const hasCaptcha = await target.$("iframe[src*='recaptcha'],iframe[src*='hcaptcha']");
    if (hasCaptcha) {
      console.log(`[Puppeteer] CAPTCHA detected`);
      await browser.close();
      return "needs_attention";
    }

    await target.click("button[type='submit']").catch(() => {});
    await new Promise(r => setTimeout(r, 4000));

    const pageText = await page.evaluate(() => document.body.innerText);
    const success = /thank you|application submitted|received your application|successfully applied/i.test(pageText);
    console.log(`[Puppeteer] Success: ${success}`);

    await browser.close();
    return success ? "applied" : "needs_attention";

  } catch(e) {
    if (browser) await browser.close();
    console.error(`[Puppeteer] Greenhouse failed: ${e.message}`);
    return "failed";
  }
}

// Submit to Lever
async function submitLever(job, userData, resumeText, coverLetter) {
  try {
    const parts = job.id.replace("lv-", "").split("-");
    const board = parts[0];
    const jobId = parts.slice(1).join("-");

    const formData = new FormData();
    formData.append("name", `${userData.firstName} ${userData.lastName}`);
    formData.append("email", userData.email || "");
    formData.append("phone", userData.phone || "");
    formData.append("comments", coverLetter || "");

    const resumeBlob = new Blob([resumeText], { type: "text/plain" });
    formData.append("resume", resumeBlob, "resume.txt");

    const res = await fetch(
      `https://jobs.lever.co/${board}/${jobId}/apply`,
      { method: "POST", body: formData, signal: AbortSignal.timeout(15000) }
    );

    return res.ok ? "applied" : "failed";
  } catch (e) {
    console.error(`Lever apply failed: ${e.message}`);
    return "failed";
  }
}
// ─── AI Resume Scorer ──────────────────────────────────────────────────────────
function scoreResumeAgainstJob(resumeText, jobTitle, jobDescription, selectedSkills) {
  const jobText = `${jobTitle} ${jobDescription||""} ${(selectedSkills||[]).join(" ")}`;
  const jobKeywords = extractSkills(jobText);
  const resumeSkills = extractSkills(resumeText);
  const resumeLower = resumeText.toLowerCase();

  // 1. Keyword match — 0 to 4 points
  let keywordScore = 0;
  if (jobKeywords.length > 0) {
    const matched = jobKeywords.filter(k => resumeSkills.includes(k)).length;
    keywordScore = parseFloat(((matched / jobKeywords.length) * 4).toFixed(2));
  }

  // 2. Skills coverage — 0 to 3 points
  let skillScore = 0;
  if (selectedSkills && selectedSkills.length > 0) {
    const matched = selectedSkills.filter(s => resumeLower.includes(s.toLowerCase())).length;
    skillScore = parseFloat(((matched / selectedSkills.length) * 3).toFixed(2));
  } else {
    skillScore = keywordScore > 0 ? 1.5 : 0;
  }

  // 3. Impact metrics — 0 to 2 points
  const metricMatches = (resumeText.match(/\d+%|\$\d+|\d+x|\d+\+/g) || []).length;
  const impactScore = parseFloat((Math.min(metricMatches / 5, 1) * 2).toFixed(2));

  // 4. Summary match — 0 to 1 point
  const summarySection = resumeText.slice(0, 600).toLowerCase();
  const titleWords = jobTitle.toLowerCase().split(" ").filter(w => w.length > 3);
  const summaryMatches = titleWords.filter(w => summarySection.includes(w)).length;
  const summaryScore = parseFloat((Math.min(summaryMatches / Math.max(titleWords.length, 1), 1)).toFixed(2));

  const total = parseFloat((keywordScore + skillScore + impactScore + summaryScore).toFixed(1));
  return Math.min(10, Math.max(0, total));
}
// ─── API Routes ────────────────────────────────────────────────────────────────

app.get("/api/health",(_,res)=>res.json({ok:true,cachedCount:cachedJobs.length,lastFetchedAt}));

app.post("/api/upload-resume",upload.single("resume"),async(req,res)=>{
  try{
    if(!req.file)return res.status(400).json({error:"No file uploaded"});
    if(!ALLOWED_MIME.includes(req.file.mimetype))return res.status(400).json({error:"Only PDF and DOCX files are accepted."});
    const text=await extractResumeText(req.file);
    if(!text.trim())return res.status(400).json({error:"Could not extract text from resume."});
    const a=analyzeResumeText(text);
    res.json({success:true,resume:{fileName:req.file.originalname,atsScore:a.atsScore,skills:a.skills,categories:a.categories,resumeText:a.resumeText,profile:a.profile}});
  }catch(e){console.error("UPLOAD:",e.message);res.status(500).json({error:e.message||"Upload failed"});}
});

app.get("/api/jobs",async(req,res)=>{
  try{
    const range = String(req.query.range || "24h"),keyword=String(req.query.keyword||"").trim().slice(0,2000),categories=String(req.query.categories||"").trim().slice(0,2000),workType=String(req.query.workType||"all").trim(),forceRefresh=req.query.refresh==="true";
    if(forceRefresh && !isFetching){
  refreshJobs().catch(e=>console.error("[Manual refresh]",e.message));
}
    let jobs=cachedJobs.filter(j=>isRelevantTechJob(j)&&isUSJob(j));
    jobs=filterByRange(jobs,range);jobs=filterByWorkType(jobs,workType);
    if (keyword) {
  jobs = filterJobsByRoleTerms(jobs, keyword);
  jobs = applyAutoMatch(jobs, keyword, categories);
}

// FINAL SORT: newest posted jobs first
jobs = jobs.sort((a, b) => {
  const timeDiff = getJobTime(b) - getJobTime(a);
  if (timeDiff !== 0) return timeDiff;

  // If two jobs have same posted time, then use match score
  return (b.matchScore || 0) - (a.matchScore || 0);
});
    const lean=jobs.map(({_relevant,_isUS,_jobSkills,_jobCategories,_searchText,...rest})=>({...rest,jobSkills:_jobSkills||[],jobCategories:_jobCategories||[],searchText:_searchText||"",description:(rest.description||"").slice(0,3000)}));
    res.json({lastFetchedAt,count:lean.length,range,jobs:lean});
  }catch(e){console.error("JOBS:",e.message);res.status(500).json({error:"Failed to fetch jobs"});}
});

app.post("/api/match-job",(req,res)=>{
  try{
    const p=matchSchema.safeParse(req.body);
    if(!p.success)return res.status(400).json({error:"Invalid input"});
    const{resumeText,jobDescription}=p.data;
    const rs=extractSkills(resumeText),rc=detectCategories(resumeText);
    const m=calculateJobMatch({title:"Manual",company:"Manual",location:"",description:jobDescription},rs,rc);
    res.json({matchScore:m.matchScore,matched:m.matchedSkills,missing:m.missingSkills,recommendations:[m.missingSkills.length?`Add these naturally if you have the experience: ${m.missingSkills.join(", ")}.`:"Strong match. Focus on tailoring your summary and top bullet points."],bulletSuggestions:m.missingSkills.slice(0,5).map(s=>`Applied ${s} in production workflows to improve reliability, efficiency, or business impact.`)});
  }catch(e){console.error("MATCH:",e.message);res.status(500).json({error:"Match failed"});}
});

app.post("/api/tailor-analyze",(req,res)=>{
  try{
    const p=tailorSchema.safeParse(req.body);
    if(!p.success)return res.status(400).json({error:"Invalid input"});
    res.json(makeTailorAnalysis(p.data.resumeText,p.data.job));
  }catch(e){console.error("TAILOR:",e.message);res.status(500).json({error:"Tailor analysis failed"});}
});

// ─── UPDATED: Generate Tailored Resume — Real AI Rewriting ────────────────────
app.post("/api/generate-tailored-resume", async (req, res) => {
  try {
    const p = generateSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid input" });
    const { resumeText, job, selectedSkills = [] } = p.data;
// Check plan limit
    const limit = checkLimit(req, "tailor");
    if (!limit.allowed) {
      return res.status(429).json({
        error: limit.message,
        upgrade: limit.upgrade,
        plan: limit.plan
      });
    }
    // Parse resume into structured sections
    const parseResumeSections = (text) => {
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      const sections = { header:"", summary:"", skills:"", experience:"", education:"" };
      let current = "header";
      const sectionMap = {
        summary:    ["summary","professional summary","objective","profile"],
        skills:     ["technical skills","skills","core competencies","technologies"],
        experience: ["experience","professional experience","work experience","employment"],
        education:  ["education","academic"],
      };
      lines.forEach(line => {
        const lower = line.toLowerCase();
        let matched = false;
        for (const [section, keywords] of Object.entries(sectionMap)) {
          if (keywords.some(k => lower.includes(k)) && line.length < 60) {
            current = section; matched = true; break;
          }
        }
        if (!matched) sections[current] = (sections[current] || "") + "\n" + line;
      });
      return sections;
    };

    const sections = parseResumeSections(resumeText);
    const jobContext = `Job Title: ${job.title}\nCompany: ${job.company}\nJob Description: ${(job.description||"").slice(0,1500)}\nRequired Skills to incorporate: ${selectedSkills.join(", ")}`;

    // Rewrite summary
    const [newSummary, newSkills, newExperience] = await Promise.all([
  callGroq([
    {
      role: "system",
      content: "You are an expert resume writer. Rewrite the professional summary to better match the job. Keep it to 2-3 sentences. Return only the summary text, no labels, no headers."
    },
    {
      role: "user",
      content: `${jobContext}\n\nOriginal Summary:\n${sections.summary}\n\nIMPORTANT: Return ONLY the rewritten summary paragraph. No labels, no headers, no commentary, no bold formatting. Just plain text paragraph.`
    }
  ], 300),

  callGroq([
    {
      role: "system",
      content: "You are an expert resume writer. Update the technical skills section to include relevant skills for the job. Keep the exact same bullet category format. Add missing relevant skills naturally. Return only the skills content, no section header."
    },
    {
      role: "user",
      content: `${jobContext}\n\nOriginal Skills:\n${sections.skills}\n\nSkills the user wants to ADD to their resume: ${selectedSkills.length ? selectedSkills.join(", ") : "none"}\n\nIMPORTANT RULES:\n- Add ONLY the skills listed above under "Skills the user wants to ADD" — nothing else\n- Do NOT add any other skills that are not in that list\n- Keep all existing skills exactly as they are\n- Place new skills in the most relevant existing category\n- If no category fits, add a new category at the end\n- Return ONLY the skills content, no headers, no commentary, no ** markdown\n- Use plain text bullet points starting with •`
    }
  ], 500),

  callGroq([
    {
      role: "system",
      content: `You are an expert resume writer. Rewrite ONLY the bullet points in the work experience section to better match the target job.
STRICT RULES:
- Keep EVERY company name, job title, location, and date EXACTLY as they appear - do not change or remove them
- Keep the exact same number of bullet points for each job
- Only improve the bullet point text to include relevant keywords from the job description
- Start each bullet with • symbol and a strong action verb
- Do NOT add any commentary, introduction, or explanation
- Do NOT use any markdown like ** or *
- Return ONLY the experience content, nothing else
- Format must be: Company Name on one line, Title | Location on next line, Date on next line, then bullet points`
    },
    {
      role: "user",
      content: `${jobContext}\n\nOriginal Experience:\n${sections.experience}\n\nSelected skills to naturally incorporate into bullet points: ${selectedSkills.length ? selectedSkills.join(", ") : "none"}\n\nSTRICT RULES:\n- Keep EVERY company name, job title, location, and date EXACTLY as they appear\n- Keep the same number of bullet points per job\n- Naturally mention the selected skills above inside the bullet points where they fit\n- Start each bullet with • and a strong action verb\n- Add or improve metrics where possible\n- Do NOT add commentary or introduction sentences\n- Do NOT use ** or * markdown\n- Return ONLY the experience content starting directly with the first company name`
    }
  ], 1500)
]);

    // Keep education exactly as is
    const newEducation = sections.education;

    // Reassemble in exact same structure
    // Clean up any markdown formatting the AI might have added
const cleanText = (t) => {
  return t
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#+\s/gm, "")
    .replace(/^Here are.*?:/gim, "")
    .replace(/^The following.*?:/gim, "")
    .replace(/^Below are.*?:/gim, "")
    .replace(/^I have rewritten.*?:/gim, "")
    .replace(/^Rewritten.*?:/gim, "")
    .replace(/^These are.*?:/gim, "")
    .replace(/^Note:.*$/gim, "")
    .replace(/^\n+/, "")
    .trim();
};

const tailoredResume =
`${sections.header.trim()}

PROFESSIONAL SUMMARY
${cleanText(newSummary)}

TECHNICAL SKILLS
${cleanText(newSkills)}

PROFESSIONAL EXPERIENCE
${cleanText(newExperience)}

EDUCATION
${newEducation.trim()}`;

  // Score both resumes honestly using deterministic scoring
    const beforeScore = scoreResumeAgainstJob(resumeText, job.title, job.description, selectedSkills);
    const afterScore  = scoreResumeAgainstJob(tailoredResume, job.title, job.description, selectedSkills);

    res.json({
      beforeScore,
      afterScore,
      scoreOutOf10: true,
      tailoredResume,
      sections: {
        header:     sections.header.trim(),
        summary:    newSummary.trim(),
        skills:     newSkills.trim(),
        experience: newExperience.trim(),
        education:  newEducation.trim(),
      }
    });

  } catch (e) {
    console.error("GENERATE:", e.message);
    res.status(500).json({ error: e.message || "Resume generation failed" });
  }
});

// ─── NEW: Refine Resume Via Chat ───────────────────────────────────────────────
app.post("/api/ai/refine-resume", async (req, res) => {
  try {
    const p = refineSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid input" });
    const { currentResume, instruction, jobTitle, company } = p.data;

    const resume = await callGroq([
      {
        role: "system",
        content: `You are an expert resume editor. The user will give you their current resume and an instruction to modify it.
Apply the instruction carefully and return the COMPLETE updated resume as plain text.
Keep all sections intact unless told to remove something.
Only return the resume text — no commentary, no explanation, just the resume.`,
      },
      {
        role: "user",
        content: `Current Resume:
${currentResume}

Target Job: ${jobTitle || "Not specified"} at ${company || "Not specified"}

Instruction: ${instruction}

Return the complete updated resume:`,
      },
    ], 2500);

    res.json({ resume });
  } catch (e) {
    console.error("REFINE RESUME:", e.message);
    res.status(500).json({ error: e.message || "Refine failed" });
  }
});

// ─── AI Routes ─────────────────────────────────────────────────────────────────

app.post("/api/ai/cover-letter", async (req, res) => {
  try {
    const p = aiSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid input" });
    const { resumeText, jobTitle, company, jobDescription } = p.data;
    if (!resumeText || !jobTitle || !company || !jobDescription) return res.status(400).json({ error: "Missing required fields" });
    const limit = checkLimit(req, "coverLetter");
    if (!limit.allowed) {
      return res.status(429).json({
        error: limit.message,
        upgrade: limit.upgrade,
        plan: limit.plan
      });
    }
    const content = await callGroq([
      { role: "system", content: "You are an expert career coach and professional writer. Write compelling, personalized cover letters that are concise, genuine, and human. Never use clichés. Write in first person, 3-4 short paragraphs. Write the letter body only — no headers, no 'Dear Hiring Manager', no signatures." },
      { role: "user", content: `Write a professional cover letter body for:\n\nJob: ${jobTitle} at ${company}\n\nJob Description:\n${jobDescription.slice(0,3000)}\n\nMy Background:\n${resumeText.slice(0,2500)}\n\nWrite 3-4 compelling paragraphs that highlight relevant experience and genuine enthusiasm for this specific role.` },
    ], 800);
    res.json({ content });
  } catch (e) { console.error("AI COVER LETTER:", e.message); res.status(500).json({ error: e.message || "Failed to generate cover letter" }); }
});

app.post("/api/ai/interview-prep", async (req, res) => {
  try {
    const p = aiSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid input" });
    const { jobTitle, company, jobDescription, resumeText } = p.data;
    if (!jobTitle || !jobDescription) return res.status(400).json({ error: "jobTitle and jobDescription required" });
    const limit = checkLimit(req, "interview");
    if (!limit.allowed) {
      return res.status(429).json({
        error: limit.message,
        upgrade: limit.upgrade,
        plan: limit.plan
      });
    }
    const content = await callGroq([
      { role: "system", content: "You are an expert interview coach. Generate realistic, insightful interview questions with brief answer tips. Format clearly with numbered questions and tips." },
      { role: "user", content: `Generate 10 likely interview questions for:\n\nJob: ${jobTitle} at ${company||"this company"}\n\nJob Description:\n${jobDescription.slice(0,2000)}\n\n${resumeText?`Candidate Background:\n${resumeText.slice(0,1500)}\n\n`:""}\nInclude technical, behavioral (STAR format), and culture questions. Format each as:\n1. [Question]\nTip: [1-2 sentence answer guidance]` },
    ], 1200);
    res.json({ content });
  } catch (e) { console.error("AI INTERVIEW:", e.message); res.status(500).json({ error: e.message || "Failed to generate interview prep" }); }
});

app.post("/api/ai/resume-explainer", async (req, res) => {
  try {
    const p = aiSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid input" });
    const { resumeText, atsScore, matchedSkills, missingSkills } = p.data;
    if (!resumeText) return res.status(400).json({ error: "resumeText required" });
    const limit = checkLimit(req, "explainer");
    if (!limit.allowed) {
      return res.status(429).json({
        error: limit.message,
        upgrade: limit.upgrade,
        plan: limit.plan
      });
    }
    const content = await callGroq([
      { role: "system", content: "You are a friendly expert resume coach. Explain resume scores and give actionable specific advice in plain English. Be encouraging but honest. Avoid generic advice — be specific to what you see." },
      { role: "user", content: `Analyze this resume and explain the score:\n\nATS Score: ${atsScore||"N/A"}/100\nMatched Skills: ${(matchedSkills||[]).join(", ")||"None"}\nMissing Skills: ${(missingSkills||[]).join(", ")||"None"}\n\nResume:\n${resumeText.slice(0,3000)}\n\nProvide:\n1. What the score means (2-3 sentences)\n2. Top 3 strengths\n3. Top 3 improvements with specific actions\n4. One quick win to improve today\n\nKeep it conversational and actionable.` },
    ], 900);
    res.json({ content });
  } catch (e) { console.error("AI EXPLAINER:", e.message); res.status(500).json({ error: e.message || "Failed to explain resume" }); }
});

app.post("/api/ai/job-fit", async (req, res) => {
  try {
    const p = aiSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid input" });
    const { resumeText, jobTitle, company, jobDescription, matchScore } = p.data;
    if (!resumeText || !jobTitle || !jobDescription) return res.status(400).json({ error: "resumeText, jobTitle, jobDescription required" });
    const limit = checkLimit(req, "jobFit");
    if (!limit.allowed) {
      return res.status(429).json({
        error: limit.message,
        upgrade: limit.upgrade,
        plan: limit.plan
      });
    }
    const content = await callGroq([
      { role: "system", content: "You are a career advisor who gives honest, specific analysis of candidate-job fit. Be direct and helpful. Focus on concrete factors, not generic advice." },
      { role: "user", content: `Analyze candidate fit for this job:\n\nJob: ${jobTitle} at ${company||"this company"}\nMatch Score: ${matchScore||"N/A"}%\n\nJob Description:\n${jobDescription.slice(0,2000)}\n\nCandidate Resume:\n${resumeText.slice(0,2500)}\n\nProvide:\n1. Overall verdict (Strong Fit / Good Fit / Partial Fit / Not a Fit) with 2-sentence explanation\n2. Top 3 reasons they ARE a good fit\n3. Top 3 gaps or concerns\n4. Should they apply? Why?\n5. One specific thing to emphasize in their application\n\nBe honest and specific.` },
    ], 900);
    res.json({ content });
  } catch (e) { console.error("AI JOB FIT:", e.message); res.status(500).json({ error: e.message || "Failed to analyze job fit" }); }
});
// Get auto apply job recommendations
app.get("/api/auto-apply/jobs", (req, res) => {
  try {
    const skills = String(req.query.skills || "")
      .split("|").map(s => s.trim()).filter(Boolean);
    let categories = [];
    try { categories = JSON.parse(req.query.categories || "[]"); } catch {}

    const jobs = getAutoApplyJobs(skills, categories);
    res.json({ jobs: jobs.slice(0, 50) });
  } catch (e) {
    res.status(500).json({ error: "Failed to get jobs" });
  }
});

// Submit auto apply queue
app.post("/api/auto-apply/submit", async (req, res) => {
  try {
    const { jobs, userData, resumeText } = req.body;

    if (!jobs?.length || !userData || !resumeText) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Use IP as userId for now
    const userId = req.ip;
    if (!checkAutoApplyLimit(userId)) {
      return res.status(429).json({
        error: "Daily limit reached. Come back tomorrow."
      });
    }

    // Process each job
    const results = [];

    for (const job of jobs.slice(0, 20)) {
      // Generate tailored resume
      const tailoredResume = await callGroq([
        {
          role: "system",
          content: "Rewrite this resume to match the job. Return only the resume text, no commentary."
        },
        {
          role: "user",
          content: `Job: ${job.title} at ${job.company}\nDescription: ${(job.description || "").slice(0, 800)}\n\nResume:\n${resumeText.slice(0, 3000)}\n\nReturn the tailored resume:`
        }
      ], 1200);

      // Generate cover letter
      const coverLetter = await callGroq([
        {
          role: "system",
          content: "Write a short 2 paragraph cover letter. Return only the letter body, no headers."
        },
        {
          role: "user",
          content: `Job: ${job.title} at ${job.company}\nDescription: ${(job.description || "").slice(0, 600)}\n\nResume:\n${resumeText.slice(0, 1500)}`
        }
      ], 400);

      // Submit based on source
      let status = "failed";
      if (job.source === "Greenhouse") {
        status = await submitGreenhouse(job, userData, tailoredResume, coverLetter);
      } else if (job.source === "Lever") {
        status = await submitLever(job, userData, tailoredResume, coverLetter);
      }

      results.push({
        jobId: job.id,
        title: job.title,
        company: job.company,
        status,
        appliedDate: new Date().toISOString()
      });

      // Space out calls — don't hammer Groq
      await new Promise(r => setTimeout(r, 2000));
    }

    res.json({ results });
  } catch (e) {
    console.error("AUTO APPLY:", e.message);
    res.status(500).json({ error: "Auto apply failed" });
  }
});
app.get("/api/debug/auto-jobs", (req, res) => {
  const ghLv = cachedJobs.filter(j => 
    j.source === "Greenhouse" || j.source === "Lever"
  );
  
  const withLocation = ghLv.filter(j => 
    j.location && j.location !== "N/A" && j.location !== ""
  );

  const locations = withLocation
    .map(j => j.location)
    .slice(0, 50);

  res.json({
    totalCached: cachedJobs.length,
    totalGreenHouseLever: ghLv.length,
    withLocation: withLocation.length,
    sampleLocations: locations
  });
});
// ─── Extension: AI Answer Open-Ended Questions ─────────────────────────────────
app.post("/api/extension/answer-question", async (req, res) => {
  try {
    const { question, options, resumeText, profileData, jobTitle, company } = req.body;
    if (!question) return res.status(400).json({ error: "question is required" });
 
    // Build context about the options if it's a dropdown/radio
    const optionsContext = options?.length
      ? `\n\nAvailable options to choose from:\n${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\nIf this is a multiple choice question, return ONLY the exact text of the best option. Nothing else.`
      : "";
 
    const answer = await callGroq([
      {
        role: "system",
        content: `You are helping someone fill out a job application form.
Your job is to give the best answer based on their resume and profile.
 
Rules:
- If options are provided, return ONLY the exact text of the best matching option
- If it is an open-ended question, write 2-4 sentences using details from the resume
- Write in first person, sound natural and human
- For yes/no questions always return just "Yes" or "No"
- For relocation questions: always "Yes"
- For travel questions: always "Yes"  
- For "how did you hear": always "Online job board"
- Return ONLY the answer — no explanation, no labels, nothing else`,
      },
      {
        role: "user",
        content: `Job: ${jobTitle || "Not specified"} at ${company || "Not specified"}
 
Profile:
${profileData || "{}"}
 
Resume:
${(resumeText || "").slice(0, 3000)}
 
Question: ${question}${optionsContext}
 
Answer:`,
      },
    ], 200);
 
    res.json({ answer: answer.trim() });
  } catch (e) {
    console.error("ANSWER QUESTION:", e.message);
    res.status(500).json({ error: e.message || "Failed" });
  }
});
// ─── Extension Profile Sync ────────────────────────────────────────────────────
let syncedProfile = {};

app.post("/api/extension/save-profile", (req, res) => {
  try {
    syncedProfile = req.body || {};
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/extension/get-profile", (req, res) => {
  res.json({ ok: true, profile: syncedProfile });
});
// ─── Global Error Handlers ─────────────────────────────────────────────────────
process.on("unhandledRejection", r => console.error("[Unhandled Rejection]", r));
process.on("uncaughtException",  e => console.error("[Uncaught Exception]",  e.message));

// ─── Start ─────────────────────────────────────────────────────────────────────
// ─── Startup Full Refresh ──────────────────────────────────────────────────────
async function startupFullRefresh() {
  console.log("🔄 Startup full job refresh starting...");

  const { dateKey, hour } = getChicagoScheduleParts();
  const startupRunKey = `${dateKey}-${hour}`;

  try {
    // 1. Run normal sources first
    await refreshJobs();

    // 2. Run Adzuna once at startup
    // Use 3 pages to save API credits.
    await refreshAdzunaOnly(3);

    // 3. Run limited APIs once at startup
    // Startup scans 2 pages each.
    await refreshJSearchOnly(2);
    await refreshFlyByOnly(2);

    // Prevent schedule from running again in the same hour immediately after startup
    lastAdzunaRunKey = startupRunKey;
    lastJSearchRunKey = startupRunKey;
    lastFlyByRunKey = startupRunKey;

    console.log("✅ Startup full job refresh completed.");
  } catch (e) {
    console.error("[Startup full refresh]", e.message);
  }
}

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✅ SmartApply Backend running on port ${PORT}`);
  console.log("🔄 Background job fetch starting...");

  // Start full refresh in background — don't block server startup
  startupFullRefresh().catch(e =>
    console.error("[Startup refresh]", e.message)
  );
});