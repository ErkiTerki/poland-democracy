# Agent setup: Poland Democracy Hub

You are an AI coding agent (e.g. Claude Code) helping a member of a 4-person HEC capstone team.
Your job is to connect this person to the team's shared hub so that, from now on, they can ask you to
add tasks, calendar events, datasets and paper summaries, and you commit them to the shared repo.

- Repo: https://github.com/ErkiTerki/poland-democracy (public, owner: Erik / `ErkiTerki`)
- Live site: https://erkiterki.github.io/poland-democracy/ (rebuilds about a minute after every push to `main`)

Work through the steps below in order. Explain briefly what you're doing as you go, in plain language:
the person may not be technical. **Ask before installing anything.**

## 1. Check the tools
1. Run `git --version`. If git is missing, tell the person how to install it for their OS and stop until they have it.
2. Run `gh --version`. If the GitHub CLI is missing, offer to install it (`brew install gh` on macOS,
   `winget install GitHub.cli` on Windows, see https://cli.github.com for Linux). Ask first.
3. Run `python3 --version`. Python 3.8+ is needed for the build check.

## 2. Log in to GitHub
1. Run `gh auth status`.
2. If they're not logged in, ask the person to run `gh auth login` themselves (it's interactive:
   choose GitHub.com → HTTPS → log in with a web browser). In Claude Code they can type `! gh auth login`.
   If they don't have a GitHub account yet, they need to create one at https://github.com/signup first
   and send their username to Erik.

## 3. Accept the invite to the repo
1. Check whether they already have write access:
   `gh api repos/ErkiTerki/poland-democracy --jq .permissions.push`
2. If that prints `true`, skip to step 4.
3. Otherwise, look for a pending invitation:
   `gh api user/repository_invitations --jq '.[] | select(.repository.full_name=="ErkiTerki/poland-democracy") | .id'`
4. If an id comes back, accept it: `gh api -X PATCH user/repository_invitations/<id>`, then re-run the check in 3.1.
5. If there's no invitation, tell the person to send their GitHub username to Erik and ask to be added as a collaborator.
   Stop here until that's done.

## 4. Get a copy of the repo
1. Ask where they'd like the project folder. If they don't mind, use `~/poland-democracy`.
2. `gh repo clone ErkiTerki/poland-democracy <folder>`
3. If the folder already exists and is this repo, run `git pull --rebase` instead.

## 5. Learn the rules
Read `CLAUDE.md` in the repo **in full**. It is the source of truth for file formats, the workflow
(pull → edit → `python3 build.py` → commit → pull --rebase → push) and the research rules from the
challenge brief. Follow it for every change you make in this repo, now and in future sessions.

## 6. Check everything works
1. In the repo folder, run `python3 build.py`. It should print counts like `site.json: 3 tasks, 4 events, …`.
2. Don't commit anything as a test. Pushing goes to the live site for the whole team.

## 7. Remember the setup
If you have persistent memory or a notes file, save the repo location and a pointer to its `CLAUDE.md`,
so future sessions know where the team hub is without redoing this setup.

## 8. Tell the person they're ready
Summarise in 2–3 lines what you set up, then give examples of things they can now ask you, for example:
- "Add a task for me: pull turnout data from IDEA, due next Friday."
- "Put a team meeting in the calendar on Thursday at 14:00 in the library."
- "I read this paper [link or PDF]: add it to the literature list with a summary."
- "Mark my task about the V-Dem intervals as done."
- "What's on the calendar this week?"

Also mention that they can edit directly on the website: click **Connect to edit** at the top right
of the site and follow the steps. **Never ask the person to paste a GitHub token into the chat.**
The token goes only into the website's connect form.
