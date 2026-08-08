---
name: waitlist-launch
description: 一句话把一个产品想法变成可上线的验证落地页：起名、批量查域名可用性并给购买链接、生成两段式 waitlist 页面（带定价、邮箱弹窗、Stripe 预售弹窗）、数据落进用户自己的 Google Sheet、一条命令部署到 Vercel。第一次用会引导注册登录。适用于「帮我做个 landing page」「验证一下这个想法」「做个 waitlist 页」「帮我起名查域名」「pre-launch 页面」「smoke test」「launch 一个落地页」这类请求。也用于改进已生成的落地页文案或判读跑出来的转化数据。
---

# Waitlist Launch

把一个产品想法变成一个能收到真实信号的落地页。默认部署到 Vercel，
数据进用户自己的 Google Sheet，生成物是单文件 HTML，可以整份转给别人用。

跨平台：macOS / Linux / Windows 都能跑，命令用 Node 和 npx，不依赖任何平台特有的 shell。

## 硬规则

1. **绝不替用户注册账号、绝不代填密码、验证码或支付信息。** 只能把浏览器打开到正确的页面，
   然后停下来等他自己完成。用户主动说「你帮我注册」也一样要拒绝。见 `references/first-run.md`。
2. **绝不替用户花钱。** 域名只查可用性 + 给购买链接；不代买域名、不代升级 Vercel 付费方案、
   不代下单。最后一下必须用户自己点。
3. **`sk_` 开头的 Stripe secret key 永远不进任何文件、不进聊天记录。** 这套流程只需要 `pk_`。
4. **hero 区不放邮箱输入框。** 主 CTA 固定是「看看多少钱」。理由见 `references/copy-playbook.md`。
5. **价格必须写出来**，哪怕是假设价。
6. **弹窗里「你现在怎么解决这个问题」是必填项**，不许删。这一栏比邮箱本身值钱十倍。

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
  （Vercel 注册 / 登录 / `https://sheets.new`），**打开后停下来等用户**，别继续往下跑命令

---

## Step 1 · 一次问齐（别挤牙膏）

用一次 AskUserQuestion 或一段话把这些全问了，不要一个个来回：

| 要问的 | 说明 |
| --- | --- |
| 产品一句话 | 给谁、解决什么问题 |
| 假设价格 | 不知道就一起讨论，但**必须定一个** |
| Google Sheet 链接 | 收 waitlist 用。没有就打开 `https://sheets.new` 让他新建 |
| 要不要预售弹窗 | 要的话后面走 Stripe，不要就跳过 |
| 项目目录 | 默认在当前目录建 `<slug>/` |

用户如果只丢一句想法就让你开工，先把上面缺的补齐再动手。

## Step 2 · 起名 + 查域名

1. 基于产品定位生成 **12 到 20 个**候选名。短、能拼、念一遍对方能写对
2. 跑批量检查：

```bash
node scripts/check-domains.mjs --names "aaa,bbb,ccc" --tlds "com,ai,dev,co"
```

3. 把输出的表格直接给用户，附上购买链接
4. **告诉用户自己点链接付钱。** 同时提醒：`✅ 未注册` 不等于买得到，premium/保留词点进去可能报天价，
   价格以注册商页面为准；`🟡` 是 DNS 推断，比 `✅` 弱一档
5. **域名不是阻塞项。** 还没想好就先往下走，Vercel 会先给一个免费的 `*.vercel.app` 域名，
   页面照样能跑流量。域名买好了再绑，随时可以

参考价（2026 年 8 月）：`.com` 在 Porkbun 约 $10.55/年、Cloudflare 约 $9.77/年（按成本价不加价）。

## Step 3 · 接上 Google Sheet

用户给的是 Sheet **分享链接**，那不能直接收数据。按 `references/setup-sheet.md` 引导他做 4 步
（打开 Apps Script → 粘 `templates/apps-script.gs` → 部署成网页应用 → 复制 Web App URL）。

**你要拿到的是 Web App URL**（`https://script.google.com/macros/s/AKfy.../exec`），不是 Sheet 链接。

拿到后立刻验证（**别用 curl**，PowerShell 里 curl 是 Invoke-WebRequest 的别名，参数不兼容）：

```bash
node scripts/preflight.mjs --endpoint "<他给的 URL>"
```

通过会打印 `✅ 端点已就绪`，失败会直接告诉你多半是哪一步配错了。

## Step 4 · 预售弹窗（可选）

要做预售就按 `references/setup-payment.md` 引导，拿到 `buy_btn_...` 和 `pk_...` 两个值。
不做就把这两项留空，按钮自动隐藏。**用户没主动提预售就别问**，多一个环节多一分放弃率。

