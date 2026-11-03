// Renders site.json (built from content/ by build.py), plus forms that save via Store (assets/store.js).
const REPO = "ErkiTerki/poland-democracy";
const GH = `https://github.com/${REPO}`;
const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=public_repo&description=Poland%20Democracy%20Hub";
const editUrl = (item) => `${GH}/edit/main/${item.path}`;

// ---------- team Google Drive ----------
// Files (PDFs, slides, spreadsheets) live in the team's private Drive folder; the site stores only their links.
// With apiKey + clientId filled in (one-time setup: DRIVE_SETUP.md), "Choose from Drive" opens Google's own
// file picker and fills the link in automatically. Left empty, the buttons open the folder and paste the copied link.
// None of these values is a secret: Google restricts them to this website.
const DRIVE = {
  folderId: "1D73e04DwqlUc9RZlXp4l5BQ_n7mzED1f",
  apiKey: "AIzaSyBo-rZMa8-3S8tc7PUxUO3b-dvg5sfjFb4",
  clientId: "54514463476-afo55rd8063einl1an42h39gl3rph9hb.apps.googleusercontent.com",
  appId: "54514463476", // the Google Cloud project NUMBER
};
const DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DRIVE.folderId}`;
const pickerOn = () => !!(DRIVE.apiKey && DRIVE.clientId);
const DRIVE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="#0066da" d="M3.2 17.7l.9 1.6c.2.3.5.6.8.8L8 14.8H1.7c0 .4.1.7.3 1z"/><path fill="#00ac47" d="M12 8.3L8.9 3c-.3.2-.6.5-.8.8L2 14c-.2.3-.3.7-.3 1H8z"/><path fill="#ea4335" d="M19.1 20.1c.3-.2.6-.5.8-.8l.4-.6 1.7-3c.2-.3.3-.7.3-1h-6.3l1.3 2.6z"/><path fill="#00832d" d="M12 8.3L15.1 3c-.3-.2-.7-.3-1.1-.3H10c-.4 0-.7.1-1.1.3z"/><path fill="#2684fc" d="M16 14.8H8l-3.1 5.3c.3.2.7.3 1.1.3h12c.4 0 .7-.1 1.1-.3z"/><path fill="#ffba00" d="M19.1 8.6l-2.9-4.9c-.2-.3-.5-.6-.8-.8L12.3 8.3l3.7 6.5h6.3c0-.4-.1-.7-.3-1z"/></svg>';

// The link input + Drive buttons, used by every form field that takes a link to a file.
function linkRow(name, value = "", ph = "https://…") {
  const btns = pickerOn()
    ? `<button type="button" class="btn drive-btn" data-drive="pick">${DRIVE_ICON} Choose from Drive</button>`
    : `<button type="button" class="btn drive-btn" data-drive="open">${DRIVE_ICON} Open team Drive ↗</button><button type="button" class="btn ghost paste-btn" data-drive="paste">Paste link</button>`;
  return `<span class="link-row"><input type="url" name="${name}" value="${esc(value)}" placeholder="${esc(ph)}">${btns}</span>
    <small class="drive-hint">${pickerOn() ? "Pick a file from the team Drive, or upload one there, and its link fills in automatically." : "File on your computer? Put it in the team Drive (private to us), click <b>Share → Copy link</b> on it, then <b>Paste link</b>."}</small>`;
}

const loadScript = (src) => new Promise((ok, fail) => {
  const s = document.createElement("script");
  s.src = src; s.async = true; s.onload = ok; s.onerror = () => fail(new Error("Couldn't load Google's file picker. Check your connection."));
  document.head.appendChild(s);
});
let pickerLoaded = null, driveToken = null, tokenClient = null, pendingToken = null;
// Load Google's scripts as soon as the page opens, so a click on "Choose from Drive" can open the sign-in
// window straight away (browsers block pop-ups that open after a delay, which made the first click fail).
function initDrive() {
  if (!pickerOn()) return Promise.resolve();
  pickerLoaded ||= Promise.all([loadScript("https://apis.google.com/js/api.js"), loadScript("https://accounts.google.com/gsi/client")])
    .then(() => new Promise((ok) => gapi.load("picker", ok)))
    .then(() => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: DRIVE.clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (r) => {
          const p = pendingToken; pendingToken = null;
          if (!p) return;
          if (r.error) return p.fail(new Error("Google sign-in didn't complete. Try again."));
          driveToken = { value: r.access_token, exp: Date.now() + ((r.expires_in || 3600) - 60) * 1000 };
          p.ok(r.access_token);
        },
        error_callback: (e) => {
          const p = pendingToken; pendingToken = null;
          if (p) p.fail(new Error(e?.type === "popup_failed_to_open"
            ? "Your browser blocked Google's sign-in window. Allow pop-ups for this site, then click again."
            : "Google sign-in was closed before finishing."));
        },
      });
    })
    .catch((e) => { pickerLoaded = null; throw e; });
  return pickerLoaded;
}
// Must run synchronously inside the click, so the sign-in pop-up isn't blocked.
function driveAccessToken() {
  if (driveToken && driveToken.exp > Date.now()) return Promise.resolve(driveToken.value);
  if (!tokenClient) { initDrive().catch(() => {}); return Promise.reject(new Error("Google Drive is still loading. Click again in a second.")); }
  const p = new Promise((ok, fail) => { pendingToken = { ok, fail }; });
  tokenClient.requestAccessToken({ prompt: "" });
  return p;
}
// Opens Google's picker on the team folder (browse or upload). Resolves to { url, name } or null if cancelled.
async function pickFromDrive() {
  const token = await driveAccessToken();
  await initDrive();
  toast("Opening Google Drive… the first time can take a few seconds.");
  // Our form sits in a modal <dialog> (the browser's top layer), which would cover Google's picker:
  // lower it to a normal dialog while the picker is open, then put it back.
  const lowered = modal.open;
  if (lowered) { modal.close(); modal.show(); modal.classList.add("lowered"); }
  try {
    return await new Promise((ok) => {
      const P = google.picker;
      const browse = new P.DocsView(P.ViewId.DOCS).setParent(DRIVE.folderId).setIncludeFolders(true).setMode(P.DocsViewMode.LIST);
      const upload = new P.DocsUploadView().setParent(DRIVE.folderId).setIncludeFolders(true);
      const b = new P.PickerBuilder()
        .addView(browse).addView(upload)
        .enableFeature(P.Feature.SUPPORT_DRIVES)
        .setOAuthToken(token).setDeveloperKey(DRIVE.apiKey)
        .setTitle("Team Drive: pick a file, or upload one")
        .setCallback((d) => {
          const action = d[P.Response.ACTION];
          if (action === P.Action.PICKED) {
            const doc = d[P.Response.DOCUMENTS][0];
            ok({ url: doc[P.Document.URL], name: doc[P.Document.NAME] });
          } else if (action === P.Action.CANCEL) ok(null);
        });
      if (DRIVE.appId) b.setAppId(DRIVE.appId);
      b.build().setVisible(true);
    });
  } finally {
    if (lowered) { modal.close(); modal.classList.remove("lowered"); modal.showModal(); }
  }
}

// Handles the Drive buttons: put the link into the row's input (or, for a notes body, insert a Markdown link).
async function driveAction(btn) {
  const row = btn.closest(".link-row, .attach-row");
  const target = row.classList.contains("attach-row") ? row.closest(".field").querySelector("textarea") : row.querySelector("input");
  const put = (url, name) => {
    if (target.tagName === "TEXTAREA") {
      const md = `[${name || "Attachment"}](${url})`;
      const at = target.selectionStart ?? target.value.length;
      target.value = target.value.slice(0, at) + (at && !/\s$/.test(target.value.slice(0, at)) ? "\n" : "") + md + target.value.slice(at);
      target.focus();
    } else {
      // Show the file's name under the field, and the start of the link, rather than focusing the field
      // (a focused field gets the red outline, which looks like an error).
      target.value = url;
      target.scrollLeft = 0;
      const hint = row.nextElementSibling;
      if (hint?.classList.contains("drive-hint")) hint.innerHTML = `<span class="linked">✓ Linked${name ? `: <b>${esc(name)}</b>` : ""}</span>`;
    }
    toast(`Linked${name ? ` <strong>${esc(name)}</strong>` : ""}.`);
  };
  const mode = btn.dataset.drive;
  if (mode === "open") return window.open(DRIVE_FOLDER_URL, "_blank", "noopener");
  if (mode === "paste") {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!/^https?:\/\//.test(text)) return toast("Nothing to paste yet: in Drive, click <b>Share → Copy link</b> on the file first.", "err");
      return put(text);
    } catch { target.focus(); return toast("Your browser blocked pasting: click in the field and press Cmd+V (Ctrl+V).", "err"); }
  }
  try {
    btn.disabled = true;
    const file = await pickFromDrive();
    if (file) put(file.url, file.name);
  } catch (e) { toast(esc(e.message), "err"); } finally { btn.disabled = false; }
}

const EVENT_TYPES = {
  board: { label: "Board", chip: "red" },
  deadline: { label: "Deadline", chip: "amber" },
  meeting: { label: "Meeting", chip: "slate" },
  team: { label: "Team", chip: "" },
  other: { label: "Other", chip: "" },
};
// Tasks are either open or done. Old "doing" files still load and count as open.
const STATUS = {
  todo: { label: "To do", color: "var(--muted)" },
  done: { label: "Done", color: "var(--green)" },
};
const isDone = (t) => t.status === "done";
const hasOutput = (t) => !!t.output && t.output !== "none";
const RESULT_DETAILS_PH = "What exactly you found, step by step: the numbers and their source + version (e.g. V-Dem v16, ESS round 11), how you got them, the uncertainty, and what the result does NOT show.";
const RESULT_PH = "e.g. V-Dem v16: Poland's liberal democracy index fell 2015–2022 and rose again in 2024, beyond the uncertainty interval. Description, not a cause.";
// Old findings carried one of these types. New results don't ask for it; the chip still shows on old ones.
const FINDING_TYPES = {
  description: { label: "Description", chip: "slate", hint: "What the data shows happened." },
  prediction: { label: "Prediction", chip: "amber", hint: "What is likely to happen next." },
  causal: { label: "Causal claim", chip: "red", hint: "What made it happen. Needs a design that rules out other explanations, not just a correlation." },
};
// The three groups the challenge brief uses for its data list, plus a catch-all.
// Teammates can add their own categories from the dataset form; those come after these three.
const CATEGORIES = ["Measuring democracy", "Parties and elections", "Attitudes and trust"];
const NEW_CAT = "__new__";
function allCategories(current) {
  const custom = [...new Set([...(SITE?.datasets || []).map((d) => d.category), current]
    .filter((c) => c && c !== NEW_CAT && !CATEGORIES.includes(c)))].sort((a, b) => a.localeCompare(b));
  return [...CATEGORIES, ...custom];
}

// ---------- form definitions (one per content collection) ----------
const slug = (s) => String(s || "").toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "item";

const FORMS = {
  tasks: {
    noun: "task", dir: "content/tasks", order: ["title", "status", "owner", "due", "completed", "output"],
    base: (f) => slug(f.title),
    // `completed` = the day a task was ticked; it dates the entry on the Past work timeline.
    // What a finished task produced lives in `results` (one file per result, linked back by `task`).
    // `output` is the old single-link field: still shown on old tasks, no longer written.
    stamp: (f) => {
      if (f.status === "done") f.completed = f.completed || todayIso();
      else { delete f.completed; delete f.output; }
    },
    fields: [
      { k: "title", label: "Task", type: "text", req: true, ph: "e.g. Pull V-Dem intervals for Poland" },
      { k: "status", label: "Status", type: "select", half: true, def: "todo", opts: [["todo", "To do"], ["done", "Done"]] },
      { k: "owner", label: "Owner (a name, or Everyone for a shared task)", type: "text", half: true, list: "owners", def: () => Store.auth?.name || "" },
      { k: "due", label: "Due date", type: "date", half: true },
      // Only when a task becomes done: its result, saved as a new file in Results (not on the task itself).
      { k: "_result", label: "1. Description of the result: what came out of this task? (required to mark it done)", type: "textarea", rows: 3, mark: true, virtual: true, showIf: "status", showIfValue: "done", onlyIf: (cur) => !cur || cur.status !== "done", ph: RESULT_PH },
      { k: "_resultDetails", label: "2. Details of the result: what you found, in more depth (required)", type: "textarea", rows: 6, mark: true, virtual: true, showIf: "status", showIfValue: "done", onlyIf: (cur) => !cur || cur.status !== "done", ph: RESULT_DETAILS_PH },
      { k: "_resultLink", label: "3. Link to the document (optional)", type: "url", drive: true, virtual: true, showIf: "status", showIfValue: "done", onlyIf: (cur) => !cur || cur.status !== "done", ph: "https://… (a Drive file, a note, slides…)" },
      { k: "body", label: "Details", type: "textarea", ph: "What does done look like? Links, notes…" },
    ],
  },
  events: {
    noun: "event", dir: "content/events", order: ["title", "date", "time", "type", "location", "repeat", "until"],
    base: (f) => `${f.date}-${slug(f.title)}`,
    fields: [
      { k: "title", label: "Event", type: "text", req: true, ph: "e.g. Mentor check-in" },
      { k: "date", label: "Date", type: "date", req: true, half: true },
      { k: "time", label: "Time", type: "time", half: true },
      { k: "type", label: "Type", type: "select", half: true, def: "meeting", opts: Object.entries(EVENT_TYPES).map(([k, v]) => [k, v.label]) },
      { k: "location", label: "Location", type: "text", half: true, ph: "HEC campus, Zoom…" },
      { k: "repeat", label: "Repeats every week", type: "checkbox", value: "weekly", half: true },
      { k: "until", label: "Repeat until", type: "date", half: true, showIf: "repeat" },
      { k: "body", label: "Notes", type: "textarea", ph: "Agenda, who's going, links…" },
    ],
  },
  results: {
    noun: "result", dir: "content/results", order: ["title", "task", "owner", "date", "link"],
    base: (f) => `${f.date || todayIso()}-${slug(f.title)}`,
    fields: [
      { k: "task", label: "Which task does it answer?", type: "select", req: true, opts: resultTaskOptions },
      { k: "title", label: "1. Description of the result: what came out, in a sentence or two", type: "textarea", rows: 3, req: true, ph: RESULT_PH },
      { k: "body", label: "2. Details: explain in more depth what you found", type: "textarea", rows: 7, req: true, ph: RESULT_DETAILS_PH },
      { k: "link", label: "3. Link to the document (optional)", type: "url", drive: true, ph: "https://… (a Drive file, a note, slides…)" },
      { k: "owner", label: "By", type: "text", half: true, list: "owners", def: () => Store.auth?.name || "" },
      { k: "date", label: "Date", type: "date", half: true, def: () => todayIso() },
    ],
  },
  datasets: {
    noun: "dataset", dir: "content/datasets", order: ["title", "category", "url", "owner"],
    base: (f) => slug(f.title),
    // "+ New category…" in the select: the typed name becomes the category.
    finish: (f, x) => {
      if (f.category !== NEW_CAT) return "";
      if (!x._newCat) return "Type the name of the new category, or pick an existing one.";
      f.category = allCategories().find((c) => c.toLowerCase() === x._newCat.toLowerCase()) || x._newCat;
      return "";
    },
    fields: [
      { k: "title", label: "Dataset", type: "text", req: true, ph: "e.g. Eurobarometer" },
      { k: "category", label: "Category", type: "select", half: true, def: "Measuring democracy", opts: (cur) => [...allCategories(cur).map((c) => [c, c]), [NEW_CAT, "+ New category…"]] },
      { k: "_newCat", label: "Name of the new category", type: "text", virtual: true, showIf: "category", showIfValue: NEW_CAT, ph: "e.g. Economy and inequality" },
      { k: "owner", label: "Added by", type: "text", half: true, req: true, list: "owners", def: () => Store.auth?.name || "" },
      { k: "url", label: "Where to download it", type: "url", ph: "https://…" },
      { k: "body", label: "Short description (one or two sentences)", type: "textarea", rows: 3, ph: "What's in it, in plain words." },
    ],
  },
  papers: {
    noun: "reading", dir: "content/papers", order: ["title", "url", "owner", "task"],
    base: (f) => slug(f.title),
    fields: [
      { k: "title", label: "Title", type: "text", req: true },
      { k: "url", label: "Link: DOI or publisher page, or the PDF in our Drive", type: "url", drive: true, ph: "https://…" },
      { k: "owner", label: "Added by", type: "text", list: "owners", def: () => Store.auth?.name || "" },
      { k: "task", label: "For which task?", type: "select", req: true, opts: taskOptions },
      { k: "body", label: "Notes (optional)", type: "textarea", rows: 6, ph: "Why it's useful, which part to read… What you concluded goes in Results." },
    ],
  },
  notes: {
    noun: "note", dir: "content/notes", order: ["title", "author", "updated"],
    base: (f) => [slug(f.author).split("-")[0], slug(f.title)].filter(Boolean).join("-"),
    stamp: (f) => { const d = new Date(); f.updated = `${iso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; },
    fields: [
      { k: "title", label: "Headline", type: "text", req: true, ph: "e.g. Notes from the Latitudes kick-off" },
      { k: "author", label: "Written by", type: "text", list: "owners", def: () => Store.auth?.name || "" },
      { k: "body", label: "Notes (Markdown works: **bold**, - lists, ## headings)", type: "textarea", rows: 14, drive: true },
    ],
  },
  overview: {
    noun: "overview", fixedPath: "content/overview.md", order: ["title", "question"],
    fields: [
      { k: "title", label: "Title", type: "text", req: true },
      { k: "question", label: "Research question", type: "textarea", rows: 3 },
    ],
  },
};

