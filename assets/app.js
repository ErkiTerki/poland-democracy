// Renders site.json (built from content/ by build.py). No framework, no build step.
const REPO = "ErkiTerki/poland-democracy";
const GH = `https://github.com/${REPO}`;

// Prefilled templates for GitHub's new-file page (?filename=&value=).
const TEMPLATES = {
  tasks: (d) => ["short-task-name.md", `---\ntitle: \nstatus: todo\nowner: \ndue: ${d || ""}\n---\nWhat done looks like:\n`],
  events: (d) => [`${d || "YYYY-MM-DD"}-event-name.md`, `---\ntitle: \ndate: ${d || ""}\ntime: \ntype: meeting\nlocation: \n---\n`],
  datasets: () => ["dataset-name.md", "---\ntitle: \ncategory: \nurl: \nversion: \npoland_coverage: \nstatus: not-started\nowner: \n---\n**What it measures:** \n\n**Caveats:** \n"],
  papers: () => ["author-year-keyword.md", "---\ntitle: \nauthors: \nyear: \nurl: \nstatus: to-read\nreader: \ntags: \n---\n**Key claim:** \n\n**Method / data:** \n\n**How we use it:** \n"],
};
const newUrl = (name, date) => {
  const [file, value] = TEMPLATES[name](date);
  return `${GH}/new/main/content/${name}?filename=${encodeURIComponent(file)}&value=${encodeURIComponent(value)}`;
};
const editUrl = (item) => `${GH}/edit/main/${item.path}`;

const EVENT_TYPES = {
  board: { label: "Board", chip: "red" },
  deadline: { label: "Deadline", chip: "amber" },
  meeting: { label: "Meeting", chip: "slate" },
  team: { label: "Team", chip: "" },
  other: { label: "Other", chip: "" },
};
const STATUS = {
  todo: { label: "To do", color: "var(--muted)" },
  doing: { label: "Doing", color: "var(--red)" },
  done: { label: "Done", color: "var(--green)" },
};
const DATASET_STATUS = { "in-use": "green", exploring: "slate", "not-started": "", rejected: "amber" };
const PAPER_STATUS = { summarised: ["Summarised", "green"], reading: ["Reading", "slate"], "to-read": ["To read", ""] };

let SITE = null;
const view = { calY: null, calM: null, owner: "" };

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

