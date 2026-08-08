#!/usr/bin/env node
/**
 * 首次使用环境自检。跑一遍就知道哪些环节已经就绪、哪些还要用户自己动手。
 *
 * 用法:
 *   node preflight.mjs
 *   node preflight.mjs --json
 *   node preflight.mjs --activate "你的邮箱"        # 触发激活信，拿随机串
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
import { promisify } from "node:util";

const run = promisify(exec);

const LINKS = {
  vercelSignup: "https://vercel.com/signup",
  vercelLogin: "https://vercel.com/login",
};

const FORMSUBMIT = "https://formsubmit.co/ajax/";

/**
 * FormSubmit 的两个服务端行为，脚本里到处要用:
 *
 * 1. 请求必须带 Referer 头（实测逐一排查过: 没有它一律被当成「本地 HTML 文件直开」
 *    拒掉，Origin 带不带反而无所谓）。浏览器会自动带，但 Node 的 fetch 不带，要手动补。
 * 2. 失败也返回 HTTP 200。成败在 body 的 success 字段，且是字符串 "true"/"false"。
 *    所以判断成功只能解析 body，看 res.ok 会把失败当成功。
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
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}
  const ok = data ? String(data.success) === "true" : false;
  return { ok, status: res.status, message: (data && data.message) || text.slice(0, 200) };
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

/** 中日韩和全角字符在终端里占两列，padEnd 只按字符数算会错位。 */
const displayWidth = (s) =>
  [...s].reduce((w, ch) => w + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1), 0);

const padDisplay = (s, target) => s + " ".repeat(Math.max(0, target - displayWidth(s)));

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

async function checkVercelCli() {
  // 优先用全局安装的（快），没有再退到 npx（首次会现下载，慢一点）
  let r = await tryRun("vercel --version", 20000);
  let via = "global";
  if (!r.ok) {
    r = await tryRun("npx --yes vercel@latest --version", 180000);
    via = "npx";
  }
  return {
    key: "vercelCli",
    label: "Vercel CLI",
    ok: r.ok,
    detail: r.ok ? `${lastLine(r.out)} (${via})` : "未找到",
    via,
    fix: r.ok ? null : "网络或 npm 有问题。可以先手动装: npm i -g vercel",
  };
}

async function checkVercelAuth(via) {
  const cmd = via === "global" ? "vercel whoami" : "npx --yes vercel@latest whoami";
  const r = await tryRun(cmd, 90000);
  const who = r.ok ? lastLine(r.out) : "";
  const authed = r.ok && who && !/error|not authenticated|log in/i.test(who);
  return {
    key: "vercelAuth",
    label: "Vercel 登录",
    ok: !!authed,
    detail: authed ? who : "未登录",
    fix: authed ? null : `在你自己的终端里跑一次 \`npx vercel login\`（会弹浏览器授权）。还没账号的话先去 ${LINKS.vercelSignup} 注册。`,
  };
}

function manualItems() {
  return [
    {
      key: "endpoint",
      label: "收报名的邮箱",
      ok: null,
      detail: "需要你提供",
      fix: `报名会直接发到这个邮箱，不用注册任何账号。给了邮箱之后跑 \`node scripts/preflight.mjs --activate "你的邮箱"\` 拿随机串。详见 references/setup-form.md`,
    },
  ];
}

const ICON = { true: "✅", false: "❌", null: "⬜" };

/**
 * 触发激活信。这一步必须在部署之前做完。
 *
 * 激活是靠「第一次提交」触发的，而拿到随机串之前，端点里只能填裸邮箱。
 * 所以先在本地发这一次，页面还没上线，邮箱地址不会在任何公开文件里出现过。
 */
async function activate(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.log(`❌ "${email}" 不像一个邮箱地址。`);
    return 1;
  }

  console.log(`触发激活信: ${email}\n`);
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 20000);
  try {
    const r = await fsPost(
      FORMSUBMIT + encodeURIComponent(email),
      {
        _subject: "waitlist-launch 激活",
        message: "这是激活请求，确认之后这封信里会带一串随机码。",
      },
      c.signal
    );

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
  } finally {
    clearTimeout(t);
  }
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

  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 20000);
  try {
    if (!live) {
      const res = await fetch(url, { signal: c.signal, headers: { Accept: "application/json" } });
      console.log(`✅ 服务可达（HTTP ${res.status}）`);
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
      c.signal
    );

    if (r.ok) {
      console.log("✅ 提交成功，去邮箱确认收到了这封测试邮件。");
      return 0;
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
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const json = process.argv.includes("--json");

  const actIdx = process.argv.indexOf("--activate");
  if (actIdx !== -1) {
    const email = process.argv[actIdx + 1];
    if (!email) {
      console.error("--activate 后面要跟邮箱地址");
      process.exitCode = 1;
      return;
    }
    process.exitCode = await activate(email);
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
  const cli = await checkVercelCli();
  const auth = cli.ok
    ? await checkVercelAuth(cli.via)
    : { key: "vercelAuth", label: "Vercel 登录", ok: false, detail: "跳过（CLI 不可用）", fix: null };

  const checks = [node, cli, auth, ...manualItems()];

  if (json) {
    console.log(JSON.stringify({ checks, links: LINKS }, null, 2));
    return;
  }

  const width = Math.max(...checks.map((c) => displayWidth(c.label))) + 2;
  console.log("环境自检\n");
  for (const c of checks) {
    console.log(`${ICON[String(c.ok)]} ${padDisplay(c.label, width)}${c.detail}`);
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