let SITE = null;
const view = { calY: null, calM: null, owner: "", author: "" };

// ---------- helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = (s) => DOMPurify.sanitize(marked.parse(s || ""));
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const todayIso = () => iso(new Date());
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const fmtDate = (s, opts = { weekday: "short", day: "numeric", month: "short" }) => parseDate(s).toLocaleDateString("en-GB", opts);
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);
const initials = (name) => String(name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const chip = (text, cls = "") => (text ? `<span class="chip ${cls}">${esc(text)}</span>` : "");
// "Everyone" (or All / Team) marks a shared task: the umbrella over a round of individual tasks.
const isTeam = (owner) => /^(everyone|all|team|whole team)$/i.test(String(owner || "").trim());
const hue = (name) => [...String(name)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const who = (owner) => {
  if (!owner) return '<span class="who none">Unassigned</span>';
  if (isTeam(owner)) return '<span class="who team"><i></i>Everyone</span>';
  return `<span class="who" style="--h:${hue(owner.trim().toLowerCase())}"><i></i>${esc(owner)}</span>`;
};
const find = (collection, id) => SITE[collection].find((x) => x.id === id);

// ---------- modal + toast ----------
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");
function showModal(html) {
  modalBody.innerHTML = `<button class="btn ghost icon modal-close" aria-label="Close" data-close>✕</button>${html}`;
  if (!modal.open) modal.showModal();
}
modal.addEventListener("click", (e) => {
  if (e.target === modal || e.target.closest("[data-close]")) modal.close();
});

function toast(msg, kind = "ok") {
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.innerHTML = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("in"));
  setTimeout(() => { t.classList.remove("in"); setTimeout(() => t.remove(), 300); }, kind === "err" ? 7000 : 4200);
}

function viewModal({ title, facts = "", body = "", link, linkLabel = "Open source ↗", accent = true, actions = "", edit, extra = "" }) {
  showModal(`
    <div class="modal-top ${accent ? "" : "neutral"}"></div>
    <h2 class="modal-title" id="modal-title">${esc(title)}</h2>
    <div class="modal-facts">${facts}</div>
    ${actions ? `<div class="quick">${actions}</div>` : ""}
    <div class="modal-body prose">${body ? md(body) : '<p class="muted">No details yet.</p>'}</div>
    ${extra}
    <div class="modal-foot">
      <span class="foot-links">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(linkLabel)}</a>` : ""}
        ${edit ? `<a class="edit-link" href="${editUrl(edit.item)}" target="_blank" rel="noopener">View file on GitHub</a>` : ""}</span>
      ${edit ? `<button class="btn primary" data-edit="${edit.collection}" data-id="${esc(edit.item.id)}">Edit</button>` : ""}
    </div>`);
}

// ---------- connect ----------
let afterConnect = null;
function requireAuth(then) {
  if (Store.connected) return then();
  afterConnect = then;
  connectModal();
}

function connectModal(error = "") {
  if (Store.connected) {
    const a = Store.auth;
    showModal(`
      <div class="modal-top"></div>
      <h2 class="modal-title">Connected</h2>
      <p class="modal-body">You're editing as <strong>${esc(a.name)}</strong> (GitHub <strong>@${esc(a.login)}</strong>). Everything you save is committed to the shared repo under your account.</p>
      <div class="modal-foot"><span></span><button class="btn" data-action="disconnect">Disconnect this browser</button></div>`);
    return;
  }
  showModal(`
    <div class="modal-top"></div>
    <h2 class="modal-title">Connect to edit</h2>
    <p class="modal-body">Saving writes straight to our shared GitHub repo, under your own account. One-time setup, about a minute:</p>
    <ol class="steps">
      <li><strong>Accept the collaborator invite</strong> from Erik (check your email, or <a href="${GH}/invitations" target="_blank" rel="noopener">open the invite</a>).</li>
      <li><a href="${TOKEN_URL}" target="_blank" rel="noopener"><strong>Create a token</strong> ↗</a>. The page opens with <code>public_repo</code> already ticked. Pick an expiry (e.g. 90 days), click <em>Generate token</em> at the bottom and copy it.</li>
      <li>Paste it below.</li>
    </ol>
    <form class="form" id="connect-form" autocomplete="off">
      <div class="fgrid">
        <label class="field half"><span>Your name</span><input name="name" placeholder="Shown as task owner" value="${esc(localName())}"></label>
        <label class="field half"><span>Token</span><input name="token" type="password" placeholder="ghp_…" required></label>
      </div>
      ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
      <p class="fine">The token stays in this browser only and is sent only to GitHub. Don't connect on a shared computer, or disconnect afterwards.</p>
      <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Connect</button></div>
    </form>`);
  document.getElementById("connect-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector("[type=submit]");
    btn.disabled = true; btn.textContent = "Checking…";
    try {
      const a = await Store.connect(String(f.get("token")).trim(), String(f.get("name")).trim());
      try { localStorage.setItem("pdh-name", a.name); } catch { /* ignore */ }
      renderAuth();
      toast(`Connected as <strong>@${esc(a.login)}</strong>`);
      const next = afterConnect; afterConnect = null;
      if (next) next(); else modal.close();
    } catch (err) {
      connectModal(err.message);
    }
  });
}
const localName = () => { try { return localStorage.getItem("pdh-name") || ""; } catch { return ""; } };

function renderAuth() {
  const b = document.getElementById("auth-btn");
  if (!b) return;
  b.innerHTML = Store.connected
    ? `<span class="avatar me">${esc(initials(Store.auth.name))}</span><span class="auth-label">${esc(Store.auth.name.split(" ")[0])}</span>`
    : `<span class="auth-dot"></span><span class="auth-label">Connect to edit</span>`;
  b.classList.toggle("on", Store.connected);
}

// ---------- forms ----------
function fieldHtml(f, val) {
  const v = val === "none" && f.k === "output" ? "" : val ?? "";
  const cls = `field${f.half ? " half" : ""}${f.showIf ? " cond" : ""}`;
  const attrs = `name="${f.k}" ${f.req ? "required" : ""} ${f.ph ? `placeholder="${esc(f.ph)}"` : ""}`;
  const dataIf = f.showIf ? ` data-if="${f.showIf}"${f.showIfValue ? ` data-if-val="${esc(f.showIfValue)}"` : ""}` : "";
  if (f.type === "textarea") return `<label class="${cls}"${dataIf}><span>${esc(f.label)}${f.req || f.mark ? ' <em class="req">*</em>' : ""}</span><textarea ${attrs} rows="${f.rows || 5}">${esc(v)}</textarea>${f.drive ? `<span class="attach-row">${pickerOn() ? `<button type="button" class="btn drive-btn" data-drive="pick">${DRIVE_ICON} Attach a file from Drive</button>` : `<button type="button" class="btn drive-btn" data-drive="open">${DRIVE_ICON} Open team Drive ↗</button><button type="button" class="btn ghost paste-btn" data-drive="paste">Paste file link</button><small class="drive-hint">Adds the copied Drive link where your cursor is.</small>`}</span>` : ""}</label>`;
  if (f.drive) return `<div class="${cls}"${dataIf}><span class="field-label">${esc(f.label)}</span>${linkRow(f.k, v, f.ph)}</div>`;
  if (f.type === "select") return `<label class="${cls}"${dataIf}><span>${esc(f.label)}${f.req ? ' <em class="req">*</em>' : ""}</span><select ${attrs}>${(typeof f.opts === "function" ? f.opts(v) : f.opts).map(([k, l]) => `<option value="${esc(k)}" ${k === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  if (f.type === "checkbox") return `<label class="${cls} check"${dataIf}><input type="checkbox" name="${f.k}" ${v ? "checked" : ""}><span>${esc(f.label)}</span></label>`;
  return `<label class="${cls}"${dataIf}><span>${esc(f.label)}${f.req ? ' <em class="req">*</em>' : ""}</span><input type="${f.type}" ${attrs} value="${esc(v)}" ${f.list ? `list="${f.list}"` : ""}></label>`;
}

async function openForm(collection, id, defaults = {}) {
  const spec = FORMS[collection];
  const isNew = !id;
  let current = null, sha = null;
  showModal(`<div class="modal-top"></div><h2 class="modal-title">${isNew ? "New " + spec.noun : "Edit " + spec.noun}</h2><p class="muted">Loading latest version…</p>`);
  if (!isNew) {
    const path = collection === "overview" ? spec.fixedPath : find(collection, id).path;
    try {
      const r = await Store.read(path);
      if (!r) { modal.close(); return toast("That item no longer exists. Someone may have deleted it.", "err"); }
      current = r.item; sha = r.sha;
    } catch (e) { modal.close(); return toast(esc(e.message), "err"); }
  }
  const shown = spec.fields.filter((f) => !f.onlyIf || f.onlyIf(current));
  const owners = [...new Set([...SITE.tasks.map((t) => t.owner), ...SITE.notes.map((n) => n.author), ...SITE.papers.map((p) => p.owner), ...SITE.datasets.map((d) => d.owner), Store.auth?.name].filter((o) => o && o !== "unassigned" && o !== "team"))];
  const values = (f) => {
    if (current) return current[f.k];
    if (f.k in defaults) return defaults[f.k];
    return typeof f.def === "function" ? f.def() : f.def;
  };
  showModal(`
    <div class="modal-top"></div>
    <h2 class="modal-title">${isNew ? "New " + spec.noun : "Edit " + spec.noun}</h2>
    <form class="form" id="item-form" autocomplete="off">
      <div class="fgrid">${shown.map((f) => fieldHtml(f, values(f))).join("")}</div>
      <datalist id="owners">${owners.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>
      <p class="form-error" hidden></p>
      <div class="modal-foot">
        ${!isNew && collection !== "overview" ? '<button type="button" class="btn danger" data-del>Delete</button>' : "<span></span>"}
        <span class="foot-right"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">${isNew ? "Add " + spec.noun : "Save changes"}</button></span>
      </div>
    </form>`);
  const form = document.getElementById("item-form");
  const condOn = (name, val) => { const c = form.elements[name]; return val ? c.value === val : c.checked; };
  const syncCond = () => form.querySelectorAll("[data-if]").forEach((el) => { el.hidden = !condOn(el.dataset.if, el.dataset.ifVal); });
  form.addEventListener("change", syncCond); syncCond();
  form.querySelector("input, textarea")?.focus();

  const errBox = form.querySelector(".form-error");
  const fail = (msg) => { errBox.hidden = false; errBox.textContent = msg; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("[type=submit]");
    const fields = current ? { ...current } : {};
    const extra = {};
    for (const f of shown) {
      const el = form.elements[f.k];
      let v = f.type === "checkbox" ? (el.checked ? f.value : "") : el.value.trim();
      if (f.showIf && !condOn(f.showIf, f.showIfValue)) v = "";
      if (f.virtual) { extra[f.k] = v; continue; }
      if (v === "" && f.k !== "body") delete fields[f.k]; else fields[f.k] = v;
    }
    delete fields.id; delete fields.path;
    // A task can only become done together with a written result.
    const newlyDone = collection === "tasks" && fields.status === "done" && (!current || current.status !== "done");
    if (newlyDone && (!extra._result || !extra._resultDetails)) {
      (extra._result ? form.elements._resultDetails : form.elements._result)?.focus();
      return fail("To mark the task done, write both the description of its result and the details. The link is optional.");
    }
    const problem = spec.finish?.(fields, extra);
    if (problem) return fail(problem);
    spec.stamp?.(fields);
    const text = Store.serialize(fields, spec.order);
    btn.disabled = true; btn.textContent = "Saving…";
    let made = null;
    try {
      const path = spec.fixedPath || (current ? current.path : await Store.uniquePath(spec.dir, spec.base(fields)));
      const who = Store.auth.login;
      if (newlyDone) made = await saveResult({ summary: extra._result, details: extra._resultDetails, link: extra._resultLink, taskId: idOf(path), taskOwner: fields.owner });
      await Store.write(path, text, `${collection}: ${isNew ? "add" : "update"} "${fields.title}" (via site, @${who})`, sha);
      applyLocal(collection, path, Store.parse(text, path));
      modal.close();
      toast(`<strong>Saved${newlyDone ? ", with its result" : ""}.</strong> Live for everyone in about a minute.`);
    } catch (err) {
      if (made) await dropResult(made);
      btn.disabled = false; btn.textContent = isNew ? "Add " + spec.noun : "Save changes";
      if (err.status === 401) { Store.disconnect(); renderAuth(); return fail("Your token was rejected (expired?). Connect again."); }
      fail(err.message);
    }
  });

  form.querySelector("[data-del]")?.addEventListener("click", async (e) => {
    const b = e.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Click again to delete"; return; }
    b.disabled = true; b.textContent = "Deleting…";
    try {
      await Store.remove(current.path, `${collection}: delete "${current.title}" (via site, @${Store.auth.login})`);
      applyLocal(collection, current.path, null);
      modal.close();
      toast("Deleted.");
    } catch (err) { fail(err.message); b.disabled = false; b.textContent = "Delete"; delete b.dataset.armed; }
  });
}

const idOf = (path) => path.split("/").pop().replace(/\.md$/, "");
const resultsFor = (taskId) => (SITE.results || []).filter((r) => r.task === taskId)
  .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || a.title.localeCompare(b.title));

// Writes one result file for a task. Returns its path. Who: the task's owner, or whoever saves it for a shared task.
async function saveResult({ summary, details, link, taskId, taskOwner }) {
  const spec = FORMS.results;
  const fields = { title: summary, task: taskId, owner: taskOwner && !isTeam(taskOwner) ? taskOwner : Store.auth.name, date: todayIso(), body: details || "" };
  if (link) fields.link = link;
  const text = Store.serialize(fields, spec.order);
  const path = await Store.uniquePath(spec.dir, spec.base(fields));
  await Store.write(path, text, `results: add "${excerpt(summary, 60)}" (via site, @${Store.auth.login})`);
  applyLocal("results", path, Store.parse(text, path));
  return path;
}
async function dropResult(path) {
  try { await Store.remove(path, `results: remove "${idOf(path)}" (undo, via site, @${Store.auth.login})`); applyLocal("results", path, null); }
  catch (e) { toast(`Couldn't remove the result: ${esc(e.message)}`, "err"); }
}

async function quickStatus(id, status, resultPath) {
  const t = find("tasks", id);
  if (!t) return;
  const busy = document.querySelector(`[data-tick="${CSS.escape(id)}"]`);
  if (busy) busy.classList.add("busy");
  try {
    const r = await Store.read(t.path);
    if (!r) { if (resultPath) await dropResult(resultPath); return toast("That task no longer exists.", "err"); }
    const fields = { ...r.item, status };
    delete fields.id; delete fields.path;
    FORMS.tasks.stamp(fields);
    const text = Store.serialize(fields, FORMS.tasks.order);
    await Store.write(t.path, text, `tasks: "${fields.title}" → ${status} (via site, @${Store.auth.login})`, r.sha);
    applyLocal("tasks", t.path, Store.parse(text, t.path));
    if (modal.open) modal.close();
    // Undoing a tick also removes the result it created.
    const undo = `<button class="toast-undo" data-status="${status === "done" ? "todo" : "done"}" data-id="${esc(id)}"${resultPath ? ` data-undo-result="${esc(resultPath)}"` : ""}>Undo</button>`;
    toast(status === "done" ? `<strong>Done.</strong> Moved to Past work${resultPath ? ', and its result is in <a href="#results">Results</a>' : ""}. ${undo}` : `Back on the to-do list. Its results stay in Results. ${undo}`);
  } catch (err) {
    if (busy) busy.classList.remove("busy");
    if (resultPath) await dropResult(resultPath);
    toast(esc(err.message), "err");
  }
}

// Ticking a task asks for its result (a written summary, required) and optionally a link to the document.
// The result is saved in Results, linked to the task; then the task moves to Past work.
function tickDialog(id) {
  const t = find("tasks", id);
  if (!t) return;
  const prior = resultsFor(id);
  showModal(`
    <div class="modal-top"></div>
    <h2 class="modal-title" id="modal-title">Mark as done</h2>
    <p class="tick-task">${esc(t.title)}</p>
    <form class="form" id="tick-form" autocomplete="off">
      <p class="tick-q"><strong>What came out of this task?</strong><br>
        <span class="muted">Describe the result in a sentence or two, then explain the details: what you found, with its numbers and sources. Both go to Results, under this task, so the whole team (Valentin included) can read them.</span></p>
      ${prior.length ? `<p class="tick-prior muted">Already in Results for this task: ${prior.map((r) => `“${esc(excerpt(r.title, 80))}”`).join(", ")}. Add the overall result here.</p>` : ""}
      <label class="field"><span>1. Description of the result: what came out, in a sentence or two <em class="req">*</em></span><textarea name="summary" rows="3" placeholder="${esc(RESULT_PH)}"></textarea></label>
      <label class="field"><span>2. Details: explain in more depth what you found <em class="req">*</em></span><textarea name="details" rows="6" placeholder="${esc(RESULT_DETAILS_PH)}"></textarea></label>
      <div class="field"><span class="field-label">3. Link to the document (optional)</span>${linkRow("link", "", "https://… (a Drive file, a note, slides…)")}</div>
      <p class="form-error" hidden></p>
      <div class="tick-actions">
        <button class="btn primary" type="submit">✓ Save result and mark done</button>
        <button class="btn ghost" type="button" data-close>Cancel</button>
      </div>
    </form>`);
  const form = document.getElementById("tick-form");
  const err = form.querySelector(".form-error");
  form.elements.summary.focus();
  form.addEventListener("input", () => { err.hidden = true; });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const summary = form.elements.summary.value.trim();
    const details = form.elements.details.value.trim();
    if (!summary || !details) {
      err.hidden = false; err.textContent = "Write both the description of the result and its details. Only the link is optional.";
      (summary ? form.elements.details : form.elements.summary).focus(); return;
    }
    const btn = form.querySelector("[type=submit]");
    form.querySelectorAll("button").forEach((b) => (b.disabled = true));
    btn.textContent = "Saving…";
    let path;
    try { path = await saveResult({ summary, details, link: form.elements.link.value.trim(), taskId: id, taskOwner: t.owner }); }
    catch (ex) {
      form.querySelectorAll("button").forEach((b) => (b.disabled = false)); btn.textContent = "✓ Save result and mark done";
      err.hidden = false; err.textContent = ex.status === 401 ? "Your token was rejected (expired?). Connect again." : ex.message; return;
    }
    await quickStatus(id, "done", path);
  });
}

function applyLocal(collection, path, item) {
  Store.remember(collection, path, item);
  if (collection === "overview") SITE.overview = item;
  else {
    SITE[collection] = SITE[collection].filter((x) => x.path !== path);
    if (item) SITE[collection].push(item);
  }
  render();
}

// ---------- events / calendar ----------
function occurrences(fromIso, toIso) {
  const out = [];
  for (const ev of SITE.events) {
    if (!ev.date) continue;
    if (ev.repeat === "weekly") {
      const until = ev.until || toIso;
      for (let d = parseDate(ev.date); iso(d) <= until && iso(d) <= toIso; d.setDate(d.getDate() + 7)) {
        if (iso(d) >= fromIso) out.push({ ...ev, on: iso(d) });
      }
    } else if (ev.date >= fromIso && ev.date <= toIso) {
      out.push({ ...ev, on: ev.date });
    }
  }
  const rank = { board: 0, deadline: 1, meeting: 2, other: 3, team: 4 };
  return out.sort((a, b) => a.on.localeCompare(b.on) || (rank[a.type] ?? 3) - (rank[b.type] ?? 3) || (a.time || "").localeCompare(b.time || ""));
}

function openEvent(id, on) {
  const ev = find("events", id);
  const t = EVENT_TYPES[ev.type] || EVENT_TYPES.other;
  viewModal({
    title: ev.title,
    facts: `${chip(t.label, t.chip)}${chip(fmtDate(on, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}${chip(ev.time)}${chip(ev.location)}${ev.repeat === "weekly" ? chip("Every week" + (ev.until ? " until " + fmtDate(ev.until, { day: "numeric", month: "short" }) : "")) : ""}`,
    body: ev.body, accent: ev.type === "board", edit: { collection: "events", item: ev },
  });
}

function calendarHtml() {
  const first = new Date(view.calY, view.calM, 1);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const last = new Date(view.calY, view.calM + 1, 0);
  const end = new Date(last); end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
  const evs = occurrences(iso(start), iso(end));
  const today = todayIso();
  let cells = "";
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = iso(d);
    const list = evs.filter((e) => e.on === day);
    const cls = ["cal-day", d.getMonth() !== view.calM && "out", day === today && "today", d.getDay() % 6 === 0 && "weekend", list.length && "has-ev"].filter(Boolean).join(" ");
    cells += `<div class="${cls}" data-add="events" data-date="${day}" title="Add event on ${fmtDate(day)}">
      <span class="num">${d.getDate()}</span>
      <span class="add" aria-hidden="true">+</span>
      <div class="day-evs">${list.slice(0, 3).map((e) => `<button class="ev ${esc(EVENT_TYPES[e.type] ? e.type : "other")}" data-ev="${esc(e.id)}" data-on="${day}" title="${esc((e.time ? e.time + " " : "") + e.title)}"><span class="ev-txt">${e.time ? `<span class="ev-time">${esc(e.time)}</span> ` : ""}${esc(e.title)}</span></button>`).join("")}</div>
      ${list.length > 3 ? `<span class="more">+${list.length - 3} more</span>` : ""}
    </div>`;
  }
  return `
    <div class="cal-head">
      <div class="cal-month">${MONTHS[view.calM]} <span>${view.calY}</span></div>
      <div class="cal-nav">
        <button class="btn ghost icon" data-cal="-1" aria-label="Previous month">←</button>
        <button class="btn" data-cal="0">Today</button>
        <button class="btn ghost icon" data-cal="1" aria-label="Next month">→</button>
      </div>
    </div>
    <div class="cal-grid">${DOW.map((d) => `<div class="cal-dow">${d}</div>`).join("")}${cells}</div>
    <div class="legend">
      <span><i style="background:var(--red)"></i>Board</span>
      <span><i style="background:var(--amber)"></i>Deadline</span>
      <span><i style="background:var(--slate)"></i>Meeting</span>
      <span><i style="background:var(--green)"></i>Team</span>
    </div>`;
}

function upcomingHtml() {
  const today = todayIso();
  const horizon = new Date(); horizon.setFullYear(horizon.getFullYear() + 1);
  const seen = new Set(); // only the next occurrence of a recurring event
  const list = occurrences(today, iso(horizon)).filter((e) => (e.repeat ? (seen.has(e.id) ? false : seen.add(e.id)) : true)).slice(0, 6);
  return `<h3>Coming up</h3>
    <div class="up-list">${list.map((e) => {
      const d = parseDate(e.on);
      const n = daysBetween(today, e.on);
      const rel = n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`;
      return `<button class="up-item ${esc(e.type)}" data-ev="${esc(e.id)}" data-on="${e.on}">
        <span class="up-date"><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()].slice(0, 3)}</small></span>
        <span class="up-text"><span class="up-title">${esc(e.title)}</span><br><span class="up-meta">${rel}${e.time ? " · " + esc(e.time) : ""}${e.location ? " · " + esc(e.location) : ""}</span></span>
      </button>`;
    }).join("") || '<p class="up-empty">Nothing scheduled.</p>'}</div>
    <button class="btn primary" data-add="events">+ Add event</button>`;
}

// ---------- views ----------
const addBtn = (collection, label) => `<button class="btn primary" data-add="${collection}">${label}</button>`;

function viewOverview() {
  const o = SITE.overview || {};
  const today = todayIso();
  const nextBoard = occurrences(today, "9999-12-31").find((e) => e.type === "board");
  const openTasks = SITE.tasks.filter((t) => t.status !== "done").length;
  const title = esc(o.title || "Overview").replace("U-turn", "<em>U‑turn</em>");
  if (view.calY === null) { const t = new Date(); view.calY = t.getFullYear(); view.calM = t.getMonth(); }

  return `
    <section class="hero">
      <div class="hero-main">
        <div class="eyebrow">Democracy, Political Trust &amp; Radical Voting · Open Data University</div>
        <h1>${title}</h1>
        ${o.question ? `<p class="question">${esc(o.question)}</p>` : ""}
        <button class="btn ghost hero-edit" data-edit="overview" data-id="overview">Edit</button>
      </div>
      <aside class="hero-side">
        ${nextBoard ? `
          <div><div class="label">Countdown to ${esc(nextBoard.title)}</div>
          <ol class="milestones">${SITE.events.filter((e) => e.type === "board").sort((a, b) => a.date.localeCompare(b.date)).map((b) =>
            `<li class="${b.date < today ? "past" : b.id === nextBoard.id ? "next" : ""}"><span>${esc(b.title)}</span><span>${fmtDate(b.date, { day: "numeric", month: "short" })}</span></li>`).join("")}</ol></div>
          <div><div class="countdown">${daysBetween(today, nextBoard.on)}<small>days</small></div>
          <div class="when">${fmtDate(nextBoard.on, { weekday: "long", day: "numeric", month: "long" })}</div>
          ${/tbc/i.test(nextBoard.body) ? '<span class="tbc">Date to be confirmed</span>' : ""}</div>`
        : `<div class="label">No upcoming Board</div>`}
      </aside>
    </section>

    <div class="stats">
      <a class="card stat" href="#tasks"><span class="n">${openTasks}</span><span class="l">open tasks</span></a>
      <a class="card stat" href="#results"><span class="n">${(SITE.results || []).length}</span><span class="l">results</span></a>
      <a class="card stat" href="#datasets"><span class="n">${SITE.datasets.length}</span><span class="l">datasets</span></a>
      <a class="card stat" href="#papers"><span class="n">${SITE.papers.length}</span><span class="l">readings</span></a>
    </div>

    <div class="section-head"><h2 class="section-title">Calendar</h2>
      <span class="edit-link">Click a day to add an event</span></div>
    <div class="cal-wrap">
      <div class="card cal" id="cal">${calendarHtml()}</div>
      <div class="card upcoming">${upcomingHtml()}</div>
    </div>
