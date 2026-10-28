# Poland Democracy Hub

Team hub for our HEC DSO Capstone (Open Data University / Latitudes): **Democracy, Political Trust
and Radical Voting in Europe**, focused on Poland's democratic U-turn.

**Live site:** https://erkiterki.github.io/poland-democracy/ (rebuilds about a minute after every push to `main`)

## Editing
- **With your agent (Claude Code etc.):** clone the repo and ask it to add a task, summarise a paper,
  log a dataset or add a chart. It follows the rules in [`CLAUDE.md`](CLAUDE.md).
- **In the browser:** every item on the site has an *Edit* link, and every section has a *+ Add* button.
  Both open GitHub's editor with the template filled in.

## Run locally
```sh
python3 build.py
python3 -m http.server   # then open http://localhost:8000
```

## Layout
```
content/   tasks, datasets, papers, decisions, meetings, charts (one Markdown file per item)
data/      tidy CSVs used by charts
assets/    site JS/CSS
build.py   content/ → site.json
```
