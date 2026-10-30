// Renders site.json (built from content/ by build.py), plus forms that save via Store (assets/store.js).
const REPO = "ErkiTerki/poland-democracy";
const GH = `https://github.com/${REPO}`;
const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=public_repo&description=Poland%20Democracy%20Hub";
const editUrl = (item) => `${GH}/edit/main/${item.path}`;

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
// The brief's rule: keep description, prediction and causal claims apart.
const FINDING_TYPES = {
  description: { label: "Description", chip: "slate", hint: "What the data shows happened." },
  prediction: { label: "Prediction", chip: "amber", hint: "What is likely to happen next." },
  causal: { label: "Causal claim", chip: "red", hint: "What made it happen. Needs a design that rules out other explanations, not just a correlation." },
};
// The three groups the challenge brief uses for its data list, plus a catch-all.
const CATEGORIES = ["Measuring democracy", "Parties and elections", "Attitudes and trust", "Other"];
const PAPER_STATUS = { summarised: ["Summarised", "green"], reading: ["Reading", "slate"], "to-read": ["To read", ""] };

// ---------- form definitions (one per content collection) ----------
const slug = (s) => String(s || "").toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "item";

const FORMS = {
  tasks: {
    noun: "task", dir: "content/tasks", order: ["title", "status", "owner", "due", "completed", "output"],
    base: (f) => slug(f.title),
    // `completed` = the day a task was ticked; it dates the entry on the Past work timeline.
    stamp: (f) => { if (f.status === "done") f.completed = f.completed || todayIso(); else delete f.completed; },
    fields: [
      { k: "title", label: "Task", type: "text", req: true, ph: "e.g. Pull V-Dem intervals for Poland" },
      { k: "status", label: "Status", type: "select", half: true, def: "todo", opts: [["todo", "To do"], ["done", "Done"]] },
      { k: "owner", label: "Owner (a name, or Everyone for a shared task)", type: "text", half: true, list: "owners", def: () => Store.auth?.name || "" },
      { k: "due", label: "Due date", type: "date", half: true },
      { k: "output", label: "Output: link to what this task produced (a note, a Drive file, a finding…)", type: "url", ph: "https://…" },
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
  findings: {
    noun: "finding", dir: "content/findings", order: ["title", "type", "source", "owner", "date", "link"],
    base: (f) => slug(f.title),
    fields: [
      { k: "title", label: "Finding: one sentence, with the number", type: "text", req: true, ph: "e.g. Turnout rose from 50.9% (2015) to 74.4% (2023)" },
      { k: "type", label: "Type", type: "select", half: true, def: "description", opts: [["description", "Description: what happened"], ["prediction", "Prediction: what's likely next"], ["causal", "Causal: what made it happen"]] },
      { k: "owner", label: "Found by", type: "text", half: true, list: "owners", def: () => Store.auth?.name || "" },
      { k: "source", label: "Source and version", type: "text", req: true, ph: "e.g. V-Dem v16 (Coppedge et al. 2026), v2x_libdem" },
      { k: "date", label: "Date", type: "date", half: true, def: () => todayIso() },
      { k: "link", label: "Evidence link (chart, file, note)", type: "url", half: true, ph: "https://…" },
      { k: "body", label: "Caveats and details: uncertainty, coverage, what it does NOT show", type: "textarea", rows: 6 },
    ],
  },
  datasets: {
    noun: "dataset", dir: "content/datasets", order: ["title", "category", "url"],
    base: (f) => slug(f.title),
    fields: [
      { k: "title", label: "Dataset", type: "text", req: true, ph: "e.g. Eurobarometer" },
      { k: "category", label: "Category", type: "select", def: "Measuring democracy", opts: CATEGORIES.map((c) => [c, c]) },
      { k: "url", label: "Where to download it", type: "url", ph: "https://…" },
      { k: "body", label: "Short description (one or two sentences)", type: "textarea", rows: 3, ph: "What's in it, in plain words." },
    ],
  },
  papers: {
    noun: "paper", dir: "content/papers", order: ["title", "url", "status"],
    base: (f) => slug(f.title),
    fields: [
      { k: "title", label: "Title", type: "text", req: true },
      { k: "url", label: "Link", type: "url", ph: "DOI or URL (no PDFs in the repo)" },
      { k: "status", label: "Status", type: "select", def: "to-read", opts: [["to-read", "To read"], ["reading", "Reading"], ["summarised", "Summarised"]] },
      { k: "body", label: "Notes", type: "textarea", rows: 8 },
    ],
  },
  notes: {
    noun: "note", dir: "content/notes", order: ["title", "author", "updated"],
    base: (f) => [slug(f.author).split("-")[0], slug(f.title)].filter(Boolean).join("-"),
    stamp: (f) => { const d = new Date(); f.updated = `${iso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; },
    fields: [
      { k: "title", label: "Headline", type: "text", req: true, ph: "e.g. Notes from the Latitudes kick-off" },
      { k: "author", label: "Written by", type: "text", list: "owners", def: () => Store.auth?.name || "" },
      { k: "body", label: "Notes (Markdown works: **bold**, - lists, ## headings)", type: "textarea", rows: 14 },
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
const view = { calY: null, calM: null, owner: "", author: "", fType: "", fOwner: "" };

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

function viewModal({ title, facts = "", body = "", link, linkLabel = "Open source ↗", accent = true, actions = "", edit }) {
  showModal(`
    <div class="modal-top ${accent ? "" : "neutral"}"></div>
    <h2 class="modal-title" id="modal-title">${esc(title)}</h2>
    <div class="modal-facts">${facts}</div>
    ${actions ? `<div class="quick">${actions}</div>` : ""}
    <div class="modal-body prose">${body ? md(body) : '<p class="muted">No details yet.</p>'}</div>
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
  const v = val ?? "";
  const cls = `field${f.half ? " half" : ""}${f.showIf ? " cond" : ""}`;
  const attrs = `name="${f.k}" ${f.req ? "required" : ""} ${f.ph ? `placeholder="${esc(f.ph)}"` : ""}`;
  const dataIf = f.showIf ? ` data-if="${f.showIf}"` : "";
  if (f.type === "textarea") return `<label class="${cls}"${dataIf}><span>${esc(f.label)}</span><textarea ${attrs} rows="${f.rows || 5}">${esc(v)}</textarea></label>`;
  if (f.type === "select") return `<label class="${cls}"${dataIf}><span>${esc(f.label)}</span><select ${attrs}>${f.opts.map(([k, l]) => `<option value="${esc(k)}" ${k === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
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
  const owners = [...new Set([...SITE.tasks.map((t) => t.owner), ...SITE.notes.map((n) => n.author), Store.auth?.name].filter((o) => o && o !== "unassigned" && o !== "team"))];
  const values = (f) => {
    if (current) return current[f.k];
    if (f.k in defaults) return defaults[f.k];
    return typeof f.def === "function" ? f.def() : f.def;
  };
  showModal(`
    <div class="modal-top"></div>
    <h2 class="modal-title">${isNew ? "New " + spec.noun : "Edit " + spec.noun}</h2>
    <form class="form" id="item-form" autocomplete="off">
      <div class="fgrid">${spec.fields.map((f) => fieldHtml(f, values(f))).join("")}</div>
      <datalist id="owners">${owners.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>
      <p class="form-error" hidden></p>
      <div class="modal-foot">
        ${!isNew && collection !== "overview" ? '<button type="button" class="btn danger" data-del>Delete</button>' : "<span></span>"}
        <span class="foot-right"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">${isNew ? "Add " + spec.noun : "Save changes"}</button></span>
      </div>
    </form>`);
  const form = document.getElementById("item-form");
  const syncCond = () => form.querySelectorAll("[data-if]").forEach((el) => { el.hidden = !form.elements[el.dataset.if].checked; });
  form.addEventListener("change", syncCond); syncCond();
  form.querySelector("input, textarea")?.focus();

  const errBox = form.querySelector(".form-error");
  const fail = (msg) => { errBox.hidden = false; errBox.textContent = msg; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("[type=submit]");
    const fields = current ? { ...current } : {};
    for (const f of spec.fields) {
      const el = form.elements[f.k];
      let v = f.type === "checkbox" ? (el.checked ? f.value : "") : el.value.trim();
      if (f.showIf && !form.elements[f.showIf].checked) v = "";
      if (v === "" && f.k !== "body") delete fields[f.k]; else fields[f.k] = v;
    }
    delete fields.id; delete fields.path;
    spec.stamp?.(fields);
    const text = Store.serialize(fields, spec.order);
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const path = spec.fixedPath || (current ? current.path : await Store.uniquePath(spec.dir, spec.base(fields)));
      const who = Store.auth.login;
      await Store.write(path, text, `${collection}: ${isNew ? "add" : "update"} "${fields.title}" (via site, @${who})`, sha);
      applyLocal(collection, path, Store.parse(text, path));
      modal.close();
      toast(`<strong>Saved.</strong> Live for everyone in about a minute.`);
    } catch (err) {
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

async function quickStatus(id, status) {
  const t = find("tasks", id);
  if (!t) return;
  const busy = document.querySelector(`[data-tick="${CSS.escape(id)}"]`);
  if (busy) busy.classList.add("busy");
  try {
    const r = await Store.read(t.path);
    if (!r) return toast("That task no longer exists.", "err");
    const fields = { ...r.item, status };
    delete fields.id; delete fields.path;
    FORMS.tasks.stamp(fields);
    const text = Store.serialize(fields, FORMS.tasks.order);
    await Store.write(t.path, text, `tasks: "${fields.title}" → ${status} (via site, @${Store.auth.login})`, r.sha);
    applyLocal("tasks", t.path, Store.parse(text, t.path));
    if (modal.open) modal.close();
    const undo = `<button class="toast-undo" data-status="${status === "done" ? "todo" : "done"}" data-id="${esc(id)}">Undo</button>`;
    const addOut = status === "done" && !fields.output ? `<button class="toast-undo" data-edit="tasks" data-id="${esc(id)}">Add output link</button>` : "";
    toast(status === "done" ? `<strong>Done.</strong> Moved to Past work. ${undo}${addOut}` : `Back on the to-do list. ${undo}`);
  } catch (err) { if (busy) busy.classList.remove("busy"); toast(esc(err.message), "err"); }
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
  const summarised = SITE.papers.filter((p) => p.status === "summarised").length;
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
      <a class="card stat" href="#findings"><span class="n">${(SITE.findings || []).length}</span><span class="l">findings</span></a>
      <a class="card stat" href="#datasets"><span class="n">${SITE.datasets.length}</span><span class="l">datasets</span></a>
      <a class="card stat" href="#papers"><span class="n">${summarised}<span style="color:var(--muted);font-weight:500">/${SITE.papers.length}</span></span><span class="l">papers summarised</span></a>
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
      <div class="task-meta">${team ? "" : who(t.owner)}${showDue ? chip((late ? "Overdue · " : "Due ") + fmtDate(t.due, { day: "numeric", month: "short" }), late ? "red" : "") : ""}${t.body ? '<span class="has-notes" title="Has details">Details</span>' : ""}${t.output ? `<a class="out-link" href="${esc(t.output)}" target="_blank" rel="noopener">Output ↗</a>` : ""}</div>
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
  const head = pageHead("Track record", "Past work", "Every finished task, grouped by the deadline it was set for: who owned what, and when it was ticked off.", back);
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
      <span class="past-out">${t.output ? `<a class="out-link" href="${esc(t.output)}" target="_blank" rel="noopener">Output ↗</a>` : `<button class="add-out" data-edit="tasks" data-id="${esc(t.id)}" title="Link what this task produced">+ Output</button>`}</span>
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

function viewFindings() {
  const add = addBtn("findings", "+ Add finding");
  const head = pageHead("Evidence", "Findings", "What our data shows so far. Every finding names its source and version, and says whether it describes, predicts or claims a cause.", SITE.findings.length ? add : "");
  const legend = `<div class="f-legend">${Object.values(FINDING_TYPES).map((t) => `<span>${chip(t.label, t.chip)} ${esc(t.hint)}</span>`).join("")}</div>`;
  if (!SITE.findings.length) return `${head}${legend}<div class="empty"><h3>No findings yet</h3><p>Log the first thing the data told you: one sentence, the number, and its source.</p>${add}</div>`;
  const owners = [...new Set(SITE.findings.map((f) => f.owner).filter(Boolean))].sort();
  if (view.fOwner && !owners.includes(view.fOwner)) view.fOwner = "";
  const items = SITE.findings
    .filter((f) => !view.fType || (FINDING_TYPES[f.type] ? f.type : "description") === view.fType)
    .filter((f) => !view.fOwner || f.owner === view.fOwner)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || a.title.localeCompare(b.title));
  const seg = (attr, cur, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button ${attr}="${esc(v)}" class="${cur === v ? "on" : ""}">${esc(l)}</button>`).join("")}</div>`;
  return `${head}${legend}
    <div class="toolbar">
      ${seg("data-ftype", view.fType || "", [["", "All types"], ...Object.entries(FINDING_TYPES).map(([k, t]) => [k, t.label])])}
      ${owners.length > 1 ? seg("data-fowner", view.fOwner || "", [["", "All"], ...owners.map((o) => [o, o])]) : ""}
    </div>
    <div class="findings">${items.map((f) => {
      const t = FINDING_TYPES[f.type] || FINDING_TYPES.description;
      return `<div class="card finding ${esc(f.type || "description")}" data-finding="${esc(f.id)}" role="button" tabindex="0">
        <div class="f-top">${chip(t.label, t.chip)}${f.date ? `<span class="f-date">${fmtDate(f.date, { day: "numeric", month: "short", year: "numeric" })}</span>` : ""}</div>
        <div class="f-claim">${esc(f.title)}</div>
        <div class="f-source">${f.source ? `<span class="f-label">Source</span> ${esc(f.source)}` : '<span class="chip red">No source yet</span>'}</div>
        ${f.body ? `<p class="f-caveat">${esc(excerpt(f.body, 150))}</p>` : ""}
        <div class="f-foot">${who(f.owner)}${f.link ? `<a class="out-link" href="${esc(f.link)}" target="_blank" rel="noopener">Evidence ↗</a>` : ""}</div>
      </div>`;
    }).join("") || '<div class="col-empty">No findings match these filters.</div>'}</div>`;
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
  const catOf = (d) => (CATEGORIES.includes(d.category) ? d.category : "Other");
  return head + CATEGORIES.filter((c) => SITE.datasets.some((d) => catOf(d) === c)).map((c) => `<div class="group-title">${esc(c)}</div>
  <div class="card drows">${SITE.datasets.filter((d) => catOf(d) === c).sort((a, b) => a.title.localeCompare(b.title)).map((d) => `
    <details class="drow">
      <summary><span class="drow-title">${esc(d.title)}</span><span class="drow-chev" aria-hidden="true"></span></summary>
      <div class="drow-body">
        ${d.body ? `<div class="prose">${md(d.body)}</div>` : '<p class="muted">No description yet.</p>'}
        <div class="drow-actions">
          ${d.url ? `<a class="btn primary" href="${esc(d.url)}" target="_blank" rel="noopener">Download ↗</a>` : ""}
          <button class="btn ghost" data-edit="datasets" data-id="${esc(d.id)}">Edit</button>
        </div>
      </div>
    </details>`).join("")}</div>`).join("");
}

function viewPapers() {
  const add = addBtn("papers", "+ Add paper");
  const head = pageHead("Reading list", "Literature", "Papers, reports and books. Only a teammate who actually read one marks it <em>summarised</em>.", SITE.papers.length ? add : "");
  if (!SITE.papers.length) return `${head}<div class="empty"><h3>No papers yet</h3><p>Add something you've read or want to read.</p>${add}</div>`;
  const order = ["reading", "to-read", "summarised"];
  const names = { reading: "Reading now", "to-read": "To read", summarised: "Summarised" };
  return head + order.filter((s) => SITE.papers.some((p) => (p.status || "to-read") === s)).map((s) =>
    `<div class="group-title">${names[s]}</div>` + rowsHtml(
      SITE.papers.filter((p) => (p.status || "to-read") === s).sort((a, b) => a.title.localeCompare(b.title)),
      (p) => `<button class="row" data-paper="${esc(p.id)}">
        <div><div class="row-title">${esc(p.title)}</div>${p.url ? `<div class="row-sub">${esc(p.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0])}</div>` : ""}</div>
      </button>`)).join("");
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
const DATA_DRIVE_URL = "https://drive.google.com/drive/folders/1D73e04DwqlUc9RZlXp4l5BQ_n7mzED1f?usp=drive_link";
const SITE_URL = "https://erkiterki.github.io/poland-democracy/";
const AGENT_PROMPT = `Please set me up with my team's shared project hub. Read ${SITE_URL}AGENT_SETUP.md and follow every step in it.`;

function viewGuide() {
  const step = (n, title, body) => `<li class="g-step"><span class="g-num">${n}</span><div><h3>${title}</h3>${body}</div></li>`;
  return `
    <section class="g-hero">
      <div class="eyebrow">How it works</div>
      <h1>Using the hub</h1>
      <p>Our team's shared to-do list, calendar, data catalog, reading list and notebook. Everyone sees the same thing, and anyone on the team can change it.</p>
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
          <li>"Mark my V-Dem task as done."</li>
          <li>"Log a finding: Poland's turnout rose from 50.9% to 74.4% between 2015 and 2023, source IDEA."</li></ul>`)}
      </ol>
      <p class="g-alt">Prefer a file? <a href="AGENT_SETUP.md" download>Download AGENT_SETUP.md</a> and hand it to your agent.</p>
    </div>`;
}

// ---------- routing + clicks ----------
const VIEWS = { overview: viewOverview, tasks: viewTasks, past: viewPast, findings: viewFindings, datasets: viewDatasets, papers: viewPapers, notes: viewNotes, guide: viewGuide };

function render() {
  const route = location.hash.slice(1).split("?")[0];
  const key = VIEWS[route] ? route : "overview";
  document.getElementById("app").innerHTML = VIEWS[key]();
  const navKey = key === "past" ? "tasks" : key;
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + navKey));
}

document.addEventListener("click", (e) => {
  const jump = e.target.closest('a[href^="#g-"]');
  if (jump) { e.preventDefault(); document.querySelector(jump.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" }); return; }
  if (e.target.closest("a.out-link")) return; // a link inside a card opens the link, not the card
  const el = e.target.closest("[data-ftype],[data-fowner],[data-finding],[data-tick],[data-ev],[data-add],[data-edit],[data-task],[data-paper],[data-note],[data-owner],[data-author],[data-cal],[data-status],[data-action],[data-copy],[data-connect],#auth-btn");
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
  if (d.tick) return requireAuth(() => quickStatus(d.tick, "done"));
  if (d.ftype !== undefined) { view.fType = d.ftype; return render(); }
  if (d.fowner !== undefined) { view.fOwner = d.fowner; return render(); }
  if (d.finding) {
    const f = find("findings", d.finding);
    const t = FINDING_TYPES[f.type] || FINDING_TYPES.description;
    return viewModal({ title: f.title, body: f.body, accent: false, link: f.link, linkLabel: "Open evidence ↗", edit: { collection: "findings", item: f },
      facts: `${chip(t.label, t.chip)}${who(f.owner)}${f.date ? chip(fmtDate(f.date, { day: "numeric", month: "long", year: "numeric" })) : ""}${f.source ? chip("Source: " + f.source, "slate") : chip("No source yet", "red")}` });
  }
  if (d.ev) return openEvent(d.ev, d.on);
  if (d.add) return requireAuth(() => openForm(d.add, null, d.date ? { date: d.date } : {}));
  if (d.edit) return requireAuth(() => openForm(d.edit, d.edit === "overview" ? "overview" : d.id));
  if (d.status) return requireAuth(() => quickStatus(d.id, d.status));
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
      : `<button class="btn primary" data-status="done" data-id="${esc(t.id)}">✓ Mark done</button>`;
    return viewModal({ title: t.title, body: t.body, accent: !done, actions: move, edit: { collection: "tasks", item: t }, link: t.output, linkLabel: "Open output ↗",
      facts: `${chip(done ? "Done" : "To do", done ? "green" : "")}${who(t.owner)}${t.due ? chip("Due " + fmtDate(t.due, { day: "numeric", month: "long" })) : ""}${t.completed ? chip("Ticked off " + fmtDate(t.completed, { day: "numeric", month: "long" }), "green") : ""}` });
  }
  if (d.note) {
    const n = find("notes", d.note);
    return viewModal({ title: n.title, body: n.body, accent: false, edit: { collection: "notes", item: n },
      facts: `${chip(n.author || "Unknown", "slate")}${n.updated ? chip("Last saved " + fmtSaved(n.updated)) : ""}` });
  }
  if (d.paper) {
    const p = find("papers", d.paper);
    const [label, cls] = PAPER_STATUS[p.status] || PAPER_STATUS["to-read"];
    return viewModal({ title: p.title, body: p.body, link: p.url, accent: false, edit: { collection: "papers", item: p },
      facts: chip(label, cls) });
  }
});

document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.('[role="button"][data-task], [role="button"][data-finding]')) { e.preventDefault(); e.target.click(); }
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
fetch("site.json", { cache: "no-store" })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => { SITE = Store.applyPending(data); render(); addEventListener("hashchange", () => { render(); scrollTo(0, 0); }); })
  .catch(() => {
    document.getElementById("app").innerHTML = `<div class="empty" style="margin-top:40px"><h3>site.json is missing</h3>
      <p>Run <code>python3 build.py</code> in the repo, then <code>python3 -m http.server</code> and open localhost:8000.</p></div>`;
  });
