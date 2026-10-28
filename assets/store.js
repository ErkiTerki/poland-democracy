// Saving from the website: commits content files to the repo through the GitHub API,
// using each teammate's own token (kept only in their browser's localStorage).
const Store = (() => {
  const REPO = "ErkiTerki/poland-democracy";
  const API = `https://api.github.com/repos/${REPO}/contents/`;
  const KEY = "pdh-auth";
  const PENDING = "pdh-pending";
  const PENDING_TTL = 10 * 60 * 1000; // Pages rebuilds in ~1 min; keep local copies a while longer.

  const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: just no persistence */ } };
  const drop = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

  let auth = load(KEY, null); // { token, login, name }

  async function gh(path, opts = {}) {
    const res = await fetch(path.startsWith("http") ? path : API + path, {
      cache: "no-store",
      ...opts,
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${auth?.token || opts.token}`, ...(opts.headers || {}) },
    });
    if (res.status === 404) return null;
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(body?.message || `GitHub error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  async function connect(token, name) {
    const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` };
    const [u, r] = await Promise.all([
      fetch("https://api.github.com/user", { headers, cache: "no-store" }),
      fetch(`https://api.github.com/repos/${REPO}`, { headers, cache: "no-store" }),
    ]);
    if (u.status === 401) throw new Error("GitHub didn't accept that token. Check you copied all of it.");
    const user = await u.json();
    const repo = await r.json();
    if (!repo?.permissions?.push) {
      throw new Error(`Token works for @${user.login}, but it can't write to the repo. Either you haven't accepted the collaborator invite yet, or the token is missing the "public_repo" scope.`);
    }
    auth = { token, login: user.login, name: name || user.name || user.login };
    save(KEY, auth);
    return auth;
  }

  function disconnect() { auth = null; drop(KEY); }

  // ---- encoding ----
  const toB64 = (s) => { const b = new TextEncoder().encode(s); let bin = ""; b.forEach((x) => (bin += String.fromCharCode(x))); return btoa(bin); };
  const fromB64 = (s) => { const bin = atob(s.replace(/\n/g, "")); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); };

  // Mirrors build.py's parser.
  function parse(text, path) {
    const meta = {};
    let body = text;
    if (text.startsWith("---")) {
      const parts = text.split("---");
      const head = parts[1] || "";
      body = parts.slice(2).join("---").trim();
      for (const line of head.trim().split("\n")) {
        if (!line.trim() || line.trim().startsWith("#")) continue;
        const i = line.indexOf(":");
        if (i > -1) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
    }
    const id = path.split("/").pop().replace(/\.md$/, "");
    return { ...meta, id, path, body };
  }

  function serialize(fields, order) {
    const keys = [...order.filter((k) => k in fields), ...Object.keys(fields).filter((k) => !order.includes(k) && !["id", "path", "body"].includes(k))];
    const head = keys
      .filter((k) => fields[k] !== undefined && fields[k] !== null)
      .map((k) => `${k}: ${String(fields[k]).replace(/[\r\n]+/g, " ").trim()}`)
      .join("\n");
    return `---\n${head}\n---\n${(fields.body || "").trim()}\n`;
  }

  async function read(path) {
    const f = await gh(path + "?ref=main");
    return f ? { item: parse(fromB64(f.content), path), sha: f.sha } : null;
  }

  async function uniquePath(dir, base) {
    for (let n = 1; n < 50; n++) {
      const path = `${dir}/${base}${n > 1 ? "-" + n : ""}.md`;
      if (!(await gh(path + "?ref=main"))) return path;
    }
    throw new Error("Couldn't find a free filename.");
  }

  async function write(path, text, message, sha) {
    const body = { message, content: toB64(text), branch: "main", ...(sha ? { sha } : {}) };
    try {
      return await gh(path, { method: "PUT", body: JSON.stringify(body) });
    } catch (e) {
      if (e.status === 409 || e.status === 422) throw new Error("Someone changed this at the same time. Close the form, reload the page and try again.");
      throw e;
    }
  }

  async function remove(path, message) {
    const cur = await gh(path + "?ref=main");
    if (!cur) return;
    await gh(path, { method: "DELETE", body: JSON.stringify({ message, sha: cur.sha, branch: "main" }) });
  }

  // ---- local overlay so your own edits show immediately, even after a reload ----
  function remember(collection, path, item) {
    const list = load(PENDING, []).filter((p) => p.path !== path && Date.now() - p.at < PENDING_TTL);
    list.push({ collection, path, item, at: Date.now() });
    save(PENDING, list);
  }
  function applyPending(site) {
    const list = load(PENDING, []).filter((p) => Date.now() - p.at < PENDING_TTL);
    save(PENDING, list);
    for (const p of list) {
      if (p.collection === "overview") { if (p.item) site.overview = p.item; continue; }
      site[p.collection] = (site[p.collection] || []).filter((x) => x.path !== p.path);
      if (p.item) site[p.collection].push(p.item);
    }
    return site;
  }

  return {
    get auth() { return auth; },
    get connected() { return !!auth; },
    connect, disconnect, read, write, remove, uniquePath, parse, serialize, remember, applyPending,
  };
})();
