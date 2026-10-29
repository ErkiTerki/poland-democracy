#!/usr/bin/env python3
"""Compile content/**/*.md into site.json, which the website reads.

Each content file is Markdown with a simple frontmatter block:

    ---
    title: Something
    status: todo
    ---
    Body in Markdown.

Frontmatter values are plain strings (one `key: value` per line). No dependencies.
Run:  python3 build.py   (GitHub Actions runs it on every push to main)
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).parent
COLLECTIONS = ["tasks", "events", "datasets", "papers", "notes"]


def parse(path):
    text = path.read_text(encoding="utf-8")
    meta, body = {}, text
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) < 3:
            raise ValueError(f"{path}: frontmatter opened with --- but never closed")
        for line in parts[1].strip().splitlines():
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            if ":" not in line:
                raise ValueError(f"{path}: bad frontmatter line {line!r} (expected key: value)")
            key, value = line.split(":", 1)
            meta[key.strip()] = value.strip()
        body = parts[2].strip()
    meta["id"] = path.stem
    meta["path"] = str(path.relative_to(ROOT))
    meta["body"] = body
    return meta


def main():
    site = {}
    errors = []
    for name in COLLECTIONS:
        items = []
        for path in sorted((ROOT / "content" / name).glob("*.md")):
            try:
                items.append(parse(path))
            except ValueError as e:
                errors.append(str(e))
        site[name] = items
    overview = ROOT / "content" / "overview.md"
    site["overview"] = parse(overview) if overview.exists() else None
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)
    (ROOT / "site.json").write_text(json.dumps(site, ensure_ascii=False, indent=1), encoding="utf-8")
    print("site.json: " + ", ".join(f"{len(site[n])} {n}" for n in COLLECTIONS))


if __name__ == "__main__":
    main()