`;
}

function pageHead(eyebrow, title, sub, action) {
  return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1 class="page-title">${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ""}</div>${action || ""}</div>`;
}

// Group tasks by due date. Within a date, any Everyone task is the shared goal that heads that date's tasks.
function rounds(tasks) {
  const groups = new Map();
  for (const t of tasks) {
    const k = t.due || "undated";
    if (!groups.has(k)) groups.set(k, { date: t.due || null, lead: [], items: [] });
    groups.get(k)[isTeam(t.owner) ? "lead" : "items"].push(t);
  }
  for (const g of groups.values()) {
    g.items.sort((a, b) => String(a.owner).localeCompare(String(b.owner)) || a.title.localeCompare(b.title));
    g.lead.sort((a, b) => a.title.localeCompare(b.title));
  }
  return [...groups.values()];
}

const relDue = (d) => {
  const n = daysBetween(todayIso(), d);
  return n === 0 ? "today" : n === 1 ? "tomorrow" : n > 1 ? `in ${n} days` : n === -1 ? "1 day overdue" : `${-n} days overdue`;
};

// Filter bar: "All" = every task, "Everyone" = only the shared tasks, a name = only that person's tasks.
const TEAM = "__team__";
function ownerFilter(tasks) {
  const owners = [...new Set(tasks.map((t) => t.owner).filter((o) => o && !isTeam(o)))].sort();
  const hasTeam = tasks.some((t) => isTeam(t.owner));
  if (view.owner && view.owner !== TEAM && !owners.includes(view.owner)) view.owner = "";
  if (view.owner === TEAM && !hasTeam) view.owner = "";
  const btn = (val, label) => `<button data-owner="${esc(val)}" class="${view.owner === val ? "on" : ""}">${esc(label)}</button>`;
  return {
    keep: (t) => !view.owner || (view.owner === TEAM ? isTeam(t.owner) : t.owner === view.owner),
    html: owners.length + (hasTeam ? 1 : 0) > 1 ? `<div class="toolbar"><div class="seg" role="group" aria-label="Filter by owner">
      ${btn("", "All")}${hasTeam ? btn(TEAM, "Everyone") : ""}${owners.map((o) => btn(o, o)).join("")}
    </div></div>` : "",
  };
}

