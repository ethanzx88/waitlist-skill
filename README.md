# waitlist-launch

**English** · [简体中文](README.zh-CN.md)

An Agent Skill that turns a one-sentence product idea into a landing page that collects real demand signal.

- Environment preflight and first-run onboarding (opens a browser for you to sign up, never signs up on your behalf)
- Pre-launch research: existing products, real discussions, whether the pain is real, and why nobody has solved it yet — ends with a build / pivot / drop verdict before anything gets built
- Name brainstorming: five curated candidates with distinct angles, you pick one
- Generates a two-stage waitlist landing page: pricing and an email modal
- Signups go straight to **your inbox** — no account anywhere, and your email address never appears in the page source (a random code stands in for it)
- One command to deploy to Vercel, free domain included
- Output is a single self-contained HTML file. Change one config value and hand it to a friend

**Portable**: follows the [Agent Skills open standard](https://agentskills.io), so it runs in Claude Code, Codex CLI, Cursor, Gemini CLI, GitHub Copilot, OpenCode, Goose, Roo Code, Amp, and 40+ other tools. No agent-specific frontmatter fields are used.

**Cross-platform**: macOS, Linux, and Windows. Every command runs through Node and npx, with no dependency on platform-specific shells.

> **Note on language**: the skill's internal documentation (`SKILL.md`, `references/`) is written in Chinese. The template's placeholders carry all the marketing copy, while its UI chrome (buttons, form labels, inline feedback strings) is written in Chinese — when you ask for a page in another language, the agent translates those strings as part of generation (`SKILL.md` instructs it to).

---

## Install

See which agents you have:

```bash
node scripts/install.mjs --list
```

Then install to every detected location with one command:

```bash
node scripts/install.mjs
```

This installs into `~/.agents/skills/` (the tool-neutral directory) plus each detected agent's own directory (`~/.claude/skills/`, `~/.codex/skills/`, `~/.cursor/skills/`).

| Flag | Effect |
| --- | --- |
| `--list` | Show detection results without installing |
| `--all` | Install to every known directory, detected or not |
| `--target claude,codex` | Install only to the named targets |
| `--copy` | Copy instead of link (links are the default, so repo edits take effect immediately) |
| `--uninstall` | Remove it |

**Two problems the installer handles for you:**

1. The spec requires the `name` in `SKILL.md` to **match its parent directory name**. This repo's folder is `waitlist_skill` while the skill is named `waitlist-launch`, so symlinking the repo directly would be non-compliant. The installer creates the directory under the correct name
2. On Windows it creates a junction rather than a symlink, so **no admin rights are needed**

### Manual install

If you would rather not run the script, link or copy the repo into any of these directories. **The directory must be named `waitlist-launch`.**

| Agent | User scope | Project scope |
| --- | --- | --- |
| Tool-neutral | `~/.agents/skills/` | `.agents/skills/` |
| Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| Codex CLI | `~/.codex/skills/` | `.codex/skills/` |
| Cursor | `~/.cursor/skills/` | `.cursor/skills/` |

For other tools (Gemini CLI, Goose, Copilot, OpenCode, and so on) check their own docs for the skills directory. Many of them read `~/.agents/skills/`, so the neutral install above may already cover them.

Once installed, tell your agent "build me a waitlist landing page" and the skill triggers.

### Verify the install

```bash
npx skills-ref validate ~/.agents/skills/waitlist-launch
```

`skills-ref` is the official reference validator for the standard. All four install locations pass it. Validate the installed path, not the repo clone — the clone's folder name doesn't match the skill name, so validating it directly fails the directory-name check by design.

---

## Before you start

Run the preflight check. It tells you what is missing:

```bash
node scripts/preflight.mjs
```

| What | Used for | Required? |
| --- | --- | --- |
| Node.js 18+ | Running the scripts | Yes |
| Vercel account | Deploying the page. Free tier includes a `*.vercel.app` domain | Yes (Cloudflare / Netlify also supported) |
| An email address | Signup notifications go straight there. No account needed; the address never appears in the deployed page | Yes |

You do not have to set any of this up yourself. On first run the skill walks you through it and opens a browser at the right signup or login page for whatever is missing.
**It will never create an account or type a password for you**, it only gets you to the right page.

---

## Deploying

Vercel by default:

```bash
npx --yes vercel deploy --prod --yes --cwd <slug>
```

The first deploy creates the project automatically. Note that the URL the CLI prints is the **deployment-specific** one — with Deployment Protection on (a common default, especially on team accounts) it redirects to Vercel SSO. The public address is the project alias (`<project>.vercel.app`, suffixed on name collisions): run `npx --yes vercel inspect <printed-url>` and pick the alias that opens without an SSO redirect.

**Two things to know about the Vercel Hobby (free) plan:**

1. **Non-commercial, personal use only** (Vercel's own wording in their fair use guidelines).
   Running a validation waitlist page is usually fine, but once the product actually starts charging, you should move to Pro ($20/user/month)
2. Allowances: 100 GB data transfer, 1M function invocations, 100 deployments per day.
   Going over pauses the feature for 30 days rather than charging you

To use a different host, Cloudflare Pages (`npx wrangler pages deploy`) and Netlify
(`npx netlify deploy --prod`) both work. Commands are in `SKILL.md`.

---

## Design decisions

**Why there is no email field in the hero.** Asking for an email up front collects nothing but idle curiosity. Make people click through to see the price first. The ones who still hand over an email after seeing what it costs are the real signal. Buffer collected only 120 signups over seven weeks this way, but 50 of those people actually used the product at launch.

**Why the price is mandatory.** A landing page without a price only measures "I'd take it if it were free".

**Why the modal forces the question "how do you handle this today".** That field is worth ten times more than the email address next to it. It separates people with a real problem from people who are merely curious, and it gives you something concrete to open with when you follow up by hand.

**Why signups go to email, and why there is no click tracking.** Every submission becomes one email in your inbox. That is all a validation page needs — most landing pages get modest traffic, and a list you can reply to beats a dashboard you check twice. It also means the page fires exactly one request, when someone actually signs up: tracking page views the same way would flood your inbox with one email per visitor. For visitor counts, turn on Vercel Web Analytics, free on Hobby and entirely separate.

**How your email stays private.** The deployed HTML never contains your address. During setup the skill triggers an activation email locally (before anything is public), you click the confirmation link, and FormSubmit hands you a random code. Only that code goes into the page. The template checker hard-rejects any endpoint containing an `@`.

**Known limits.** No dashboard, no list view, no export — your inbox is the complete dataset, so set up a mail filter that tags incoming signups by the product name in the subject line. FormSubmit publishes no official volume cap; validation-scale traffic is fine, but there is no written guarantee.

**Why there is no payments step.** Taking money before launch means payment-provider onboarding, refunds, and dispute handling for a product that might get cut in two weeks. An email plus the "how do you handle this today" answer is plenty of signal at this stage. Wire up payments after the waitlist proves demand.

---

## Running the scripts on their own

**Preflight**

```bash
node scripts/preflight.mjs
```

It only checks. It never installs, logs in, or registers anything.

Verify a collection endpoint:

```bash
node scripts/preflight.mjs --endpoint "https://formsubmit.co/ajax/<random-code>"
```

**Check a generated page**

```bash
node scripts/check-template.mjs <slug>/index.html
```

Catches unfilled placeholders, endpoint misconfiguration, an email field smuggled into the hero, the required follow-up question having been removed, and a missing price. Exit code 0 means everything passed.

---

## Layout

```
SKILL.md                       Main workflow
scripts/install.mjs            Cross-agent installer
scripts/preflight.mjs          Environment check: Node, Vercel CLI, auth state
scripts/check-template.mjs     Output self-check
templates/index.html           Landing page template
references/first-run.md        First-run onboarding and the agent's boundaries
references/research-playbook.md Pre-launch research: where to look, what to collect, how to call it
references/setup-form.md       Endpoint activation flow, random code, known pitfalls
references/copy-playbook.md    Copy framework, benchmarks for reading your data, and a worked example
```
