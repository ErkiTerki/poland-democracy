# Poland Democracy Hub — rules for agents

This repo is the shared team hub for a 4-person HEC capstone (Open Data University / Latitudes,
challenge "Democracy, Political Trust and Radical Voting in Europe"). Our focus is Poland's democratic
decline (2015–2022) and recovery since the 2023 election. The site is a static page on GitHub Pages
that rebuilds automatically on every push to `main`.

## How the site works
- `content/<collection>/*.md` holds the content. Each file is ONE item with a `key: value` frontmatter block.
- `build.py` compiles content into `site.json` (gitignored), and the site (`index.html`, `assets/`) renders it.
- Teammates also edit from the website (`assets/store.js` commits files via the GitHub API). Those commits look like
  `tasks: add "…" (via site, @login)`. Expect them, and always `git pull --rebase` first.
- **Edit content and data files. Only touch `index.html` / `assets/` / `build.py` if you were asked to change the site itself.**

## Workflow (every change)
1. `git pull --rebase` before you start.
2. Make the change. Prefer **creating new files** over editing other people's.
3. Run `python3 build.py`. It must print counts with no errors.
4. To preview: `python3 -m http.server`, then open http://localhost:8000.
5. Commit with a clear message (`papers: summarise Sadurski 2019`), then `git pull --rebase && git push` to `main`.
6. If the rebase conflicts in a file you didn't write, stop and ask your human. Don't overwrite a teammate's work.

## Collections and fields
Frontmatter values are plain one-line strings. Filenames are lowercase-with-dashes.

| Collection | Filename | Fields |
|---|---|---|
| tasks | `short-name.md` | title, status (`todo`/`doing`/`done`), owner, due (YYYY-MM-DD) |
| events | `YYYY-MM-DD-short-name.md` | title, date (YYYY-MM-DD), time (HH:MM, optional), type (`board`/`deadline`/`meeting`/`team`/`other`), location, repeat (`weekly`, optional), until (YYYY-MM-DD, with repeat) |
| datasets | `source-name.md` | title, category (`Measuring democracy`/`Elections & turnout`/`Parties & elections`/`Attitudes & trust`), url, version, poland_coverage, status (`not-started`/`exploring`/`in-use`/`rejected`), owner |
| papers | `author-year-keyword.md` | title, authors, year, url, status (`to-read`/`reading`/`summarised`), reader, tags (comma list) |

The overview page text lives in `content/overview.md`: a `question:` field plus `## ` sections, one card each.
Events appear on the Overview calendar. `board` events also drive the countdown.

Paper summaries use the body sections **Key claim / Method & data / How we use it**. Only mark a
paper `summarised` if a human on the team actually read it. Never invent a summary of a paper you
haven't been given the text of.

## Research rules (from the challenge brief — non-negotiable)
- **Indices are constructed, not observed.** For any index, record what it counts as democracy, who
  supplied the judgement, and the uncertainty interval. Don't present a year-on-year V-Dem change as
  real without checking the interval.
- **Party labels are someone's coding decision.** Always name the source and version (e.g. "PopuList 3.0")
  and state the definition in plain language. Note where PopuList and CHES disagree.
- **Keep description, prediction and causation separate.** No causal language from correlations.
  Country-level patterns don't tell you how individuals voted (ecological fallacy). Use ESS for claims about individuals.
- Every number on the site carries its source and version.

## Public repo: never commit
- Personal data, phone numbers, or private notes about people.
- Paper PDFs (link instead).
- Raw survey microdata (ESS, WVS, Eurobarometer). Their terms forbid redistribution. Keep it in
  `data/raw/` (gitignored) and commit only aggregated tables.
- API keys or tokens.
