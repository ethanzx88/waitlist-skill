---
name: waitlist-launch
description: 一句话把一个产品想法变成可上线的验证落地页：上线前调研（竞品、真实讨论、为什么还没人做成）、起名、生成两段式 waitlist 页面（带定价、邮箱弹窗）、报名进用户自己的 Formspree 表单端点、一条命令部署到 Vercel。第一次用会引导注册登录。适用于「帮我做个 landing page」「验证一下这个想法」「做个 waitlist 页」「查查这个想法有没有人做过」「帮我起名」「pre-launch 页面」「smoke test」「launch 一个落地页」这类请求。也用于改进已生成的落地页文案或判读跑出来的转化数据。
compatibility: 需要 Node.js 18+ 和联网。macOS / Linux / Windows 通用。遵循 Agent Skills 开放标准，不依赖任何单一 agent 的专属能力。
metadata:
  author: ethanzx88
  version: "2.0"
---

# Waitlist Launch

把一个产品想法变成一个能收到真实信号的落地页。默认部署到 Vercel，
报名进用户自己的表单端点（Formspree 或 FormSubmit），生成物是单文件 HTML，可以整份转给别人用。

**跨平台**：macOS / Linux / Windows 都能跑，命令走 Node 和 npx，不依赖任何平台特有的 shell。

**跨 agent**：遵循 Agent Skills 开放标准，不依赖任何单一 agent 的专属能力。
遇到没有的工具（结构化提问、内置浏览器等）都有降级路径，见下面各步骤和 `references/first-run.md`。

## 硬规则

1. **绝不替用户注册账号、绝不代填密码、验证码或支付信息。** 只能把浏览器打开到正确的页面，
   然后停下来等他自己完成。用户主动说「你帮我注册」也一样要拒绝。见 `references/first-run.md`。
2. **绝不替用户花钱。** 不代买域名、不代升级 Vercel 付费方案、不代下单。
   最后一下必须用户自己点。
3. **hero 区不放邮箱输入框。** 主 CTA 固定是「看看多少钱」。理由见 `references/copy-playbook.md`。
4. **价格必须写出来**，哪怕是假设价。
5. **弹窗里「你现在怎么解决这个问题」是必填项**，不许删。这一栏比邮箱本身值钱十倍。

---

## Step 0 · 环境自检

**每次都先跑这个，不管新老用户：**

```bash
node scripts/preflight.mjs
```

2 秒出结果，告诉你 Node、Vercel CLI、Vercel 登录态各是什么情况。

- **全绿** → 一句话带过（「环境都好，Vercel 已登录 xxx」），直接进 Step 1，
  **不要给老用户重放一遍教程**
- **有红的** → 按 `references/first-run.md` 逐项引导。用浏览器工具打开对应页面
  （Vercel 注册 / 登录 / `https://formspree.io/register`），**打开后停下来等用户**，别继续往下跑命令

---

## Step 1 · 一次问齐（别挤牙膏）

**一次问完**，不要一个个来回。有结构化提问工具（选项卡片之类）就用，没有就写成一段话让他一次答：

| 要问的 | 说明 |
| --- | --- |
| 产品一句话 | 给谁、解决什么问题 |
| 假设价格 | 不知道就一起讨论，但**必须定一个** |
| Formspree 端点 | 收 waitlist 用，形如 `https://formspree.io/f/xxxxxxxx`。没有就打开 `https://formspree.io/register` 让他建一个（不想注册就用 `https://formsubmit.co/他的邮箱`） |

项目目录不用问，默认在当前目录建 `<slug>/`。

用户如果只丢一句想法就让你开工，先把上面缺的补齐再动手。

## Step 2 · 先查一圈：这事有没有人做过

拿到想法后、起名之前，按 `references/research-playbook.md` 做一轮 **30 到 60 分钟**的调研，
回答五个问题：有没有现成方案、网上有没有真实讨论、痛点真不真、解决起来有没有坑、
**为什么还没被人解决掉**。

- 用你手头的联网搜索 / 抓取工具。完全没有联网能力的话，把 playbook 里的搜索词模板
  给用户，让他自己搜完把链接贴回来，你负责判读
