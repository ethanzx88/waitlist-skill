# 首次使用引导

第一次跑这个 skill 的人（包括朋友拿去用的时候）通常什么都还没有：没有 Vercel 账号、
也没有建表。这份文件规定 agent 怎么把人带过这一段。

---

## 铁律

**绝不替用户注册账号，绝不代填密码、验证码或支付信息。**

agent 的职责边界是：**把浏览器打开到正确的那一页，告诉他点哪里，然后等他说好了。**
账号是他的，密码只有他知道，这条没有例外，用户主动说「你帮我注册吧」也一样要拒绝。

同理，**不要替用户在 Vercel 上买域名、不要替他升级付费方案**。花钱的动作一律他自己点。

---

## 开场

先跑自检，不要上来就问一堆问题：

```bash
node scripts/preflight.mjs
```

输出会告诉你哪几项已经就绪。**只针对没就绪的项做引导，已经好的直接跳过**，
不要让老用户每次都重看一遍教程。

---

## 环节一：Vercel（部署，必需）

### 判断

- `Vercel 登录 ✅` 加上一个用户名 → 跳过整节
- `未登录` → 往下走

### 引导

先问一句「你有 Vercel 账号吗」，然后二选一：

**没有账号** —— 用浏览器工具打开注册页：

```
https://vercel.com/signup
```

跟他说：选 Continue with GitHub 最省事（后面部署也顺），没有 GitHub 就用邮箱。
然后**停下来等他**，别急着往下跑命令。

**有账号但 CLI 没登录** —— 打开：

```
https://vercel.com/login
```

登录完之后，让他**在自己的终端里**跑一次：

```bash
npx vercel login
```

这一步必须他自己跑：会弹出浏览器做 OAuth 授权，是交互式的，agent 的 shell 是非交互的，代跑会卡住。

### 验证

```bash
node scripts/preflight.mjs
```

看到 `Vercel 登录 ✅ <用户名>` 才算过。没过就再看一遍报错，别硬着头皮往下部署。

### 备选：headless 环境

实在没法交互式登录（比如服务器上），可以让他去
`https://vercel.com/account/tokens` 建一个 token，然后**自己**设成环境变量：

```bash
export VERCEL_TOKEN=xxx
```

**不要让他把 token 贴进聊天窗口。** 让他自己设进环境变量，你只管用。

---

## 环节二：Google Sheet（收 waitlist，必需）

### 引导

用浏览器工具打开这个地址，会**直接新建一张空白表格**，比让他自己去 Drive 里点新建快得多：

```
https://sheets.new
```

建好之后，让他把表格重命名（比如 `xxx-waitlist`），然后按
`references/setup-sheet.md` 走那 4 步拿到 Web App URL。

那 4 步里最容易劝退的是「Google 尚未验证此应用」那个警告页，**提前跟他打预防针**：

> 会跳出一个红色警告说「Google 尚未验证此应用」。这是正常的，意思是这段脚本是你自己写的、
> 没经过 Google 审核，不是说它有问题。点「高级」→「转至...(不安全)」就行。
> 这个脚本只能操作它所属的那一张表。

### 验证

让他把 Web App URL 发给你，然后验证：

```bash
node scripts/preflight.mjs --endpoint "<他给的 URL>"
```

**不要用 `curl`。** PowerShell 里 `curl` 是 `Invoke-WebRequest` 的别名，
`-sL` 这些参数它不认，跨平台会炸。上面这个脚本走 Node 的 fetch，三个系统行为一致。

看到 `✅ 端点已就绪` 才算通。失败的话脚本会直接告诉他多半是哪一步配错了
（最常见的是部署时「谁有访问权限」没选「任何人」）。

---

## 怎么打开浏览器

**不同 agent 的浏览器能力不一样，按你手上有什么选：**

1. **有内置浏览器/预览工具** → 直接用它导航到目标 URL。
   例如 Claude Code 的浏览器面板、其他 agent 的 browser / preview 类工具
2. **有 shell 但没浏览器工具** → 调系统默认浏览器：

   ```bash
   node -e "import('node:child_process').then(m=>m.exec((process.platform==='darwin'?'open ':process.platform==='win32'?'start \"\" ':'xdg-open ')+process.argv[1]))" "https://vercel.com/signup"
   ```

   写成 Node 一行是为了跨平台，`open` / `start` / `xdg-open` 三个系统各不相同。
3. **什么都没有**（纯文本环境、CI）→ 把链接直接贴给用户让他自己点。
   效果一样，只要写清楚「打开这个链接，弄完回来告诉我」。

三种方式都可以，**不要因为没有浏览器工具就跳过引导**。

**打开之后要停下来等。** 不要开完浏览器就继续跑后面的命令，
用户还在填表你就去部署了，只会拿到一堆报错。

---

## 老用户

自检全绿的话，一句话带过就行：

> 环境都是好的（Vercel 已登录 xxx）。给我一个 Google Sheet 链接，或者复用上次那个？

不要重复讲一遍上面的任何内容。引导是给第一次用的人的。