function taskCard(t, groupDate) {
  const today = todayIso();
  const late = t.due && t.due < today;
  const showDue = late;
  const team = isTeam(t.owner);
  return `<div class="card task${team ? " umbrella" : ""}" data-task="${esc(t.id)}" role="button" tabindex="0">
    <button class="tick" data-tick="${esc(t.id)}" aria-label="Mark “${esc(t.title)}” as done" title="Mark as done"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg></button>
    <div class="task-main">
      ${team ? '<div class="umbrella-tag">Shared goal for this round</div>' : ""}
      <div class="task-title">${esc(t.title || t.id)}</div>
      <div class="task-meta">${team ? "" : who(t.owner)}${showDue ? chip((late ? "Overdue · " : "Due ") + fmtDate(t.due, { day: "numeric", month: "short" }), late ? "red" : "") : ""}${t.body ? '<span class="has-notes" title="Has details">Details</span>' : ""}</div>
    </div>
  </div>`;
}

function viewTasks() {
  const add = addBtn("tasks", "+ Add task");
  const done = SITE.tasks.filter(isDone);
  const pastBtn = `<a class="btn past-btn" href="#past">Past work <span class="pill">${done.length}</span></a>`;
  const head = pageHead("Work split", "Tasks", "Tick a task when it's finished: it moves to Past work. Click a task for details, or to edit it.",
    `<div class="head-actions">${pastBtn}${add}</div>`);
  const open = SITE.tasks.filter((t) => !isDone(t));
  if (!open.length) {
    return `${head}<div class="empty"><h3>Nothing left to do</h3><p>Everything is ticked off. Add the next round of tasks, or look back at what's been done.</p>${add}</div>`;
  }
  const filter = ownerFilter(open);
  const groups = rounds(open.filter(filter.keep)).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const today = todayIso();
  return `${head}${filter.html}
    <div class="rounds">${groups.map((g) => {
      const late = g.date && g.date < today;
      const people = new Set(g.items.map((t) => t.owner).filter(Boolean)).size;
      return `<section class="round${late ? " late" : ""}">
        <header class="round-head">
          <div><div class="round-label">${g.date ? "Due" : "No deadline"}</div>
            ${g.date ? `<h2 class="round-date">${fmtDate(g.date, { weekday: "long", day: "numeric", month: "long" })}</h2>` : ""}</div>
          <div class="round-meta">${g.date ? chip(relDue(g.date), late ? "red" : "") : ""}<span>${g.lead.length + g.items.length} task${g.lead.length + g.items.length === 1 ? "" : "s"}${people ? ` · ${people} ${people === 1 ? "person" : "people"}` : ""}</span></div>
        </header>
        ${g.lead.map((t) => taskCard(t, g.date)).join("")}
        ${g.items.length ? `<div class="round-grid">${g.items.map((t) => taskCard(t, g.date)).join("")}</div>` : ""}
      </section>`;
    }).join("")}</div>
    <button class="col-add" data-add="tasks">+ Add task</button>`;
}