- 产出是一页 research brief + 三选一结论：**照做 / 换切角 / 别做**。
  结论是「别做」就把证据摆出来直说，别硬着头皮继续往下跑流程；
  「换切角」要给出具体的新切法，跟用户确认后再继续
- 查到的素材直接喂后面的步骤：真实抱怨原话 → 痛点区文案；竞品定价 → 定价锚点；
  竞品差评 → 差异化角度；竞品名字 → 起名避开
- 用户明确说「不用查了直接做」就跳过，但提一句跳过的是什么：
  「行，那『有没有人做过、为什么没做成』这两个问题就靠落地页数据来回答了」

## Step 3 · 起名：精选 5 个让用户挑

页面跑在 `*.vercel.app` 上，子域名几乎不稀缺，所以**不查域名、不看注册情况**，
起名是一个纯产品决策。**别把 20 个名字甩给用户**，按下面的流程收敛成一次选择：

1. 基于产品定位**内部**脑暴 12 到 20 个候选名。短、能拼、念一遍对方能写对。这一步不发给用户
2. 挑出 **5 个最终候选**，每个附一句「为什么选它」。理由的角度要拉开，
   让用户是在不同定位之间选，而不是从 5 个同质化名字里挑。可用的角度比如：
   - 直白型：一眼看懂产品是干嘛的
   - 好记型：短、上口、听一遍能拼出来
   - 品牌型：有性格、有延展空间
   - 关键词型：名字自带搜索词，冷启动沾点光
3. **让用户选**。有结构化提问工具（选项卡片）就用，没有就列成编号清单让他回一个序号。
   选中的名字就是项目 slug 和目录名
4. **别在域名上花时间。** vercel.app 撞名了 Vercel 会自动加后缀，不用提前查；
   用户自己买了真域名的话，部署完去 Settings → Domains 绑，随时可以

## Step 4 · 接上表单端点

详细步骤见 `references/setup-form.md`。要拿到的是这两种之一：

```
https://formspree.io/f/xxxxxxxx      Formspree，有后台能看名单
https://formsubmit.co/他的邮箱        FormSubmit，零注册，只有邮件
```

拿到后立刻验证（**别用 curl**，PowerShell 里 curl 是 Invoke-WebRequest 的别名，参数不兼容）：

```bash
node scripts/preflight.mjs --endpoint "<他给的 URL>"
```

默认只查格式和可达性，不消耗额度。加 `--live` 会真发一条测试提交，**发之前先跟用户说一声**。

**必须主动告诉用户这两件事**，别等他撞墙：

1. Formspree 免费版是**整个账户每月 50 条**，不是每个表单 50 条。同时跑几个页面就是几个页面分这 50 条
2. 后台只留 30 天且免费版不能导出。让他**去邮箱建一条过滤规则把通知邮件存档**，那是唯一的完整备份

## Step 5 · 生成页面

1. `templates/index.html` 复制到 `<slug>/index.html`
2. 填 `CONFIG.endpoint`（就这一个值）
3. 按 `references/copy-playbook.md` 的框架写所有 `{{...}}` 文案（共 35 个）。
   **必须全部替换干净，一个占位符都不能留**。
   写成什么水准可以参考 `examples/demo.html`，那是一份填好的完整样例
4. 跑自检，有漏网的会打印出来：

```bash
node scripts/check-template.mjs <slug>/index.html
```

5. 人工再过一遍：
   - hero 主 CTA 是不是「看看多少钱 →」
   - 定价区有没有真实数字
   - 三条痛点写的是**现状**还是产品功能（写成功能就是没写对，重写）
   - 弹窗那个必填问题还在不在

## Step 6 · 部署到 Vercel（默认）

不做本地预览，部署本身只要 30 秒，**线上 URL 就是预览**：

```bash
npx vercel deploy --prod --yes --cwd <slug>
```

