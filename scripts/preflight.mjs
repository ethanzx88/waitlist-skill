#!/usr/bin/env node
/**
 * 首次使用环境自检。跑一遍就知道哪些环节已经就绪、哪些还要用户自己动手。
 *
 * 用法:
 *   node preflight.mjs
 *   node preflight.mjs --activate "你的邮箱"        # 触发激活信，拿随机串
 *   node preflight.mjs --activate-page "你的邮箱"   # 被 Cloudflare 拦时的浏览器降级
 *   node preflight.mjs --endpoint "https://formsubmit.co/ajax/<随机串>"
 *   node preflight.mjs --endpoint "..." --live      # 真发一条测试提交
 *
 * 这个脚本只检查，不安装、不登录、不注册。
 * 缺什么由 agent 把浏览器打开到对应页面，让用户自己完成。
 *
 * 端点验证也放在这里而不是用 curl：PowerShell 里 curl 是 Invoke-WebRequest 的别名，
 * 参数完全不兼容，跨平台会炸。
 */

import { exec } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";

const run = promisify(exec);

const FORMSUBMIT = "https://formsubmit.co/ajax/";

/**
 * FormSubmit 的三个服务端行为，脚本里到处要用:
 *
 * 1. 请求必须带 Referer 头（实测逐一排查过: 没有它一律被当成「本地 HTML 文件直开」
 *    拒掉，Origin 带不带反而无所谓）。浏览器会自动带，但 Node 的 fetch 不带，要手动补。
 * 2. 失败也返回 HTTP 200。成败在 body 的 success 字段，且是字符串 "true"/"false"。
 *    所以判断成功只能解析 body，看 res.ok 会把失败当成功。
 * 3. 前面有 Cloudflare，视网络环境可能对 Node 这类非浏览器客户端弹 challenge
 *    （403 "Just a moment"，响应头 cf-mitigated: challenge）。header 补得再全也过不了
 *    要跑 JS 的 challenge，脚本不做任何绕过——检测到就引导走 --activate-page，
 *    让用户在真浏览器里发这一次提交。
 */
const FS_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Referer: "https://waitlist-launch.local/preflight",
};

async function fsPost(url, payload, signal) {
  const res = await fetch(url, {
    signal,
    method: "POST",
    headers: FS_HEADERS,
    body: JSON.stringify(payload),
  });
  const text = (await res.text()).trim();
  const challenged =
    res.headers.get("cf-mitigated") === "challenge" ||
    (res.status === 403 && /just a moment|challenge/i.test(text));
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}
  const ok = data ? String(data.success) === "true" : false;
  return { ok, challenged, status: res.status, message: (data && data.message) || text.slice(0, 200) };
}

/**
 * 用 exec 而不是 execFile：Windows 上 npm 装的命令是 .cmd 批处理垫片，
 * 从 Node 18.20 起（CVE-2024-27980 的修复）execFile 直接 spawn .cmd 会抛 EINVAL，
 * 必须经过 shell。这里所有命令串都是写死的常量，没有拼接外部输入。
 */
async function tryRun(command, timeout = 20000) {
  try {
    const { stdout } = await run(command, { timeout });
    return { ok: true, out: stdout.trim() };
  } catch (err) {
    return { ok: false, out: String(err.stdout || "").trim(), err: String(err.stderr || err.message || "").trim() };
  }
}

/** Vercel CLI 的输出会混进 banner 行，取最后一行非空内容。 */
const lastLine = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() || "";

async function checkNode() {
  const major = Number(process.versions.node.split(".")[0]);
  return {
    key: "node",
    label: "Node.js",
    ok: major >= 18,
    detail: process.version,
    fix: major >= 18 ? null : "需要 Node 18+，去 https://nodejs.org 装一个",
  };
}

/**
 * 一次 whoami 同时探测 CLI 可用性和登录态（CLI 版本号流程用不上，不单独查）。
 * 全局命令不存在时退到 npx；npx 首次会现下载 CLI，可能要等一两分钟。
 *
 * 「命令不存在」的报错是各系统本地化文案，不好匹配，所以反过来认 vercel 自己的
 * 未登录报错（英文、稳定）：匹配不上未登录就当 CLI 不可用，去试 npx。
 */