function viewPast() {
  const done = SITE.tasks.filter(isDone);
  const back = `<a class="btn" href="#tasks">← Back to tasks</a>`;
  const head = pageHead("Track record", "Past work", "Every finished task, grouped by the deadline it was set for: who owned what, when it was ticked off, and its results.", back);
  if (!done.length) return `${head}<div class="empty"><h3>Nothing finished yet</h3><p>Tick a task on the Tasks page and it lands here, on the timeline.</p>${back}</div>`;
  const filter = ownerFilter(done);
  const shown = done.filter(filter.keep);
  const groups = rounds(shown).sort((a, b) => (b.date || "0000").localeCompare(a.date || "0000"));
  const counts = {};
  for (const t of done) if (t.owner && !isTeam(t.owner)) counts[t.owner] = (counts[t.owner] || 0) + 1;
  const row = (t) => `<div class="past-row${isTeam(t.owner) ? " umbrella" : ""}" data-task="${esc(t.id)}" role="button" tabindex="0">
      <span class="past-check" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></span>
      <span class="past-title">${isTeam(t.owner) ? '<span class="umbrella-tag">Shared goal</span>' : ""}${esc(t.title || t.id)}</span>
      <span class="past-who">${who(t.owner)}</span>
      <span class="past-out">${((n) => n ? `<a class="out-link" href="#results">${n} result${n === 1 ? "" : "s"} →</a>` : hasOutput(t) ? `<a class="out-link" href="${esc(t.output)}" target="_blank" rel="noopener">Output ↗</a>` : `<button class="add-out" data-add="results" data-for-task="${esc(t.id)}" title="Write what this task produced">+ Result</button>`)(resultsFor(t.id).length)}</span>
      <span class="past-when">${t.completed ? "Done " + fmtDate(t.completed, { day: "numeric", month: "short" }) : ""}</span>
    </div>`;
  return `${head}
    <div class="past-summary card">
      <div class="ps-n"><b>${done.length}</b><span>tasks done</span></div>
      <div class="ps-n"><b>${rounds(done).length}</b><span>rounds</span></div>
      <div class="ps-people">${Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([o, n]) => `<span class="ps-person">${who(o)}<b>${n}</b></span>`).join("")}</div>
    </div>
    ${filter.html}
    <ol class="timeline">${groups.map((g) => {
      const d = g.date ? parseDate(g.date) : null;
      const n = g.lead.length + g.items.length;
      return `<li class="tl-item">
        <div class="tl-date">${d ? `<b>${d.getDate()}</b><span>${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}</span>` : "<span>No date</span>"}</div>
        <div class="tl-dot" aria-hidden="true"></div>
        <div class="card tl-card">
          <div class="tl-head"><span>${d ? "Due " + fmtDate(g.date, { weekday: "long", day: "numeric", month: "long" }) : "Undated"}</span><span class="muted">${n} task${n === 1 ? "" : "s"}</span></div>
          ${[...g.lead, ...g.items].map(row).join("")}
        </div>
      </li>`;
    }).join("")}</ol>`;
}

