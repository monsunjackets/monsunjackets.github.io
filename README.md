# monsunjackets.github.io

Website of **MONSUN**, a fictional outerwear brand created as a student project for the course
Digital Marketing and Social Media (Wrocław University of Science and Technology, 2026/27).
Nothing is sold here.

Live at https://monsunjackets.github.io. Static site built with [Astro](https://astro.build) and
deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Running it

npm, node and astro run only inside a throwaway container, never on the host (the machine holds
unrelated credentials). `scripts/dock` mounts this checkout and nothing else:

```sh
scripts/dock npm ci                 # install exactly what the lockfile says, with no install scripts
PORT=4321 scripts/dock npm run dev  # dev server, open http://localhost:4321 (CSP is off in dev)
scripts/dock npm run check          # type check
scripts/dock npm test               # unit tests (node:test)
scripts/dock npm run build          # static build into dist/
scripts/dock npm run verify         # checks on dist/ (CSP meta and more)
```

With Docker Desktop the published port is reachable from the Windows browser.

Dev, build, test and check see the checkout read-only and can write only `node_modules/`, `dist/`,
`.astro/` and `.npm-cache/`. `npm ci` and `npm install` get a writable checkout, because with
`ignore-scripts` they run npm's own code only; `.git/`, `scripts/` and `.claude/` stay read-only even then.
Our own scripts that edit sources need `DOCK_RW=1`, e.g. `DOCK_RW=1 scripts/dock npm run images:strip`.
After each run the wrapper fails (exit 97) if `dist/` or `.astro/` contains a `.git`, `.claude`, `.vscode`,
`.mcp.json`, `CLAUDE.md` or `AGENTS.md`.

## Publishing

1. Work on a branch and open a pull request into `main`. The workflow builds and checks it, but does not deploy.
2. Merge the pull request. The push to `main` builds again and deploys to Pages.

A failed build never deploys; the live site stays at the last good version.

## Dependencies

`astro` only, plus `typescript` and `@types/node` for type checking. Any new dependency needs the
owner's approval in a pull request. Rules in `.npmrc`: no install scripts, exact versions, no git
dependencies, and a 7-day cooldown on new releases. The cooldown applies when `npm install` creates or
changes the lockfile; `npm ci` installs the lockfile as it is, so lockfile changes in pull requests
(Dependabot's included) need a look at the release dates.
