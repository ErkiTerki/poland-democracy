# Poland Democracy Hub

Team hub for our HEC DSO Capstone (Open Data University / Latitudes): **Democracy, Political Trust
and Radical Voting in Europe**, focused on Poland's democratic U-turn.

**Live site:** https://erkiterki.github.io/poland-democracy/ (rebuilds about a minute after every push to `main`)

## Editing
- **On the website:** click **Connect to edit** (top right) once and paste a GitHub token (the site walks you
  through it). After that you can add, edit and delete tasks, events, datasets and papers right on the site.
  Each save is a commit under your GitHub account, live for everyone about a minute later.
- **With your agent (Claude Code etc.):** clone the repo and ask it to add a task, summarise a paper,
  log a dataset or add a calendar event. It follows the rules in [`CLAUDE.md`](CLAUDE.md).

## Run locally
```sh
python3 build.py
python3 -m http.server   # then open http://localhost:8000
```

## Layout
```
content/   tasks, events (calendar), datasets, papers (one Markdown file per item)
assets/    site JS/CSS
build.py   content/ → site.json
```
