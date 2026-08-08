# waitlist-launch

**English** · [简体中文](README.zh-CN.md)

An Agent Skill that turns a one-sentence product idea into a landing page that collects real demand signal.

- Environment preflight and first-run onboarding (opens a browser for you to sign up, never signs up on your behalf)
- Pre-launch research: existing products, real discussions, whether the pain is real, and why nobody has solved it yet — ends with a build / pivot / drop verdict before anything gets built
- Name brainstorming: five curated candidates with distinct angles, you pick one
- Generates a two-stage waitlist landing page: pricing and an email modal
- Signups land in **your own** Formspree form (or FormSubmit, which needs no account at all)
- One command to deploy to Vercel, free domain included
- Output is a single self-contained HTML file. Change one config value and hand it to a friend

**Portable**: follows the [Agent Skills open standard](https://agentskills.io), so it runs in Claude Code, Codex CLI, Cursor, Gemini CLI, GitHub Copilot, OpenCode, Goose, Roo Code, Amp, and 40+ other tools. No agent-specific frontmatter fields are used.

**Cross-platform**: macOS, Linux, and Windows. Every command runs through Node and npx, with no dependency on platform-specific shells.

> **Note on language**: the skill's internal documentation (`SKILL.md`, `references/`) is written in Chinese, and so is the example landing page. The template itself has no hardcoded copy, so you can ask for output in any language.

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

For other tools (Gemini CLI, Goose, Copilot, OpenCode, and so on) check their own docs for the skills directory. Most of them read `~/.agents/skills/`.

Once installed, tell your agent "build me a waitlist landing page" and the skill triggers.

### Verify the install

```bash
npx skills-ref validate ~/.agents/skills/waitlist-launch
```

`skills-ref` is the official reference validator for the standard. All four install locations pass it.

Note that running it against the **repo directory itself** fails with `Directory name 'waitlist-skill' must match skill name 'waitlist-launch'`. That is expected and harmless: the spec requires the folder name to equal the skill name, and the installer already creates it under the right name. Only validate the installed path, not the clone.

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
| A Formspree form | Collecting signups. Free tier is 50 submissions/month **account-wide** | Yes (FormSubmit needs no account at all) |

You do not have to set any of this up yourself. On first run the skill walks you through it and opens a browser at the right signup or login page for whatever is missing.
**It will never create an account or type a password for you**, it only gets you to the right page.

---

## Deploying

Vercel by default:

```bash
npx vercel deploy --prod --yes --cwd <slug>
```

The first deploy creates the project automatically and prints a `https://<project>-xxx.vercel.app` URL.

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

**Why a form service, and why there is no click tracking.** Wiring up a form endpoint takes one line. The catch is that form services bill by submission: Formspree's free tier is **50 a month across your whole account**, not per form. So the page deliberately fires exactly one request, when someone actually signs up. Tracking page views through the same endpoint would burn a month's quota in a day. For visitor counts, turn on Vercel Web Analytics, which is free on Hobby and independent of the form quota.

**What you should know before relying on the free tier.** 50 submissions a month, shared across every form on the account. 30 days of history, and no CSV export. Set up a mail filter to archive the notification emails, because your inbox is the only complete copy you get. Formspree's own docs do not say what happens to submission 51, so move before you hit the ceiling, not after.

**Why there is no payments step.** Taking money before launch means payment-provider onboarding, refunds, and dispute handling for a product that might get cut in two weeks. An email plus the "how do you handle this today" answer is plenty of signal at this stage. Wire up payments after the waitlist proves demand.

---

## Running the scripts on their own

**Preflight**

```bash
node scripts/preflight.mjs
```

Add `--json` for machine-readable output. It only checks. It never installs, logs in, or registers anything.

Verify a collection endpoint (use this instead of `curl`, which is an alias for `Invoke-WebRequest` in PowerShell and takes incompatible flags):

```bash
node scripts/preflight.mjs --endpoint "https://formspree.io/f/xxxxxxxx"
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
templates/index.html           Landing page template (35 placeholders)
references/first-run.md        First-run onboarding and the agent's boundaries
references/research-playbook.md Pre-launch research: where to look, what to conclude
references/research-playbook.md  Pre-launch research: where to look, what to collect, how to call it
references/setup-form.md       Form endpoint setup and free-tier limits
references/copy-playbook.md    Copy framework and benchmarks for reading your data
examples/demo.html             A fully filled example, for calibrating copy quality
```

Preview the example locally:

```bash
npx http-server examples -p 8080 -o
```
