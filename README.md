# waitlist-launch

一个 Claude Code skill：把一句话产品想法变成可上线的验证落地页。

- 起名 + 批量查域名可用性（零 credential）+ 给购买链接
- 生成两段式 waitlist 落地页：带定价、邮箱弹窗、Stripe 预售弹窗
- 数据落进**你自己的** Google Sheet，附带 view / cta_click / signup 埋点
- 生成物是单文件 HTML，改 4 个配置值就能转给朋友用

## 安装

复制到全局 skills 目录：

```bash
cp -r . ~/.claude/skills/waitlist-launch
```

Windows PowerShell：

```powershell
Copy-Item -Recurse -Force . "$env:USERPROFILE\.claude\skills\waitlist-launch"
```

或者做软链接，改动实时生效（PowerShell 需管理员权限）：

```powershell
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\skills\waitlist-launch" -Target (Get-Location).Path
```

装好后跟 Claude 说「帮我做个 waitlist 落地页」就会触发。

## 用之前准备

| 需要 | 干什么用 | 必需？ |
| --- | --- | --- |
| Node.js 18+ | 跑域名检查脚本 | 是 |
| 一个空的 Google Sheet | 收 waitlist 数据 | 是（也可退而求其次用 FormSubmit） |
| Stripe 账号 | 预售收款 | 否，只收邮箱就不用 |

## 设计取舍

**为什么 hero 区不放邮箱框。** 直接要邮箱收上来的全是「随便看看」。
先让人点一下看价格，看过价格还愿意留邮箱的才是真信号。
Buffer 当年七周只收 120 个注册，但上线后 50 人真的用了，靠的就是这个结构。

**为什么必须写价格。** 没有价格的落地页测出来的只是「免费我就要」。

**为什么弹窗里强制问「你现在怎么解决这个问题」。** 这一栏比邮箱本身值钱十倍，
它把有真实痛点的人和好奇的人分开，也是后续手动回信的抓手。

**为什么不做支付抽成。** 那需要 Stripe Connect，你要接手 connected account 的
onboarding、KYC、资金路由、对账，等于从做工具变成做金融中介。先把工具做出来给人用。

## 单独跑域名检查

```bash
node scripts/check-domains.mjs --names "linkloop,pagekit" --tlds "com,ai,dev"
```

两层判定：先问 RDAP（权威），该 TLD 没有公开 RDAP 服务（`.io` `.co` `.me` `.sh` `.so` 都没有）
就退到 DNS-over-HTTPS 查 NS 记录。`✅` 是 RDAP 结论，`🟡` 是 DNS 推断，弱一档。

**这个脚本只查不买。** 买域名需要你自己点购买链接付钱。

## 目录

```
SKILL.md                       主流程
scripts/check-domains.mjs      域名可用性批量检查
templates/index.html           落地页模板（39 个占位符）
templates/apps-script.gs       Google Sheet 收集端
references/setup-sheet.md      Sheet 端点设置
references/setup-payment.md    Stripe 设置
references/copy-playbook.md    文案框架 + 数据判读表
examples/demo.html             填好的完整样例，用来对齐文案水准
```

本地看一眼样例：

```bash
npx http-server examples -p 8080 -o
```
