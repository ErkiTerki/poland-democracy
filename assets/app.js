// Renders site.json (built from content/ by build.py). No framework, no build step.
const REPO = "ErkiTerki/poland-democracy";
const GH = `https://github.com/${REPO}`;

// Prefilled templates for the "+ Add" buttons (GitHub's new-file page accepts ?filename=&value=).
const TEMPLATES = {
  tasks: ["short-task-name.md", "---\ntitle: \nstatus: todo\nowner: \ndue: 2026-12-01\nboard: 1\n---\nWhat done looks like:\n"],
  datasets: ["dataset-name.md", "---\ntitle: \ncategory: \nurl: \nversion: \npoland_coverage: \nstatus: not-started\nowner: \n---\n**What it measures:** \n\n**Caveats:** \n"],
  papers: ["author-year-keyword.md", "---\ntitle: \nauthors: \nyear: \nurl: \nstatus: to-read\nreader: \ntags: \n---\n**Key claim:** \n\n**Method / data:** \n\n**How we use it:** \n"],
  decisions: ["00X-short-name.md", "---\ntitle: \nstatus: proposed\ndate: \nowner: \n---\n**Decision:** \n\n**Why:** \n\n**Alternatives considered:** \n"],
  meetings: ["2026-MM-DD-type.md", "---\ntitle: \ndate: \ntype: team\nattendees: \n---\n**Notes:** \n\n**Action items:** \n"],
};

const SECTIONS = {
  tasks: "Tasks", charts: "Charts", datasets: "Data catalog",
  papers: "Literature", decisions: "Decisions log", meetings: "Meetings & Boards",
};

const BOARDS = [
  { name: "Board 1", dates: "Dec 4 or Dec 11 (tbc)", iso: "2026-12-04" },
  { name: "Board 2", dates: "Feb 8 or Feb 12 (tbc)", iso: "2027-02-08" },
  { name: "Board 3 (final)", dates: "Apr 2 or Apr 5 (tbc)", iso: "2027-04-02" },
];

let SITE = null;
const charts = [];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = (s) => DOMPurify.sanitize(marked.parse(s || ""));
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const editLink = (item) => `<a class="edit" href="${GH}/edit/main/${esc(item.path)}" target="_blank" rel="noopener">Edit</a>`;
const addLink = (name) => {
  const t = TEMPLATES[name];
  if (!t) return "";
  const url = `${GH}/new/main/content/${name}?filename=${encodeURIComponent(t[0])}&value=${encodeURIComponent(t[1])}`;
  return `<a class="btn" href="${url}" target="_blank" rel="noopener">+ Add</a>`;
};
const pill = (text, cls = "") => (text ? `<span class="pill ${cls}">${esc(text)}</span>` : "");
const statusPill = (s) => pill(s, "st-" + slug(s));
const header = (name, sub = "") => `
  <div class="head-row">
    <div><h1>${SECTIONS[name] || name}</h1>${sub ? `<div class="muted">${sub}</div>` : ""}</div>
    ${addLink(name)}
  </div>`;

function expandable(item, metaHtml) {
  return `<details class="card">
    <summary><h3>${esc(item.title || item.id)}</h3><div class="meta">${metaHtml}${editLink(item)}</div></summary>
    <div class="body">${md(item.body) || '<p class="muted">Nothing written yet.</p>'}</div>
  </details>`;
}

// ---------- views ----------

