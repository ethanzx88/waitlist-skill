# waitlist-launch

[English](README.md) · **简体中文**

一个 Agent Skill：把一句话产品想法变成能收到真实信号的验证落地页。

- 环境自检 + 首次使用引导（缺账号会打开浏览器让你自己注册，不代办）
- 上线前先查一圈：现成竞品、网上的真实讨论、痛点真不真、为什么还没被人解决掉，
  给出「照做 / 换切角 / 别做」的结论再动手
- 起名：精选 5 个不同定位的候选让你挑
- 生成两段式 waitlist 落地页：带定价、邮箱弹窗
- 报名直接进**你的邮箱**——全程零账号，而且页面代码里不出现你的邮箱地址（用随机码顶替）
- 一条命令部署到 Vercel，自带免费域名
- 生成物是单文件 HTML，改 1 个配置值就能转给朋友用

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
不少工具会读 `~/.agents/skills/`，上面的中立目录安装可能已经覆盖到了。

装好后跟你的 agent 说「帮我做个 waitlist 落地页」就会触发。

### 校验安装

```bash
npx skills-ref validate ~/.agents/skills/waitlist-launch
```

`skills-ref` 是这个标准的官方校验器。四个安装位置都能通过。
校验对象是**安装后的路径**，别校验 clone 下来的仓库——仓库目录名和 skill 名不一致，
直接校验必然报目录名错误，属预期行为。

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
| 一个邮箱 | 报名通知直接发到这里。零账号，且地址不会出现在部署出去的页面里 | 是 |

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

**为什么报名直接进邮箱，以及为什么不做点击埋点。** 一条报名就是一封邮件。
验证页要的就是这个——大多数落地页流量本来就不大，一份能直接点回复的名单，
比一个要专门登录去看的后台实用。这也意味着页面只在真的有人报名时发一次请求：
拿同一条通道记浏览量，每个访客都会往你收件箱塞一封信。
想看访客数就开 Vercel Web Analytics，免费版就有，跟报名通道完全无关。

**邮箱怎么做到不暴露的。** 部署出去的 HTML 里不含你的邮箱地址。设置时 skill 在本地
（页面公开之前）触发激活信，你点确认链接，FormSubmit 发给你一串随机码，
页面里只填这串码。模板检查器会硬性拦下任何带 `@` 的端点。

**已知限制。** 没有后台、没有名单、没有导出——收件箱就是全部数据，
所以要建一条邮箱过滤规则，按标题里的产品名给报名邮件打标签。
FormSubmit 没有公布官方额度上限；验证阶段的量没问题，但没有书面承诺。

**为什么不做收款。** 上线前就收钱，意味着要接支付商开户、退款和纠纷处理，
而这个产品两周后可能就被砍掉了。邮箱加上「你现在怎么解决」的回答在这个阶段已经够用，
等 waitlist 证明了需求再接支付不迟。

---

## 单独跑脚本

**环境自检**

```bash
node scripts/preflight.mjs
```

只检查，不安装、不登录、不注册。

验证收集端点：

```bash
node scripts/preflight.mjs --endpoint "https://formsubmit.co/ajax/<随机码>"
```

**检查生成的页面**

```bash
node scripts/check-template.mjs <slug>/index.html
```

查漏填的占位符、端点配置、hero 区有没有被塞邮箱框、必填问题还在不在、
价格写没写。退出码 0 = 全过。

---

## 目录

```
SKILL.md                       主流程
scripts/install.mjs            跨 agent 安装器
scripts/preflight.mjs          环境自检：Node / Vercel CLI / 登录态
scripts/check-template.mjs     生成物自检
templates/index.html           落地页模板
references/first-run.md        首次使用引导，以及 agent 的行为边界
references/research-playbook.md  上线前调研：去哪查、查什么、结论怎么下
references/setup-form.md       收集端设置：激活流程、随机码、已埋掉的坑
references/copy-playbook.md    文案框架 + 数据判读表 + 示例文案
```