// ---------- modal ----------
const modal = document.getElementById("modal");
function openModal({ title, facts = "", body = "", item, link, accent = true }) {
  document.getElementById("modal-body").innerHTML = `
    <div class="modal-top ${accent ? "" : "neutral"}"></div>
    <button class="btn ghost icon modal-close" aria-label="Close" data-close>✕</button>
    <h2 class="modal-title" id="modal-title">${esc(title)}</h2>
    <div class="modal-facts">${facts}</div>
    <div class="modal-body prose">${body ? md(body) : '<p class="muted">No details yet.</p>'}</div>
    <div class="modal-foot">
      ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Open source ↗</a>` : "<span></span>"}
      ${item ? `<a class="btn" href="${editUrl(item)}" target="_blank" rel="noopener">Edit on GitHub</a>` : ""}
    </div>`;
  modal.showModal();
}
modal.addEventListener("click", (e) => {
  if (e.target === modal || e.target.closest("[data-close]")) modal.close();
});

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
  const ev = SITE.events.find((e) => e.id === id);
  const t = EVENT_TYPES[ev.type] || EVENT_TYPES.other;
  openModal({
    title: ev.title,
    facts: `${chip(t.label, t.chip)}${chip(fmtDate(on, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}${chip(ev.time)}${chip(ev.location)}${ev.repeat === "weekly" ? chip("Every week") : ""}`,
    body: ev.body, item: ev, accent: ev.type === "board",
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
    const shown = list.slice(0, 3);
    const cls = ["cal-day", d.getMonth() !== view.calM && "out", day === today && "today", d.getDay() % 6 === 0 && "weekend"].filter(Boolean).join(" ");
    cells += `<div class="${cls}">
      <span class="num">${d.getDate()}</span>
      <a class="add" href="${newUrl("events", day)}" target="_blank" rel="noopener" title="Add event on ${fmtDate(day)}" aria-label="Add event on ${fmtDate(day)}">+</a>
      <div class="day-evs">${shown.map((e) => `<button class="ev ${esc(EVENT_TYPES[e.type] ? e.type : "other")}" data-ev="${esc(e.id)}" data-on="${day}" title="${esc(e.title)}">${e.time ? esc(e.time) + " " : ""}${esc(e.title)}</button>`).join("")}</div>
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
      <span><i style="background:var(--border-strong)"></i>Team</span>
    </div>`;
}

function upcomingHtml() {
  const today = todayIso();
  const horizon = new Date(); horizon.setFullYear(horizon.getFullYear() + 1);
  const all = occurrences(today, iso(horizon));
  // Show only the next occurrence of a recurring event.
  const seen = new Set();
  const list = all.filter((e) => (e.repeat ? (seen.has(e.id) ? false : seen.add(e.id)) : true)).slice(0, 6);
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
    <a class="btn primary" href="${newUrl("events")}" target="_blank" rel="noopener">+ Add event</a>`;
}

function bindCalendar() {
  document.querySelectorAll("[data-cal]").forEach((b) => b.addEventListener("click", () => {
    const step = Number(b.dataset.cal);
    if (step === 0) { const t = new Date(); view.calY = t.getFullYear(); view.calM = t.getMonth(); }
    else { const d = new Date(view.calY, view.calM + step, 1); view.calY = d.getFullYear(); view.calM = d.getMonth(); }
    document.getElementById("cal").innerHTML = calendarHtml();
    bindCalendar();
  }));
  document.querySelectorAll("#cal [data-ev]").forEach((b) => b.addEventListener("click", () => openEvent(b.dataset.ev, b.dataset.on)));
}

// ---------- views ----------
function viewOverview() {
  const o = SITE.overview || {};
  const today = todayIso();
  const nextBoard = occurrences(today, "9999-12-31").find((e) => e.type === "board");
  const openTasks = SITE.tasks.filter((t) => t.status !== "done").length;
  const summarised = SITE.papers.filter((p) => p.status === "summarised").length;
  const title = esc(o.title || "Overview").replace("U-turn", "<em>U‑turn</em>");
  const sections = (o.body || "").split(/^(?=## )/m).filter((s) => s.trim());
  if (view.calY === null) { const t = new Date(); view.calY = t.getFullYear(); view.calM = t.getMonth(); }

  return `
    <section class="hero">
      <div class="hero-main">
        <div class="eyebrow">Democracy, Political Trust &amp; Radical Voting · Open Data University</div>
        <h1>${title}</h1>
        ${o.question ? `<p class="question">${esc(o.question)}</p>` : ""}
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
      <a class="card stat" href="#datasets"><span class="n">${SITE.datasets.length}</span><span class="l">datasets</span></a>
      <a class="card stat" href="#papers"><span class="n">${summarised}<span style="color:var(--muted);font-weight:500">/${SITE.papers.length}</span></span><span class="l">papers summarised</span></a>
    </div>

    <div class="section-head"><h2 class="section-title">Calendar</h2>
      <span class="edit-link hover-hint">Hover a day and click + to add an event</span></div>
    <div class="cal-wrap">
      <div class="card cal" id="cal">${calendarHtml()}</div>
      <div class="card upcoming">${upcomingHtml()}</div>
    </div>

    ${sections.length ? `<div class="section-head"><h2 class="section-title">The project</h2>
      ${SITE.overview ? `<a class="edit-link" href="${editUrl(SITE.overview)}" target="_blank" rel="noopener">Edit</a>` : ""}</div>
    <div class="brief">${sections.map((s) => `<section class="card prose">${md(s)}</section>`).join("")}</div>` : ""}`;
}

function pageHead(eyebrow, title, sub, action) {
  return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1 class="page-title">${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ""}</div>${action || ""}</div>`;
}

function viewTasks() {
  const add = `<a class="btn primary" href="${newUrl("tasks")}" target="_blank" rel="noopener">+ Add task</a>`;
  const head = pageHead("Work split", "Tasks", "One file per task. Move a task along by changing its <code>status</code> to <code>todo</code>, <code>doing</code> or <code>done</code>.", SITE.tasks.length ? add : "");
  if (!SITE.tasks.length) {
    return `${head}<div class="empty"><h3>No tasks yet</h3><p>Add the first one, either with your agent ("add a task for…") or straight from the browser.</p>${add}</div>`;
  }
  const owners = [...new Set(SITE.tasks.map((t) => t.owner || "Unassigned"))].sort();
  const today = todayIso();
  const tasks = SITE.tasks
    .filter((t) => !view.owner || (t.owner || "Unassigned") === view.owner)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const col = (key) => {
    const items = tasks.filter((t) => (STATUS[t.status] ? t.status : "todo") === key);
    return `<div class="col">
      <div class="col-head"><span class="bar" style="background:${STATUS[key].color}"></span>${STATUS[key].label}<span class="count">${items.length}</span></div>
      ${items.map((t) => {
        const late = key !== "done" && t.due && t.due < today;
        return `<button class="card task ${key}" data-task="${esc(t.id)}">
          <div class="task-title">${esc(t.title || t.id)}</div>
          <div class="task-meta">
            <span class="avatar" title="${esc(t.owner || "Unassigned")}">${t.owner ? esc(initials(t.owner)) : "?"}</span>
            ${t.due ? chip((late ? "Overdue · " : "") + fmtDate(t.due, { day: "numeric", month: "short" }), late ? "red" : "") : ""}
          </div>
        </button>`;
      }).join("") || '<div class="col-empty">Nothing here</div>'}
    </div>`;
  };
  return `${head}
    <div class="toolbar"><div class="seg" role="group" aria-label="Filter by owner">
      <button data-owner="" class="${view.owner ? "" : "on"}">Everyone</button>
      ${owners.map((o) => `<button data-owner="${esc(o)}" class="${view.owner === o ? "on" : ""}">${esc(o)}</button>`).join("")}
    </div></div>
    <div class="kanban">${col("todo")}${col("doing")}${col("done")}</div>`;
}

function rowsHtml(items, rowFn) {
  return `<div class="card rows">${items.map(rowFn).join("")}</div>`;
}

function viewDatasets() {
  const add = `<a class="btn primary" href="${newUrl("datasets")}" target="_blank" rel="noopener">+ Add dataset</a>`;
  const head = pageHead("Data catalog", "Data", "Every source we use or considered. Always record the version, since the brief asks us to cite it.", add);
  if (!SITE.datasets.length) return `${head}<div class="empty"><h3>No datasets yet</h3><p>Log the first source you look at.</p>${add}</div>`;
  const ORDER = ["Measuring democracy", "Elections & turnout", "Parties & elections", "Attitudes & trust"];
  const rank = (c) => (ORDER.indexOf(c) + 1 || 99);
  const cats = [...new Set(SITE.datasets.map((d) => d.category || "Other"))].sort((a, b) => rank(a) - rank(b));
  return head + cats.map((c) => `<div class="group-title">${esc(c)}</div>` + rowsHtml(
    SITE.datasets.filter((d) => (d.category || "Other") === c),
    (d) => `<button class="row" data-dataset="${esc(d.id)}">
      <div><div class="row-title">${esc(d.title)}</div><div class="row-sub">${esc([d.poland_coverage && "Poland: " + d.poland_coverage, d.version].filter(Boolean).join(" · ") || "No details yet")}</div></div>
      <div class="row-right">${d.owner && d.owner !== "unassigned" ? chip(d.owner) : ""}${chip((d.status || "not-started").replace("-", " "), DATASET_STATUS[d.status] ?? "")}</div>
    </button>`)).join("");
}

function viewPapers() {
  const add = `<a class="btn primary" href="${newUrl("papers")}" target="_blank" rel="noopener">+ Add paper</a>`;
  const head = pageHead("Reading list", "Literature", "Papers, reports and books. Only a teammate who actually read one marks it <em>summarised</em>.", add);
  if (!SITE.papers.length) return `${head}<div class="empty"><h3>No papers yet</h3><p>Add something you've read or want to read.</p>${add}</div>`;
  const order = ["reading", "to-read", "summarised"];
  const names = { reading: "Reading now", "to-read": "To read", summarised: "Summarised" };
  return head + order.filter((s) => SITE.papers.some((p) => (p.status || "to-read") === s)).map((s) =>
    `<div class="group-title">${names[s]}</div>` + rowsHtml(
      SITE.papers.filter((p) => (p.status || "to-read") === s).sort((a, b) => (b.year || "").localeCompare(a.year || "")),
      (p) => `<button class="row" data-paper="${esc(p.id)}">
        <div><div class="row-title">${esc(p.title)}</div><div class="row-sub">${esc([p.authors, p.year].filter(Boolean).join(" · "))}</div></div>
        <div class="row-right">${(p.tags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3).map((t) => chip(t)).join("")}${p.reader ? chip("Read by " + p.reader, "slate") : ""}</div>
      </button>`)).join("");
}

// ---------- routing ----------
const VIEWS = { overview: viewOverview, tasks: viewTasks, datasets: viewDatasets, papers: viewPapers };

function render() {
  const route = location.hash.slice(1).split("?")[0] || "overview";
  const fn = VIEWS[route] || viewOverview;
  document.getElementById("app").innerHTML = fn();
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + (VIEWS[route] ? route : "overview")));
  if (route === "overview" || !VIEWS[route]) {
    bindCalendar();
    document.querySelectorAll(".upcoming [data-ev]").forEach((b) => b.addEventListener("click", () => openEvent(b.dataset.ev, b.dataset.on)));
  }
  document.querySelectorAll("[data-owner]").forEach((b) => b.addEventListener("click", () => { view.owner = b.dataset.owner; render(); }));
  document.querySelectorAll("[data-task]").forEach((b) => b.addEventListener("click", () => {
    const t = SITE.tasks.find((x) => x.id === b.dataset.task);
    const s = STATUS[t.status] || STATUS.todo;
    openModal({ title: t.title, item: t, body: t.body, accent: t.status === "doing",
      facts: `${chip(s.label, t.status === "done" ? "green" : t.status === "doing" ? "red" : "")}${chip(t.owner || "Unassigned", "slate")}${t.due ? chip("Due " + fmtDate(t.due, { day: "numeric", month: "long" })) : ""}` });
  }));
  document.querySelectorAll("[data-dataset]").forEach((b) => b.addEventListener("click", () => {
    const d = SITE.datasets.find((x) => x.id === b.dataset.dataset);
    openModal({ title: d.title, item: d, body: d.body, link: d.url, accent: false,
      facts: `${chip(d.category)}${chip(d.version)}${d.poland_coverage ? chip("Poland: " + d.poland_coverage) : ""}${chip((d.status || "not-started").replace("-", " "), DATASET_STATUS[d.status] ?? "")}${d.owner ? chip(d.owner, "slate") : ""}` });
  }));
  document.querySelectorAll("[data-paper]").forEach((b) => b.addEventListener("click", () => {
    const p = SITE.papers.find((x) => x.id === b.dataset.paper);
    const [label, cls] = PAPER_STATUS[p.status] || PAPER_STATUS["to-read"];
    openModal({ title: p.title, item: p, body: p.body, link: p.url, accent: false,
      facts: `${chip(label, cls)}${chip([p.authors, p.year].filter(Boolean).join(", "))}${p.reader ? chip("Read by " + p.reader, "slate") : ""}` });
  }));
}

fetch("site.json", { cache: "no-store" })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => { SITE = data; render(); addEventListener("hashchange", () => { render(); scrollTo(0, 0); }); })
  .catch(() => {
    document.getElementById("app").innerHTML = `<div class="empty" style="margin-top:40px"><h3>site.json is missing</h3>
      <p>Run <code>python3 build.py</code> in the repo, then <code>python3 -m http.server</code> and open localhost:8000.</p></div>`;
  });