function viewOverview() {
  const t = SITE.tasks;
  const open = t.filter((x) => x.status !== "done").length;
  const read = SITE.papers.filter((p) => p.status === "summarised").length;
  const today = new Date().toISOString().slice(0, 10);
  const next = BOARDS.find((b) => b.iso >= today);
  const days = next ? Math.ceil((new Date(next.iso) - new Date(today)) / 864e5) : null;
  return `
    <h1>${esc(SITE.overview?.title || "Overview")}</h1>
    <div class="tiles">
      <div class="card tile"><div class="num">${days ?? "—"}</div><div class="lbl">days to ${next ? esc(next.name) : "—"} (earliest date)</div></div>
      <div class="card tile"><div class="num">${open}</div><div class="lbl">open tasks of ${t.length}</div></div>
      <div class="card tile"><div class="num">${SITE.datasets.length}</div><div class="lbl">datasets catalogued</div></div>
      <div class="card tile"><div class="num">${read}/${SITE.papers.length}</div><div class="lbl">papers summarised</div></div>
    </div>
    <div class="card body">${md(SITE.overview?.body)}</div>
    <h2>Boards</h2>
    <div class="grid">${BOARDS.map((b) => `<div class="card"><h3>${b.name}</h3><div class="muted">${b.dates}</div></div>`).join("")}</div>`;
}