- 首次部署会自动创建项目，项目名取自目录名
- `--yes` 跳过所有交互提示；Vercel CLI 检测到 agent 环境时本来也会走非交互模式
- 部署完会打印一个 `https://<项目名>-xxx.vercel.app` 地址，**立刻访问确认页面能打开**
- 然后让用户在线上页面提交一条测试数据，去他邮箱确认收到了通知。
  **这一步不能跳过**，端点没通的话后面的流量全白跑（这条测试会占掉 50 条额度里的 1 条，正常）
- 买了域名的话，在 Vercel 项目的 Settings → Domains 里绑定，按它给的记录去注册商配 DNS
- 拿到线上域名后，回 Formspree 表单设置里把 **Restrict to domain** 填上，防止端点被别人盗用

**想让用户能算转化率**，顺带引导一下 Vercel Web Analytics：后台 → Analytics → Enable，
把它给的那段 `<script>` 粘进 `index.html` 的 `</head>` 前，再部署一次。
那段脚本的路径每个项目都不一样，所以模板里没法预置（head 里留了注释位）。
免费版给 5 万 events/月，够用。没有它就只能看报名的绝对数。

部署完顺带提一句就够：Vercel 免费版仅限非商业个人用途，验证期额度管够（超了只暂停不扣钱），
产品真开始收钱再升 Pro。

### 其他部署方式（用户明确要求时才用）

| 方式 | 命令 |
| --- | --- |
| Cloudflare Pages | `npx wrangler pages deploy <slug>` |
| Netlify | `npx netlify deploy --dir=<slug> --prod` |
| 已有的静态站 | 丢进站点目录，走原有的 git push 管线 |
| 完全不想装东西 | Netlify Drop：把文件夹拖进 https://app.netlify.com/drop |

## Step 7 · 交付话术

给用户的收尾必须包含这三条，不要只说「做好了」：

1. **接下来两周要做的事**：至少 1000 次曝光，跑 7 到 14 天。流量渠道按
   `references/copy-playbook.md` 里的优先级来，手动私信 > 社区发帖 > 小额投放
2. **怎么看数据**：报名数（数邮件）÷ Vercel Analytics 的 visitors = 转化率，对照判读表。
   没接 Analytics 就看报名的绝对数
3. **拿到邮箱之后必须手动回信**。这是整个流程里价值最高的一步，90% 的人跳过它。
   `copy-playbook.md` 里有回信模板

---

## 改进已有页面 / 判读数据

用户带着跑完的数据回来时：

1. 问他两个数：**报名了多少人**，以及 **Vercel Analytics 里的 visitors**（没接就跳过第二个）
2. 按 `references/copy-playbook.md` 的判读表给结论，**包括「该砍掉」这个结论**
3. **重点看「你现在怎么解决」那一栏的回答质量。** 没有埋点漏斗之后，这是最细的信号了。
   全是敷衍的话，报名数再好看也是假信号，这条一票否决
4. 别只顾着优化文案。转化率低于 2% 说明 headline 层面就错了，改按钮颜色没用

改完重新部署就是再跑一次 Step 6 的命令，Vercel 会覆盖同一个项目。

---

## 文件

```
scripts/install.mjs            跨 agent 安装器（--list 看检测结果）
scripts/preflight.mjs          环境自检：Node / Vercel CLI / 登录态
scripts/check-template.mjs     检查生成的页面还有没有没填的占位符
templates/index.html           单文件落地页模板，只有 1 个配置值要改
references/first-run.md        首次使用引导：怎么带用户注册登录，边界在哪
references/research-playbook.md  上线前调研：去哪查、查什么、结论怎么下
references/setup-form.md       表单端点设置（Formspree / FormSubmit）+ 免费版限制
references/copy-playbook.md    文案框架 + benchmark 判读表 + 回信模板
examples/demo.html             填好的完整样例，用来对齐文案水准
```

## 给别人用

生成出来的 `index.html` 是自包含的。朋友拿去只需要把 `CONFIG.endpoint` 换成
他自己的表单端点，然后自己跑一次 Step 6 的部署命令。不需要你的任何 credential。

注意提醒他：**Formspree 的 50 条额度是按账户算的**，他用自己的账号就是自己的 50 条，
跟你的不冲突。但他要是一个账号跑好几个页面，那几个页面之间会互相抢额度。
