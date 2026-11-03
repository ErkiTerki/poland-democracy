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
5. Commit with a clear message (`papers: add Sadurski 2019`), then `git pull --rebase && git push` to `main`.
6. If the rebase conflicts in a file you didn't write, stop and ask your human. Don't overwrite a teammate's work.

## Collections and fields
Frontmatter values are plain one-line strings. Filenames are lowercase-with-dashes.

| Collection | Filename | Fields |
|---|---|---|
| tasks | `short-name.md` | title, status (`todo`/`done`), owner (a first name, or `Everyone` for a shared task), due (YYYY-MM-DD), completed (YYYY-MM-DD, the day it was marked done; set it when you mark a task done, remove it if you reopen it). Old done tasks may still carry `output` (a single link): leave it, but don't add it any more. What a task produced goes in `results` |
| events | `YYYY-MM-DD-short-name.md` | title, date (YYYY-MM-DD), time (HH:MM, optional), type (`board`/`deadline`/`meeting`/`team`/`other`), location, repeat (`weekly`, optional), until (YYYY-MM-DD, with repeat) |
| results | `YYYY-MM-DD-short-summary.md` | title (**required**: the result summarised in words, one or two sentences, with its numbers and their source + version), task (filename stem of the task it answers, without `.md`, or `general`), owner (who produced it), date (YYYY-MM-DD, the day it was recorded), link (optional: URL of the document, e.g. a Drive file or a note). Body = **required** details: what was found, in more depth (numbers with source + version, method, uncertainty, what it does NOT show) |
| datasets | `source-name.md` | title, category (`Measuring democracy`/`Parties and elections`/`Attitudes and trust`/`Other`, the brief's groups), url (where to download it). Body = one or two plain-language sentences on what's in it |
| papers | `short-title.md` | title, url, owner (first name of whoever added it), task (filename stem of the task it's for, without `.md`, or `general`). Body = optional notes. The page groups readings by that task's due date. The Literature page is a plain library: no reading status, and conclusions go in `results`, not here |
| notes | `firstname-short-headline.md` | title (the headline), author, updated (`YYYY-MM-DD HH:MM`, local time; set it to now every time you save the note). Body = the notes in Markdown |

How the Tasks page reads them: open tasks are grouped strictly by due date (one group per date). A task owned by
`Everyone` is the shared goal of its date: it heads that date's group, and only tasks with exactly the same due date sit
under it. So give tasks that belong to the same round the same due date. Done tasks move to
**Past work** (`#past`), a timeline grouped the same way. There is no `doing` status any more (old files with it count as open).

**Results** are what each task produced. **Marking a task done always comes with a result**: when you set a task to
`done`, also create a `results` file with `task:` set to that task, a `title` describing the outcome in a sentence or two, and a body with the details
(both required; add `link:` if there's a document). Ask your human for the summary if you don't have it; never invent one. A result can
also be added on its own (`task:` set, task left as it is): adding a result never ticks its task, and reopening a task
never deletes its results. The Results page groups results by `date` (newest first), then by task.
In a result's wording, keep description, prediction and causal claims apart: a correlation or a co-occurrence in time
is a description, and the summary or body should say so. (Older results migrated from the old Findings page may still
carry `type` and `source` fields; keep them.)

The overview headline lives in `content/overview.md`: `title:` and `question:` fields (no body).
Events appear on the Overview calendar. `board` events also drive the countdown.

Notes belong to whoever wrote them: don't edit a teammate's note unless they ask. Notes are public too, so no personal
data or private remarks about people.

Paper notes go in the body and are optional. Never invent a summary of a paper you haven't been given the text of.

## Research rules (from the challenge brief — non-negotiable)
- **Indices are constructed, not observed.** For any index, record what it counts as democracy, who
  supplied the judgement, and the uncertainty interval. Don't present a year-on-year V-Dem change as
  real without checking the interval.
- **Party labels are someone's coding decision.** Always name the source and version (e.g. "PopuList 3.0")
  and state the definition in plain language. Note where PopuList and CHES disagree.
- **Keep description, prediction and causation separate.** No causal language from correlations.
  Country-level patterns don't tell you how individuals voted (ecological fallacy). Use ESS for claims about individuals.
- Every number on the site carries its source and version.

## Files (PDFs, slides, spreadsheets)
Files live in the team's private Google Drive folder, never in this repo. Content files only store the file's Drive link
(result `link`, paper `url`, or a Markdown link in a note; old tasks may have an `output`). The site's link fields have Drive buttons
for this; `DRIVE_SETUP.md` explains how to switch on the automatic Drive picker.

## Public repo: never commit
- Personal data, phone numbers, or private notes about people.
- Paper PDFs (link instead).
- Raw survey microdata (ESS, WVS, Eurobarometer). Their terms forbid redistribution. Keep it in
  `data/raw/` (gitignored) and commit only aggregated tables.
- API keys or tokens.