// Results: what each task produced. Grouped by date, then by the task each result answers.
function viewResults() {
  const add = addBtn("results", "+ Add result");
  const all = SITE.results || [];
  const head = pageHead("Outcomes", "Results", "What each task produced: a short summary in words, under the task it answers, with its document when there is one. Ticking a task adds its result here; you can also add one directly (that doesn't tick the task).", all.length ? add : "");
  if (!all.length) return `${head}<div class="empty"><h3>No results yet</h3><p>Tick a finished task on the Tasks page and write what came out of it, or add a result here.</p>${add}</div>`;
  const filter = ownerFilter(all);
  const byDate = new Map();
  for (const r of all.filter(filter.keep)) {
    const k = r.date || "";
    if (!byDate.has(k)) byDate.set(k, new Map());
    const tk = SITE.tasks.some((t) => t.id === r.task) ? r.task : "general";
    const g = byDate.get(k);
    if (!g.has(tk)) g.set(tk, []);
    g.get(tk).push(r);
  }
  const dates = [...byDate.keys()].sort((a, b) => (b || "0000").localeCompare(a || "0000"));
  const taskRank = (id) => { const t = SITE.tasks.find((x) => x.id === id); return t ? `${isTeam(t.owner) ? 0 : 1}${t.due || "9999"}${t.title}` : "z"; };
  const item = (r, taskOwner) => `<div class="r-item" data-result="${esc(r.id)}" role="button" tabindex="0">
      <div class="r-sum">${esc(r.title)}</div>
      <div class="r-meta">${r.link ? `<a class="out-link r-doc" href="${esc(r.link)}" target="_blank" rel="noopener">Open document ↗</a>` : '<span class="no-out">No document attached</span>'}
        ${r.owner && r.owner !== taskOwner ? who(r.owner) : ""}${r.type && FINDING_TYPES[r.type] ? chip(FINDING_TYPES[r.type].label, FINDING_TYPES[r.type].chip) : ""}${r.body ? '<span class="has-notes" title="Has details">Details</span>' : ""}</div>
    </div>`;
  const taskBlock = (tid, list) => {
    const t = SITE.tasks.find((x) => x.id === tid);
    const head = t
      ? `<div class="r-task-head" data-task="${esc(t.id)}" role="button" tabindex="0">
          <span class="r-for">Task${t.due ? " due " + fmtDate(t.due, { day: "numeric", month: "short" }) : ""}</span>
          <span class="r-task-title">${esc(t.title)}</span>
          <span class="r-task-meta">${who(t.owner)}${chip(isDone(t) ? "Done" : "Still open", isDone(t) ? "green" : "")}</span>
        </div>`
      : `<div class="r-task-head general"><span class="r-for">Not tied to a task</span><span class="r-task-title">General</span></div>`;
    return `<div class="r-task">${head}<div class="r-items">${list.map((r) => item(r, t?.owner)).join("")}</div></div>`;
  };
  return `${head}${filter.html}
    <ol class="timeline">${dates.map((k) => {
      const d = k ? parseDate(k) : null;
      const g = byDate.get(k);
      const n = [...g.values()].reduce((a, l) => a + l.length, 0);
      const tids = [...g.keys()].sort((a, b) => taskRank(a).localeCompare(taskRank(b)));
      return `<li class="tl-item">
        <div class="tl-date">${d ? `<b>${d.getDate()}</b><span>${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}</span>` : "<span>No date</span>"}</div>
        <div class="tl-dot" aria-hidden="true"></div>
        <div class="card tl-card">
          <div class="tl-head"><span>${d ? fmtDate(k, { weekday: "long", day: "numeric", month: "long" }) : "Undated"}</span><span class="muted">${n} result${n === 1 ? "" : "s"} · ${tids.length} task${tids.length === 1 ? "" : "s"}</span></div>
          ${tids.map((tid) => taskBlock(tid, g.get(tid).sort((a, b) => a.title.localeCompare(b.title)))).join("")}
        </div>
      </li>`;
    }).join("")}</ol>`;
}

const rowsHtml = (items, rowFn) => `<div class="card rows">${items.map(rowFn).join("")}</div>`;

function viewDatasets() {
  const add = addBtn("datasets", "+ Add dataset");
  const head = pageHead("Data catalog", "Data", "", SITE.datasets.length ? add : "") + `
    <a class="card data-drive" href="${DATA_DRIVE_URL}" target="_blank" rel="noopener">
      <div><b>All our data in one folder</b><span>Every dataset below, downloaded and cleaned, on Google Drive.</span></div>
      <span class="btn primary">Open folder ↗</span>
    </a>`;
  if (!SITE.datasets.length) return `${head}<div class="empty"><h3>No datasets yet</h3><p>Log the first source you look at.</p>${add}</div>`;
  const catOf = (d) => d.category || CATEGORIES[0];
  const filter = ownerFilter(SITE.datasets);
  const shown = SITE.datasets.filter(filter.keep);
  return head + filter.html + allCategories().filter((c) => shown.some((d) => catOf(d) === c)).map((c) => `<div class="group-title">${esc(c)}</div>
  <div class="card drows">${shown.filter((d) => catOf(d) === c).sort((a, b) => a.title.localeCompare(b.title)).map((d) => `
    <details class="drow">
      <summary><span class="drow-title">${esc(d.title)}</span><span class="drow-right">${d.owner ? who(d.owner) : '<span class="who none">No uploader yet</span>'}<span class="drow-chev" aria-hidden="true"></span></span></summary>
      <div class="drow-body">
        ${d.body ? `<div class="prose">${md(d.body)}</div>` : '<p class="muted">No description yet.</p>'}
        <div class="drow-actions">
          ${d.url ? `<a class="btn primary" href="${esc(d.url)}" target="_blank" rel="noopener">Download ↗</a>` : ""}
          <button class="btn ghost" data-edit="datasets" data-id="${esc(d.id)}">Edit</button>
        </div>
      </div>
    </details>`).join("")}</div>`).join("");
}