function viewTasks() {
  const owners = [...new Set(SITE.tasks.map((t) => t.owner || "unassigned"))].sort();
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const owner = params.get("owner") || "";
  const today = new Date().toISOString().slice(0, 10);
  const tasks = SITE.tasks
    .filter((t) => !owner || (t.owner || "unassigned") === owner)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const col = (status, label) => `
    <div class="col"><h3>${label} · ${tasks.filter((t) => (t.status || "todo") === status).length}</h3>
      <div class="stack">${tasks.filter((t) => (t.status || "todo") === status).map((t) => `
        <details class="card"><summary>
          <h3>${esc(t.title)}</h3>
          <div class="meta">${pill(t.owner || "unassigned")}${t.due ? pill(t.due, status !== "done" && t.due < today ? "overdue" : "") : ""}${t.board ? pill("Board " + t.board) : ""}${editLink(t)}</div>
        </summary><div class="body">${md(t.body)}</div></details>`).join("")}
      </div></div>`;
  return `${header("tasks", "Change a task's status by editing its file (todo → doing → done).")}
    <div class="filters"><label>Owner <select id="owner-filter"><option value="">Everyone</option>${owners.map((o) => `<option ${o === owner ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label></div>
    <div class="board">${col("todo", "To do")}${col("doing", "Doing")}${col("done", "Done")}</div>`;
}

function viewList(name, metaFn, sortFn) {
  const items = [...SITE[name]];
  if (sortFn) items.sort(sortFn);
  return `${header(name)}<div class="stack" style="margin-top:14px">${
    items.map((i) => expandable(i, metaFn(i))).join("") || '<p class="muted">Nothing here yet.</p>'
  }</div>`;
}

const viewDatasets = () => {
  const cats = [...new Set(SITE.datasets.map((d) => d.category || "Other"))];
  return `${header("datasets", "One file per source. Always record the version you used.")}${cats.map((c) => `
    <h2>${esc(c)}</h2><div class="stack">${SITE.datasets.filter((d) => (d.category || "Other") === c).map((d) =>
      expandable(d, `${statusPill(d.status)}${d.version ? pill(d.version) : ""}${d.poland_coverage ? pill("PL: " + d.poland_coverage) : ""}${pill(d.owner || "unassigned")}${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">Source</a>` : ""}`)
    ).join("")}</div>`).join("")}`;
};

const viewPapers = () => viewList("papers",
  (p) => `${statusPill(p.status)}${pill([p.authors, p.year].filter(Boolean).join(", "))}${p.reader ? pill("reader: " + p.reader) : ""}${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Link</a>` : ""}`,
  (a, b) => (a.status === "summarised") - (b.status === "summarised"));
const viewDecisions = () => viewList("decisions", (d) => `${statusPill(d.status)}${pill(d.date)}${pill(d.owner)}`, (a, b) => a.id.localeCompare(b.id));
const viewMeetings = () => viewList("meetings", (m) => `${pill(m.date)}${pill(m.type)}${pill(m.attendees)}`, (a, b) => (b.date || "").localeCompare(a.date || ""));

function viewCharts() {
  return `${header("charts", "Each chart is a file in content/charts pointing at a CSV in data/.")}
    <div class="stack" style="margin-top:14px">${SITE.charts.map((c, i) => `
      <section class="card">
        <div class="head-row"><h3>${esc(c.title)}</h3><div class="meta">${pill(c.source)}<button class="btn" data-table="${i}">Show table</button>${editLink(c)}</div></div>
        <div class="chart-box"><canvas id="chart-${i}" aria-label="${esc(c.title)}"></canvas></div>
        <div class="table-wrap" id="table-${i}" hidden></div>
        <div class="body chart-note">${md(c.body)}</div>
      </section>`).join("")}</div>`;
}

// ---------- charts ----------

function parseCSV(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/).map((l) => l.split(","));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i]?.trim() ?? ""])));
}

async function drawCharts() {
  const css = getComputedStyle(document.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  Chart.defaults.color = v("--text-2");
  for (const [i, c] of SITE.charts.entries()) {
    const rows = parseCSV(await (await fetch(c.file)).text());
    const series = c.series.split(",").map((s) => s.trim());
    const labels = (c.labels || c.series).split(",").map((s) => s.trim());
    const highlight = (c.highlight || "").trim();
    const x = c.x || "year";
    const datasets = series.map((s, k) => {
      const color = v(`--s${(k % 8) + 1}`);
      const strong = !highlight || s === highlight;
      return {
        label: labels[k] || s, data: rows.map((r) => (r[s] === "" ? null : Number(r[s]))),
        borderColor: color, backgroundColor: color, borderWidth: strong ? 2.5 : 1.5,
        pointRadius: 0, pointHoverRadius: 5, tension: 0.15,
        spanGaps: true, order: strong ? 0 : 1,
      };
    });
    charts.push(new Chart(document.getElementById(`chart-${i}`), {
      type: "line",
      data: { labels: rows.map((r) => r[x]), datasets },
      options: {
        maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        scales: {
          y: { min: c.ymin ? Number(c.ymin) : undefined, max: c.ymax ? Number(c.ymax) : undefined, grid: { color: v("--grid") }, border: { color: v("--axis") } },
          x: { grid: { display: false }, border: { color: v("--axis") } },
        },
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "line", boxWidth: 24 } },
          tooltip: { itemSort: (a, b) => b.parsed.y - a.parsed.y },
        },
      },
    }));
    const head = `<tr><th>${esc(x)}</th>${labels.map((l) => `<th>${esc(l)}</th>`).join("")}</tr>`;
    const body = rows.map((r) => `<tr><td>${esc(r[x])}</td>${series.map((s) => `<td>${esc(r[s])}</td>`).join("")}</tr>`).join("");
    document.getElementById(`table-${i}`).innerHTML = `<table class="data">${head}${body}</table>`;
  }
  document.querySelectorAll("[data-table]").forEach((b) => b.addEventListener("click", () => {
    const t = document.getElementById("table-" + b.dataset.table);
    t.hidden = !t.hidden;
    b.textContent = t.hidden ? "Show table" : "Hide table";
  }));
}

// ---------- routing ----------

const VIEWS = { overview: viewOverview, tasks: viewTasks, charts: viewCharts, datasets: viewDatasets, papers: viewPapers, decisions: viewDecisions, meetings: viewMeetings };

function render() {
  const route = (location.hash.slice(1).split("?")[0]) || "overview";
  const view = VIEWS[route] || viewOverview;
  charts.splice(0).forEach((c) => c.destroy());
  document.getElementById("app").innerHTML = view();
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + route));
  if (route === "charts") drawCharts();
  const f = document.getElementById("owner-filter");
  if (f) f.addEventListener("change", () => { location.hash = "tasks" + (f.value ? "?owner=" + encodeURIComponent(f.value) : ""); });
}

fetch("site.json", { cache: "no-store" })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => { SITE = data; render(); addEventListener("hashchange", render); })
  .catch(() => {
    document.getElementById("app").innerHTML = `<h1>site.json missing</h1>
      <p>Run <code>python3 build.py</code> in the repo, then serve it with <code>python3 -m http.server</code> and open <a href="http://localhost:8000">localhost:8000</a>.</p>`;
  });
