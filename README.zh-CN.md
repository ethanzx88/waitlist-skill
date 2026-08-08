# waitlist-launch

[English](README.md) · **简体中文**

一个 Agent Skill：把一句话产品想法变成能收到真实信号的验证落地页。

- 环境自检 + 首次使用引导（缺账号会打开浏览器让你自己注册，不代办）
- 起名 + 批量查域名可用性（零 credential）+ 给购买链接
- 生成两段式 waitlist 落地页：带定价、邮箱弹窗、Stripe 预售弹窗
- 数据落进**你自己的** Google Sheet，附带 view / cta_click / signup 埋点
- 一条命令部署到 Vercel，自带免费域名
- 生成物是单文件 HTML，改 4 个配置值就能转给朋友用

**通用性**：遵循 [Agent Skills 开放标准](https://agentskills.io)，可在 Claude Code、Codex CLI、
Cursor、Gemini CLI、GitHub Copilot、OpenCode、Goose、Roo Code、Amp 等 40+ 工具里使用。
没有用任何单一 agent 的专属字段。

**跨平台**：macOS / Linux / Windows 都能跑。所有命令走 Node 和 npx，不依赖平台特有的 shell。

---

## 安装

先看看你机器上装了哪些 agent：

```bash
node scripts/install.mjs --list
```

然后一条命令装到所有检测到的位置：

```bash
node scripts/install.mjs
```

它会装到 `~/.agents/skills/`（跨工具中立目录）以及每个检测到的 agent 自己的目录
（`~/.claude/skills/`、`~/.codex/skills/`、`~/.cursor/skills/`）。

| 参数 | 作用 |
| --- | --- |
| `--list` | 只看检测结果，不装 |
| `--all` | 装到所有已知目录，不管 agent 装没装 |
| `--target claude,codex` | 只装指定的 |
| `--copy` | 用复制而不是链接（默认链接，改仓库即时生效） |
| `--uninstall` | 卸载 |

**它替你处理掉两个坑：**

1. 规范要求 `SKILL.md` 里的 `name` **必须和父目录名一致**。这个仓库的目录名是
   `waitlist_skill`，skill 名是 `waitlist-launch`，直接 `ln -s` 整个仓库是不合规的。
   安装器会用正确的名字建目录
2. Windows 上建目录链接用的是 junction，**不需要管理员权限**（symlink 才需要）

### 手动安装

不想跑脚本的话，把仓库链接（或复制）到下面任一目录，**目录名必须是 `waitlist-launch`**：

| Agent | 用户级目录 | 项目级目录 |
| --- | --- | --- |
| 跨工具中立 | `~/.agents/skills/` | `.agents/skills/` |
| Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| Codex CLI | `~/.codex/skills/` | `.codex/skills/` |
| Cursor | `~/.cursor/skills/` | `.cursor/skills/` |

其他工具（Gemini CLI、Goose、Copilot、OpenCode 等）查各自文档找 skills 目录。
大部分都会读 `~/.agents/skills/`。

装好后跟你的 agent 说「帮我做个 waitlist 落地页」就会触发。

### 校验安装

```bash
npx skills-ref validate ~/.agents/skills/waitlist-launch
```

`skills-ref` 是这个标准的官方校验器。四个安装位置都能通过。

注意：拿它校验**仓库目录本身**会报
`Directory name 'waitlist-skill' must match skill name 'waitlist-launch'`。
这是预期内的，无害 —— 规范要求文件夹名等于 skill 名，而安装器已经用正确的名字建了目录。
校验安装后的路径就行，别校验 clone 下来的仓库。

---

## 用之前准备

跑一下自检，它会告诉你缺什么：

```bash
node scripts/preflight.mjs
```

| 需要 | 干什么用 | 必需？ |
| --- | --- | --- |
| Node.js 18+ | 跑脚本 | 是 |
| Vercel 账号 | 部署落地页，免费版自带 `*.vercel.app` 域名 | 是（也可换 Cloudflare / Netlify） |
| 一个空的 Google Sheet | 收 waitlist 数据 | 是（也可退而求其次用 FormSubmit） |
| Stripe 账号 | 预售收款 | 否，只收邮箱就不用 |

第一次用不用自己配，skill 会引导：缺哪项就把浏览器打开到对应的注册/登录页。
**它不会替你注册账号或输入密码**，只负责把你带到正确的那一页。

---

## 部署

默认 Vercel：

```bash
npx vercel deploy --prod --yes --cwd <slug>
```

首次部署自动建项目，完事给一个 `https://<项目名>-xxx.vercel.app`。

**Vercel Hobby 免费版有两点要知道：**

1. **仅限非商业、个人用途**（官方条款写的是 non-commercial, personal use only）。
   验证阶段挂 waitlist 页一般没事，产品真开始收钱了就该升 Pro（$20/人/月）
2. 额度：100 GB 流量、100 万次函数调用、100 次部署/天。超了是暂停功能等 30 天，不会自动扣钱

想换平台的话 Cloudflare Pages（`npx wrangler pages deploy`）和 Netlify
（`npx netlify deploy --prod`）都支持，`SKILL.md` 里有命令。

---

## 设计取舍

**为什么 hero 区不放邮箱框。** 直接要邮箱收上来的全是「随便看看」。
先让人点一下看价格，看过价格还愿意留邮箱的才是真信号。
Buffer 当年七周只收 120 个注册，但上线后 50 人真的用了，靠的就是这个结构。

**为什么必须写价格。** 没有价格的落地页测出来的只是「免费我就要」。

**为什么弹窗里强制问「你现在怎么解决这个问题」。** 这一栏比邮箱本身值钱十倍，
它把有真实痛点的人和好奇的人分开，也是后续手动回信的抓手。

**为什么用 Google Sheet 而不是 Formspree 这类表单服务。** 表单服务上手确实快一行的事，
但免费额度是硬顶（Formspree 是 50 条/月、30 天存档、不能导出），而这个模板会发
view / cta_click / signup 三种事件来算漏斗，1000 次曝光就能把额度烧光。
Google Sheet 没这个问题，数据还在你自己账号里。

**为什么不做支付抽成。** 那需要 Stripe Connect，你要接手 connected account 的
onboarding、KYC、资金路由、对账，等于从做工具变成做金融中介。先把工具做出来给人用。

---

## 单独跑脚本

**环境自检**

```bash
node scripts/preflight.mjs
```

加 `--json` 输出机器可读结果。只检查，不安装、不登录、不注册。

验证收集端点（**别用 `curl`**，PowerShell 里它是 `Invoke-WebRequest` 的别名，参数不兼容）：

```bash
node scripts/preflight.mjs --endpoint "<你的 Apps Script Web App URL>"
```

**查域名**

```bash
node scripts/check-domains.mjs --names "linkloop,pagekit" --tlds "com,ai,dev"
```

两层判定：先问 RDAP（权威），该 TLD 没有公开 RDAP 服务（`.io` `.co` `.me` `.sh` `.so` 都没有）
就退到 DNS-over-HTTPS 查 NS 记录。`✅` 是 RDAP 结论，`🟡` 是 DNS 推断，弱一档。

**只查不买**，买域名要你自己点购买链接付钱。

**检查生成的页面**

```bash
node scripts/check-template.mjs <slug>/index.html
```

查漏填的占位符、端点配置、hero 区有没有被塞邮箱框、必填问题还在不在、
价格写没写、有没有误把 Stripe secret key 贴进去。退出码 0 = 全过。

---

## 目录

```
SKILL.md                       主流程
scripts/install.mjs            跨 agent 安装器
scripts/preflight.mjs          环境自检：Node / Vercel CLI / 登录态
scripts/check-domains.mjs      域名可用性批量检查
scripts/check-template.mjs     生成物自检
templates/index.html           落地页模板（39 个占位符）
templates/apps-script.gs       Google Sheet 收集端
references/first-run.md        首次使用引导，以及 agent 的行为边界
references/setup-sheet.md      Sheet 端点设置
references/setup-payment.md    Stripe 设置
references/copy-playbook.md    文案框架 + 数据判读表
examples/demo.html             填好的完整样例，用来对齐文案水准
```

本地看一眼样例：

```bash
npx http-server examples -p 8080 -o
```