// Options for "For which task?": open tasks by due date (plus the reading's current task, even if it's done since).
function taskOptions(current) {
  const short = (t) => (t.title || t.id).length > 70 ? (t.title || t.id).slice(0, 68) + "…" : (t.title || t.id);
  const tasks = SITE.tasks.filter((t) => !isDone(t) || t.id === current)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (isTeam(a.owner) ? -1 : 1));
  return [["", "Choose a task…"],
    ...tasks.map((t) => [t.id, `${t.due ? fmtDate(t.due, { day: "numeric", month: "short" }) + " · " : ""}${isTeam(t.owner) ? "Everyone" : t.owner || "?"}: ${short(t)}`]),
    ["general", "Not for a specific task (general background)"]];
}

// Options for "Which task does it answer?": open tasks by due date, then finished tasks (most recent first).
function resultTaskOptions(current) {
  const short = (t) => (t.title || t.id).length > 70 ? (t.title || t.id).slice(0, 68) + "…" : (t.title || t.id);
  const label = (t) => `${isDone(t) ? "✓ " : ""}${t.due ? fmtDate(t.due, { day: "numeric", month: "short" }) + " · " : ""}${isTeam(t.owner) ? "Everyone" : t.owner || "?"}: ${short(t)}`;
  const open = SITE.tasks.filter((t) => !isDone(t)).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (isTeam(a.owner) ? -1 : 1));
  const done = SITE.tasks.filter(isDone).sort((a, b) => (b.completed || b.due || "").localeCompare(a.completed || a.due || ""));
  return [["", "Choose a task…"], ...open.map((t) => [t.id, label(t)]), ...done.map((t) => [t.id, label(t)]),
    ["general", "Not for a specific task (general)"]];
}

function viewPapers() {
  const add = addBtn("papers", "+ Add reading");
  const head = pageHead("Library", "Literature", "Every paper, report and article we use, grouped by the task it's for. Click one to open its link and notes.", SITE.papers.length ? add : "");
  if (!SITE.papers.length) return `${head}<div class="empty"><h3>No readings yet</h3><p>Add a paper, report or article the team should know about.</p>${add}</div>`;
  const filter = ownerFilter(SITE.papers);
  const taskOf = (p) => SITE.tasks.find((t) => t.id === p.task);
  const groups = new Map();
  for (const p of SITE.papers.filter(filter.keep)) {
    const t = taskOf(p); const key = t?.due || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const keys = [...groups.keys()].sort((a, b) => (a || "9999").localeCompare(b || "9999"));
  const row = (p) => {
    const t = taskOf(p);
    const sub = [p.url ? esc(p.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]) : "",
      t && t.owner !== p.owner ? `For ${isTeam(t.owner) ? "the shared task" : esc(t.owner || "?") + "'s task"}` : ""].filter(Boolean).join(" · ");
    return `<button class="row" data-paper="${esc(p.id)}">
      <div><div class="row-title">${esc(p.title)}</div>${sub ? `<div class="row-sub">${sub}</div>` : ""}</div>
      <div class="row-right">${p.owner ? who(p.owner) : ""}${p.body ? '<span class="has-notes" title="Has notes">Notes</span>' : ""}</div>
    </button>`;
  };
  return head + filter.html + keys.map((k) =>
    `<div class="group-title">${k ? "For tasks due " + fmtDate(k, { weekday: "long", day: "numeric", month: "long" }) : "General background"}</div>` +
    rowsHtml(groups.get(k).sort((a, b) => (a.owner || "").localeCompare(b.owner || "") || a.title.localeCompare(b.title)), row)).join("");
}