async function checkVercel() {
  const notAuthed = (r) => /credentials|log ?in|not authenticated/i.test(`${r.err} ${r.out}`);

  let via = "global";
  let r = await tryRun("vercel whoami", 90000);
  if (!r.ok && !notAuthed(r)) {
    via = "npx";
    // 不写 vercel@latest：和文档里部署命令的 npx 缓存键保持一致，避免拉两遍
    r = await tryRun("npx --yes vercel whoami", 180000);
  }

  const loggedOut = !r.ok && notAuthed(r);
  const cliOk = r.ok || loggedOut;
  const who = r.ok ? lastLine(r.out) : "";
  const authed = !!(r.ok && who && !/error|not authenticated|log ?in/i.test(who));

  return [
    {
      key: "vercelCli",
      label: "Vercel CLI",
      ok: cliOk,
      detail: cliOk ? (via === "global" ? "已装（全局）" : "可用（走 npx）") : "不可用",
      fix: cliOk ? null : "网络或 npm 有问题。可以先手动装: npm i -g vercel",
    },
    {
      key: "vercelAuth",
      label: "Vercel 登录",
      ok: authed,
      detail: authed ? who : cliOk ? "未登录" : "跳过（CLI 不可用）",
      fix: !cliOk || authed
        ? null
        : "在你自己的终端里跑一次 `npx vercel login`（会弹浏览器授权）。还没账号的话先去 https://vercel.com/signup 注册。",
    },
  ];
}

const ICON = { true: "✅", false: "❌" };

/**
 * 触发激活信。这一步必须在部署之前做完。
 *
 * 激活是靠「第一次提交」触发的，而拿到随机串之前，端点里只能填裸邮箱。
 * 所以先在本地发这一次，页面还没上线，邮箱地址不会在任何公开文件里出现过。
 */
async function activate(email) {
  console.log(`触发激活信: ${email}\n`);
  try {
    const r = await fsPost(
      FORMSUBMIT + encodeURIComponent(email),
      {
        _subject: "waitlist-launch 激活",
        message: "这是激活请求，确认之后这封信里会带一串随机码。",
      },
      AbortSignal.timeout(20000)
    );

    if (r.challenged) {
      console.log("❌ 被 FormSubmit 前面的 Cloudflare 拦下了（403 challenge，Node 的 fetch 过不去）。");
      console.log("   不用绕它，把这一次提交交给用户的真浏览器发:\n");
      console.log(`   node scripts/preflight.mjs --activate-page "${email}"`);
      console.log("\n   这条命令会起一个本地页面并挂起等用户点完（agent 放后台跑，");
      console.log("   或让用户在自己终端里跑），把它打印的链接打开给用户点一下即可。");
      return 1;
    }

    // 对没激活过的邮箱，这个请求的预期响应就是 "This form needs Activation"，
    // 同时 FormSubmit 已经把激活信发出去了。这里 success=false 反而是对的。
    const sentActivation = /activat/i.test(r.message);
    if (sentActivation) {
      console.log("✅ 激活信已发出。");
    } else if (r.ok) {
      console.log("✅ 这个邮箱似乎已经激活过了（提交直接成功）。");
      console.log("   随机码在你当初的确认信里；找不到就去 https://formsubmit.co 底部重新生成。");
      return 0;
    } else {
      console.log(`❌ 没发出去（HTTP ${r.status}）: ${r.message}`);
      return 1;
    }

    console.log("\n接下来（这几步只能你自己做）:");
    console.log("  1. 去邮箱找 FormSubmit 的确认信，点里面的确认链接");
    console.log("  2. 确认之后会拿到一串**随机码**");
    console.log("  3. 把它拼成端点，填进落地页:");
    console.log(`     ${FORMSUBMIT}<随机码>`);
    console.log("\n⚠️  填随机码，不要填邮箱。端点会出现在公开的 HTML 里，");
    console.log("   填邮箱等于把地址挂出去给爬虫。");
    return 0;
  } catch (err) {
    console.log(`❌ 请求失败: ${String(err.message)}`);
    return 1;
  }
}