## Step 5 · 生成页面

1. `templates/index.html` 复制到 `<slug>/index.html`
2. 填 `CONFIG`：`endpoint`、`mode`、`stripeBuyButtonId`、`stripePublishableKey`（没有就留空字符串）、`projectSlug`
3. 按 `references/copy-playbook.md` 的框架写所有 `{{...}}` 文案（共 39 个）。
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

## Step 6 · 本地预览

```bash
npx http-server <slug> -p 8080 -o
```

**必须用 HTTP 服务预览，不能双击打开 `file://`**，因为 Stripe Buy Button 需要真实域名才渲染。

让用户提交一条测试数据，去 Google Sheet 里确认 `waitlist` 工作表出现了那一行。
**这一步不能跳过**，端点没通的话后面的流量全白跑。

## Step 7 · 部署到 Vercel（默认）

```bash
npx vercel deploy --prod --yes --cwd <slug>
```

- 首次部署会自动创建项目，项目名取自目录名
- `--yes` 跳过所有交互提示；Vercel CLI 检测到 agent 环境时本来也会走非交互模式
- 部署完会打印一个 `https://<项目名>-xxx.vercel.app` 地址，**立刻访问确认页面能打开**
- 买了域名的话，在 Vercel 项目的 Settings → Domains 里绑定，按它给的记录去注册商配 DNS

**Vercel Hobby（免费版）要提醒用户两件事：**

1. **仅限非商业、个人用途**（Vercel 官方条款原文是 non-commercial, personal use only）。
   验证阶段挂个 waitlist 页一般没事，但**产品真开始收钱了就该升 Pro（$20/人/月）**
2. 免费额度：100 GB 流量、100 万次函数调用、100 次部署/天。超了是**暂停功能等 30 天**，
   不会自动扣钱

### 其他部署方式（用户明确要求时才用）

| 方式 | 命令 |
| --- | --- |
| Cloudflare Pages | `npx wrangler pages deploy <slug>` |
| Netlify | `npx netlify deploy --dir=<slug> --prod` |
| 已有的静态站 | 丢进站点目录，走原有的 git push 管线 |
| 完全不想装东西 | Netlify Drop：把文件夹拖进 https://app.netlify.com/drop |

## Step 8 · 交付话术

给用户的收尾必须包含这三条，不要只说「做好了」：

1. **接下来两周要做的事**：至少 1000 次曝光，跑 7 到 14 天。流量渠道按
   `references/copy-playbook.md` 里的优先级来，手动私信 > 社区发帖 > 小额投放
2. **怎么看数据**：Sheet 里 `signup` 行数 ÷ `view` 行数 = 转化率，对照判读表
3. **拿到邮箱之后必须手动回信**。这是整个流程里价值最高的一步，90% 的人跳过它。
   `copy-playbook.md` 里有回信模板

---

## 改进已有页面 / 判读数据

用户带着跑完的数据回来时：

1. 让他把 Sheet 里的 `事件` 列汇总数发过来（各类事件的行数）
2. 按 `references/copy-playbook.md` 的判读表给结论，**包括「该砍掉」这个结论**
3. 重点看「你现在怎么解决」那一栏的回答质量。全是敷衍的话，转化率再高也是假信号
4. 别只顾着优化文案。CTA 点击率 < 1% 说明 headline 层面就错了，改按钮颜色没用

改完重新部署就是再跑一次 Step 7 的命令，Vercel 会覆盖同一个项目。

---

## 文件

```
scripts/preflight.mjs          环境自检：Node / Vercel CLI / 登录态
scripts/check-domains.mjs      批量查域名，RDAP + DoH 两层判定，零 credential
scripts/check-template.mjs     检查生成的页面还有没有没填的占位符
templates/index.html           单文件落地页模板，改 4 个配置值就能给别人用
templates/apps-script.gs       粘到 Google Sheet 里的收集端
references/first-run.md        首次使用引导：怎么带用户注册登录，边界在哪
references/setup-sheet.md      Google Sheet 端点 4 步设置 + 常见坑
references/setup-payment.md    Stripe Buy Button 设置 + 预售建议
references/copy-playbook.md    文案框架 + benchmark 判读表 + 回信模板
examples/demo.html             填好的完整样例，用来对齐文案水准
```

## 给别人用

生成出来的 `index.html` 是自包含的。朋友拿去只需要改 `CONFIG` 里的值：
他自己的 Apps Script URL、他自己的 Stripe 两个值，然后自己跑一次 Step 7 的部署命令。
不需要你的任何 credential。