// "2026-10-29 14:05" → "Today, 14:05" / "29 Oct 2026, 14:05"
function fmtSaved(s) {
  if (!s) return "";
  const [day, time] = String(s).split(" ");
  const ago = daysBetween(day, todayIso());
  const when = ago === 0 ? "Today" : ago === 1 ? "Yesterday" : fmtDate(day, { day: "numeric", month: "short", year: "numeric" });
  return time ? `${when}, ${time}` : when;
}
const excerpt = (s, n = 180) => {
  const t = String(s || "").replace(/^\s*([-+]|\d+\.)\s+/gm, "").replace(/[#*_>`~]|\[|\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t;
};

function viewNotes() {
  const add = addBtn("notes", "+ New note");
  const head = pageHead("Notebook", "Notes", "Meeting notes, reading notes, ideas. Each note shows who wrote it and when it was last saved.", SITE.notes.length ? add : "");
  if (!SITE.notes.length) return `${head}<div class="empty"><h3>No notes yet</h3><p>Write up a meeting, a reading or an idea, and give it a headline.</p>${add}</div>`;
  const authors = [...new Set(SITE.notes.map((n) => n.author || "Unknown"))].sort();
  if (view.author && !authors.includes(view.author)) view.author = "";
  const notes = SITE.notes
    .filter((n) => !view.author || (n.author || "Unknown") === view.author)
    .sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
  return `${head}
    ${authors.length > 1 ? `<div class="toolbar"><div class="seg" role="group" aria-label="Filter by author">
      <button data-author="" class="${view.author ? "" : "on"}">Everyone</button>
      ${authors.map((a) => `<button data-author="${esc(a)}" class="${view.author === a ? "on" : ""}">${esc(a)}</button>`).join("")}
    </div></div>` : ""}
    <div class="notes-grid">${notes.map((n) => `<button class="card note" data-note="${esc(n.id)}">
      <div class="note-title">${esc(n.title || n.id)}</div>
      <p class="note-ex">${esc(excerpt(n.body)) || '<span class="muted">Empty note</span>'}</p>
      <div class="note-meta"><span class="avatar" title="${esc(n.author || "Unknown")}">${n.author ? esc(initials(n.author)) : "?"}</span>
        <span class="note-by">${esc(n.author || "Unknown")}</span>${n.updated ? `<span class="note-saved">Saved ${esc(fmtSaved(n.updated))}</span>` : ""}</div>
    </button>`).join("")}</div>`;
}

// Shared Google Drive folder with all downloaded + cleaned data (access: invited teammates only).
const DATA_DRIVE_URL = DRIVE_FOLDER_URL;
const SITE_URL = "https://erkiterki.github.io/poland-democracy/";
const AGENT_PROMPT = `Please set me up with my team's shared project hub. Read ${SITE_URL}AGENT_SETUP.md and follow every step in it.`;

function viewGuide() {
  const step = (n, title, body) => `<li class="g-step"><span class="g-num">${n}</span><div><h3>${title}</h3>${body}</div></li>`;
  return `
    <section class="g-hero">
      <div class="eyebrow">How it works</div>
      <h1>Using the hub</h1>
      <p>Our team's shared to-do list, calendar, results log, data catalog, reading list and notebook. Everyone sees the same thing, and anyone on the team can change it.</p>
    </section>

    <div class="g-paths">
      <a class="card g-path" href="#g-site"><b>Edit on the website</b><span>Click, type, save. Set it up once in about 2 minutes.</span></a>
      <a class="card g-path" href="#g-agent"><b>Let your AI agent do it</b><span>Tell Claude Code, Codex or another coding agent what you want in plain words, and it updates the hub.</span></a>
    </div>
    <p class="g-note">You can use both. Whatever you change shows up for <strong>everyone</strong> about a minute later.</p>

    <h2 class="section-title g-h" id="g-site">Edit on the website</h2>
    <div class="card g-card">
      <div class="g-sub">First time only (about 2 minutes)</div>
      <ol class="g-steps">
        ${step(1, "Have a GitHub account", `<p>No account? <a href="https://github.com/signup" target="_blank" rel="noopener">Sign up here</a> (free). Then send your GitHub username to Erik.</p>`)}
        ${step(2, "Accept Erik's invite", `<p>You'll get an email from GitHub. Click <em>Accept invitation</em>, or <a href="https://github.com/ErkiTerki/poland-democracy/invitations" target="_blank" rel="noopener">open the invite here</a>.</p>`)}
        ${step(3, "Create a token (a password just for this site)", `<p><a href="${TOKEN_URL}" target="_blank" rel="noopener">Click here</a>. GitHub opens with everything already filled in.</p>
          <ul><li>Choose an <b>Expiration</b> (90 days is fine).</li><li>Scroll down and click the green <b>Generate token</b> button.</li><li><b>Copy</b> the code that starts with <code>ghp_</code>. GitHub only shows it once.</li></ul>`)}
        ${step(4, "Connect", `<p>Click <button class="btn inline-btn" id="auth-btn-guide" data-connect><span class="auth-dot"></span> Connect to edit</button> (also at the top right of every page). Paste the code, type your name, and click <b>Connect</b>. Done.</p>`)}
      </ol>
    </div>

    <h2 class="section-title g-h" id="g-files">Files: PDFs, slides, spreadsheets</h2>
    <div class="card g-card">
      <p class="g-lead">Files go in our <a href="${DRIVE_FOLDER_URL}" target="_blank" rel="noopener">team Google Drive folder</a>, which only we can open. The hub stores just the link. That keeps our drafts private and keeps copyrighted papers off a public site.</p>
      <ol class="g-steps">
        ${step(1, "Find the link field", `<p>Every place that asks for a link (a result's document, a paper, a note) has a Drive button next to it.</p>`)}
        ${step(2, pickerOn() ? "Choose from Drive" : "Open the Drive and copy the link", pickerOn()
          ? `<p>Click <b>Choose from Drive</b>, then pick the file, or upload it from your computer in the <em>Upload</em> tab. The link fills in by itself.</p>`
          : `<p>Click <b>Open team Drive</b>, drop your file in, then on the file click <b>Share → Copy link</b>.</p>`)}
        ${step(3, pickerOn() ? "Save" : "Paste and save", pickerOn() ? `<p>Save the form as usual.</p>` : `<p>Back on the hub, click <b>Paste link</b> and save. (Want the link to fill in by itself? One teammate can switch that on in 10 minutes: see <a href="DRIVE_SETUP.md" target="_blank" rel="noopener">DRIVE_SETUP.md</a>.)</p>`)}
      </ol>
    </div>

    <h2 class="section-title g-h" id="g-agent">Let your AI agent do it</h2>
    <div class="card g-card">
      <p class="g-lead">Works with <b>Claude Code</b>, <b>Codex</b> or any other coding agent that can run commands on your computer. It sets itself up and then does the editing for you.</p>
      <ol class="g-steps">
        ${step(1, "Copy this message", `<div class="g-prompt"><code id="agent-prompt">${esc(AGENT_PROMPT)}</code><button class="btn primary" data-copy="agent-prompt">Copy</button></div>`)}
        ${step(2, "Paste it into your agent", `<p>It checks your tools, logs you in to GitHub, accepts the invite, downloads the project and learns the team rules. It asks before installing anything.</p>`)}
        ${step(3, "Just ask for things", `<ul class="g-examples">
          <li>"Add a task for me: pull turnout data from IDEA, due next Friday."</li>
          <li>"Put a team meeting in the calendar on Thursday at 14:00 in the library."</li>
          <li>"I read this paper: add it to the literature list with a summary."</li>
          <li>"Mark my V-Dem task as done. The result: Poland's turnout rose from 50.9% to 74.4% between 2015 and 2023 (IDEA), here's the Drive link."</li>
          <li>"Add a result to Filipa's 2023 election task: …" (adding a result doesn't tick the task)</li></ul>`)}
      </ol>
      <p class="g-alt">Prefer a file? <a href="AGENT_SETUP.md" download>Download AGENT_SETUP.md</a> and hand it to your agent.</p>
    </div>`;
}

// ---------- routing + clicks ----------
const VIEWS = { overview: viewOverview, tasks: viewTasks, past: viewPast, results: viewResults, findings: viewResults, datasets: viewDatasets, papers: viewPapers, notes: viewNotes, guide: viewGuide };

function render() {
  const route = location.hash.slice(1).split("?")[0];
  const key = VIEWS[route] ? route : "overview";
  document.getElementById("app").innerHTML = VIEWS[key]();
  const navKey = key === "past" ? "tasks" : key === "findings" ? "results" : key;
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + navKey));
  // On a phone the menu scrolls sideways: bring the current section into view.
  const nav = document.getElementById("nav"), on = nav.querySelector("a.active");
  if (on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
}

document.addEventListener("click", (e) => {
  const jump = e.target.closest('a[href^="#g-"]');
  if (jump) { e.preventDefault(); document.querySelector(jump.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" }); return; }
  if (e.target.closest("a.out-link")) return; // a link inside a card opens the link, not the card
  const driveBtn = e.target.closest("[data-drive]");
  if (driveBtn) { e.preventDefault(); return driveAction(driveBtn); }
  const el = e.target.closest("[data-result],[data-tick],[data-ev],[data-add],[data-edit],[data-task],[data-paper],[data-note],[data-owner],[data-author],[data-cal],[data-status],[data-action],[data-copy],[data-connect],#auth-btn");
  if (!el) return;
  const d = el.dataset;
  if (el.id === "auth-btn" || d.connect !== undefined) return connectModal();
  if (d.copy) {
    const text = document.getElementById(d.copy).textContent;
    const done = () => { el.textContent = "Copied ✓"; setTimeout(() => (el.textContent = "Copy"), 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => toast("Couldn't copy. Select the text and copy it by hand.", "err"));
    else toast("Couldn't copy. Select the text and copy it by hand.", "err");
    return;
  }
  if (d.action === "disconnect") { Store.disconnect(); renderAuth(); modal.close(); return toast("Disconnected."); }
  if (d.tick) return requireAuth(() => tickDialog(d.tick));
  if (d.result) {
    const r = find("results", d.result);
    const t = SITE.tasks.find((x) => x.id === r.task);
    const ty = FINDING_TYPES[r.type];
    return viewModal({ title: r.title, body: r.body, accent: false, link: r.link, linkLabel: "Open document ↗", edit: { collection: "results", item: r },
      facts: `${who(r.owner)}${r.date ? chip(fmtDate(r.date, { day: "numeric", month: "long", year: "numeric" })) : ""}${t ? chip(`For: ${t.title.length > 60 ? t.title.slice(0, 58) + "…" : t.title}`) : chip("General")}${ty ? chip(ty.label, ty.chip) : ""}${r.source ? chip("Source: " + r.source, "slate") : ""}` });
  }
  if (d.ev) return openEvent(d.ev, d.on);
  if (d.add) return requireAuth(() => openForm(d.add, null, { ...(d.date ? { date: d.date } : {}), ...(d.forTask ? { task: d.forTask } : {}) }));
  if (d.edit) return requireAuth(() => openForm(d.edit, d.edit === "overview" ? "overview" : d.id));
  if (d.status) return requireAuth(async () => { if (d.undoResult) await dropResult(d.undoResult); quickStatus(d.id, d.status); });
  if (d.owner !== undefined) { view.owner = d.owner; return render(); }
  if (d.author !== undefined) { view.author = d.author; return render(); }
  if (d.cal !== undefined) {
    const step = Number(d.cal);
    if (step === 0) { const t = new Date(); view.calY = t.getFullYear(); view.calM = t.getMonth(); }
    else { const n = new Date(view.calY, view.calM + step, 1); view.calY = n.getFullYear(); view.calM = n.getMonth(); }
    document.getElementById("cal").innerHTML = calendarHtml();
    return;
  }
  if (d.task) {
    const t = find("tasks", d.task);
    const done = isDone(t);
    const move = done
      ? `<button class="btn" data-status="todo" data-id="${esc(t.id)}">↺ Mark as not done</button>`
      : `<button class="btn primary" data-tick="${esc(t.id)}">✓ Mark done</button>`;
    const res = resultsFor(t.id);
    const extra = `<div class="t-results"><div class="t-results-head"><span>Results</span><button class="btn ghost" data-add="results" data-for-task="${esc(t.id)}">+ Add result</button></div>
      ${res.length ? res.map((r) => `<div class="r-item" data-result="${esc(r.id)}" role="button" tabindex="0"><div class="r-sum">${esc(r.title)}</div>
        <div class="r-meta">${r.link ? `<a class="out-link r-doc" href="${esc(r.link)}" target="_blank" rel="noopener">Open document ↗</a>` : '<span class="no-out">No document attached</span>'}${r.date ? `<span class="no-out">${fmtDate(r.date, { day: "numeric", month: "short" })}</span>` : ""}</div></div>`).join("")
        : `<p class="muted t-none">${done ? "No result written for this task." : "None yet. Ticking the task asks for one."}</p>`}</div>`;
    return viewModal({ title: t.title, body: t.body, accent: !done, actions: move, extra, edit: { collection: "tasks", item: t }, link: hasOutput(t) ? t.output : "", linkLabel: "Open output ↗",
      facts: `${chip(done ? "Done" : "To do", done ? "green" : "")}${who(t.owner)}${t.due ? chip("Due " + fmtDate(t.due, { day: "numeric", month: "long" })) : ""}${t.completed ? chip("Ticked off " + fmtDate(t.completed, { day: "numeric", month: "long" }), "green") : ""}` });
  }
  if (d.note) {
    const n = find("notes", d.note);
    return viewModal({ title: n.title, body: n.body, accent: false, edit: { collection: "notes", item: n },
      facts: `${chip(n.author || "Unknown", "slate")}${n.updated ? chip("Last saved " + fmtSaved(n.updated)) : ""}` });
  }
  if (d.paper) {
    const p = find("papers", d.paper);
    return viewModal({ title: p.title, body: p.body, link: p.url, accent: false, edit: { collection: "papers", item: p },
      facts: (p.owner ? chip("Added by " + p.owner, "slate") : "") +
        ((t) => t ? chip(`For: ${t.title.length > 60 ? t.title.slice(0, 58) + "…" : t.title}${t.due ? " (due " + fmtDate(t.due, { day: "numeric", month: "short" }) + ")" : ""}`) : "")(SITE.tasks.find((t) => t.id === p.task)) });
  }
});

document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.('[role="button"][data-task], [role="button"][data-result]')) { e.preventDefault(); e.target.click(); }
});

// ---------- light / dark ----------
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (document.documentElement.dataset.theme || (darkQuery.matches ? "dark" : "light")) === "dark";
const SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function renderTheme() {
  const b = document.getElementById("theme-btn");
  const dark = isDark();
  b.innerHTML = dark ? SUN : MOON;
  b.title = b.ariaLabel = dark ? "Switch to light mode" : "Switch to dark mode";
}
document.getElementById("theme-btn").addEventListener("click", () => {
  const next = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("pdh-theme", next); } catch { /* private mode: just this visit */ }
  renderTheme();
});
darkQuery.addEventListener("change", renderTheme);
renderTheme();

renderAuth();
initDrive().catch(() => {}); // warm up the Drive picker (no-op until DRIVE keys are set)
fetch("site.json", { cache: "no-store" })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => { SITE = Store.applyPending(data); render(); addEventListener("hashchange", () => { render(); scrollTo(0, 0); }); })
  .catch(() => {
    document.getElementById("app").innerHTML = `<div class="empty" style="margin-top:40px"><h3>site.json is missing</h3>
      <p>Run <code>python3 build.py</code> in the repo, then <code>python3 -m http.server</code> and open localhost:8000.</p></div>`;
  });