/**
 * --activate 的浏览器降级：Cloudflare 对 Node 弹 challenge 时，起一个一次性
 * localhost 页面，让用户在真浏览器里点一下按钮，由浏览器发第一次提交
 * （challenge 该弹就弹，用户正常过，不做任何绕过）。
 *
 * 走 localhost 而不是直接写个本地 HTML 文件，是因为 file:// 直开没有 Referer，
 * 会被 FormSubmit 按「本地文件」拒掉。邮箱只出现在这个本地页面里，不进任何会部署的文件。
 *
 * 页面提交前会给本进程发个 beacon，收到就关服务退出；兜底 10 分钟超时。
 */
function activatePage(email) {
  const page = `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>waitlist-launch 激活</title>
<body style="font-family:system-ui;max-width:34rem;margin:4rem auto;padding:0 1rem;line-height:1.7">
<h2>发送激活信</h2>
<p>点下面的按钮，从你的浏览器给 <b>${email}</b> 发第一次提交，触发 FormSubmit 的激活信。</p>
<p>提交后会跳到 FormSubmit 的页面（中间可能出现一次人机验证，正常通过就行）。
看到激活信已发送的提示后，去邮箱点 <b>Activate Form</b> 拿随机码。</p>
<form action="https://formsubmit.co/${encodeURIComponent(email)}" method="POST"
      onsubmit="navigator.sendBeacon('/done')">
  <input type="hidden" name="_subject" value="waitlist-launch 激活">
  <input type="hidden" name="message" value="这是激活请求，确认之后就能拿到随机码。">
  <button style="font-size:1.05rem;padding:.6rem 1.4rem;cursor:pointer">发送激活信</button>
</form></body></html>`;

  return new Promise((resolve) => {
    let timer;
    const finish = (code, msg) => {
      clearTimeout(timer);
      // close() 只是不收新连接，浏览器的 keep-alive 空闲连接会拖住进程退出，要主动断
      srv.close();
      srv.closeAllConnections();
      console.log(msg);
      resolve(code);
    };
    const srv = createServer((req, res) => {
      if (req.url === "/done") {
        res.end();
        finish(0, [
          "\n✅ 提交已从浏览器发出。接下来（只能用户自己做）:",
          "  1. 去邮箱找 FormSubmit 的确认信，点 Activate Form",
          "  2. 把拿到的随机码发回来，拼成端点:",
          `     ${FORMSUBMIT}<随机码>`,
        ].join("\n"));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page);
    });
    srv.listen(0, "127.0.0.1", () => {
      console.log("在浏览器里打开这个本地页面，点「发送激活信」:\n");
      console.log(`   http://127.0.0.1:${srv.address().port}/\n`);
      console.log("等用户点完这条命令会自己退出（最多等 10 分钟）。");
      timer = setTimeout(() => finish(1, "\n⌛ 10 分钟没等到提交，先退出了。需要就重跑一次。"), 10 * 60 * 1000);
    });
  });
}

/**
 * 验证收集端点。
 *
 * 光靠 GET 分辨不出随机码是真是假（服务端对任何 GET 都回 405），
 * 所以默认只查格式和可达性，真发数据要显式加 --live。
 *
 * 但格式检查里有一条是硬的：**端点里不许出现邮箱地址**。
 * 这个文件会被部署成公开页面，裸邮箱等于挂出去给爬虫。
 */
async function verifyEndpoint(url, live) {
  console.log(`验证端点: ${url}\n`);

  if (!url.startsWith(FORMSUBMIT)) {
    console.log("❌ 端点格式不对，应该是:");
    console.log(`   ${FORMSUBMIT}<随机码>`);
    console.log("\n   注意是 /ajax/ 路径。落地页用 fetch 提交，");
    console.log("   非 ajax 端点会返回跳转页而不是 JSON，读不到成功失败。");
    return 1;
  }

  const tail = url.slice(FORMSUBMIT.length);

  if (tail.includes("@")) {
    console.log("❌ 端点里是邮箱地址，不是随机码。");
    console.log(`   "${tail}" 会原样出现在公开的 HTML 里，爬虫直接就收走了。`);
    console.log("\n   先拿随机码:");
    console.log(`   node scripts/preflight.mjs --activate "${tail}"`);
    return 1;
  }

  if (!/^[A-Za-z0-9_-]{8,}$/.test(tail)) {
    console.log(`❌ "${tail}" 不像 FormSubmit 的随机码。`);
    return 1;
  }

  console.log("✅ 格式正确（/ajax/ 端点 + 随机码，邮箱未暴露）");

  try {
    if (!live) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(20000),
        headers: { Accept: "application/json" },
      });
      // 正常的 GET 响应是 405（服务端拒绝 GET）。403 一律说明被拦
      // （Cloudflare 的 WAF/bot 拦截不一定带 cf-mitigated 头），不能算「可达」
      if (res.status === 403 || res.headers.get("cf-mitigated") === "challenge") {
        console.log(`⚠️  本机 Node 的探测被拦（HTTP ${res.status}，多半是 Cloudflare。`);
        console.log("   不影响浏览器里的访问和报名，格式检查已通过）。");
      } else {
        console.log(`✅ 服务可达（HTTP ${res.status}）`);
      }
      console.log("\n⚠️  没法在不发数据的情况下确认这串随机码是有效的。");
      console.log("   要做真验证就加 --live，会真发一条测试提交到你邮箱:");
      console.log(`   node scripts/preflight.mjs --endpoint "${url}" --live`);
      return 0;
    }

    console.log("\n发送测试提交…");
    const r = await fsPost(
      url,
      {
        _subject: "waitlist-launch 端点测试",
        _template: "table",
        email: "preflight@example.com",
        context: "这是 preflight 脚本发的测试数据，可以直接删掉。",
      },
      AbortSignal.timeout(20000)
    );

    if (r.ok) {
      console.log("✅ 提交成功，去邮箱确认收到了这封测试邮件。");
      return 0;
    }
    if (r.challenged) {
      console.log("❌ 测试提交被 Cloudflare 拦了（Node 过不去 challenge，不代表随机码有问题）。");
      console.log("   改用部署后的线上页面发一条真测试——Step 6 本来就必做这一步。");
      return 1;
    }
    console.log(`❌ 提交被拒: ${r.message}`);
    if (/activat/i.test(r.message)) {
      console.log("   表单还没激活。去邮箱点确认链接，或重跑 --activate。");
    } else if (r.status === 404 || /not found/i.test(r.message)) {
      console.log("   随机码不对，回激活信里再复制一遍。");
    }
    return 1;
  } catch (err) {
    console.log(`❌ 请求失败: ${String(err.message)}`);
    return 1;
  }
}

async function main() {
  for (const flag of ["--activate", "--activate-page"]) {
    const i = process.argv.indexOf(flag);
    if (i === -1) continue;
    const email = process.argv[i + 1];
    if (!email) {
      console.error(`${flag} 后面要跟邮箱地址`);
      process.exitCode = 1;
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log(`❌ "${email}" 不像一个邮箱地址。`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = await (flag === "--activate" ? activate(email) : activatePage(email));
    return;
  }

  const epIdx = process.argv.indexOf("--endpoint");
  if (epIdx !== -1) {
    const url = process.argv[epIdx + 1];
    if (!url) {
      console.error("--endpoint 后面要跟 URL");
      process.exitCode = 1;
      return;
    }
    // 用 exitCode 让进程自然退出，不用 process.exit()：
    // Windows 上 fetch 的句柄还没关就强退，libuv 会抛断言错误、退出码变成 127
    process.exitCode = await verifyEndpoint(url, process.argv.includes("--live"));
    return;
  }

  const node = await checkNode();
  const [cli, auth] = await checkVercel();
  const checks = [node, cli, auth];

  console.log("环境自检\n");
  for (const c of checks) {
    console.log(`${ICON[String(c.ok)]} ${c.label}: ${c.detail}`);
  }

  const todo = checks.filter((c) => c.fix);
  if (todo.length) {
    console.log("\n还要处理:");
    for (const c of todo) console.log(`\n  · ${c.label}\n    ${c.fix}`);
  } else {
    console.log("\n全部就绪，可以开工。");
  }

  console.log("\n提示: 这个脚本只检查，不会替你注册或登录任何账号。");
}

main();
