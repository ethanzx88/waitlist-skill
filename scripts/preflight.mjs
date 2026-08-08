#!/usr/bin/env node
/**
 * 首次使用环境自检。跑一遍就知道哪些环节已经就绪、哪些还要用户自己动手。
 *
 * 用法:
 *   node preflight.mjs
 *   node preflight.mjs --json
 *   node preflight.mjs --endpoint "https://formspree.io/f/xxxxxxxx"
 *   node preflight.mjs --endpoint "..." --live     # 真发一条测试提交，消耗 1/50 额度
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
  formspree: "https://formspree.io/register",
};

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
      label: "表单端点",
      ok: null,
      detail: "需要你提供",
      fix: `去 ${LINKS.formspree} 注册并建一个 Form，拿到 https://formspree.io/f/xxxxxxxx。不想注册就用 https://formsubmit.co/你的邮箱。详见 references/setup-form.md`,
    },
  ];
}

const ICON = { true: "✅", false: "❌", null: "⬜" };

/**
 * 验证表单端点。
 *
 * 重要限制：Formspree 对存在和不存在的表单 ID **返回一模一样的 405**
 * （`{"error":"Please submit POST request."}`），所以光靠 GET 分辨不出真假。
 * 唯一的真验证是发一次 POST，但那会消耗一条提交额度（免费版整个账户每月只有 50 条）。
 *
 * 所以默认只做「格式 + 可达性」检查，真发数据要显式加 --live。
 */
async function verifyEndpoint(url, live) {
  console.log(`验证端点: ${url}\n`);

  const isFormspree = /^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/.test(url);
  const isFormSubmit = /^https:\/\/formsubmit\.co\/.+/.test(url);

  if (!isFormspree && !isFormSubmit) {
    console.log("❌ 这个地址两种格式都不像。");
    console.log("   Formspree:  https://formspree.io/f/xxxxxxxx");
    console.log("   FormSubmit: https://formsubmit.co/你的邮箱");
    return 1;
  }

  console.log(`✅ 格式正确（${isFormspree ? "Formspree" : "FormSubmit"}）`);

  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 20000);
  try {
    if (!live) {
      const res = await fetch(url, { signal: c.signal, headers: { Accept: "application/json" } });
      // Formspree 对任何 GET 都回 405，这只说明服务活着，不代表表单 ID 有效
      console.log(`✅ 服务可达（HTTP ${res.status}）`);
      console.log("\n⚠️  没法在不发数据的情况下确认表单 ID 是真的。");
      console.log("   Formspree 对真假 ID 返回同样的响应。");
      console.log("   要做真验证就加 --live（会真的提交一条，消耗 1/50 额度）:");
      console.log(`   node scripts/preflight.mjs --endpoint "${url}" --live`);
      return 0;
    }

    console.log("\n发送测试提交（会消耗一条额度）…");
    const res = await fetch(url, {
      signal: c.signal,
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: "waitlist-launch 端点测试",
        email: "preflight@example.com",
        context: "这是 preflight 脚本发的测试数据，可以直接删掉。",
      }),
    });
    const body = (await res.text()).trim();

    if (res.ok) {
      console.log("✅ 提交成功，去邮箱确认收到了这封测试邮件。");
      if (isFormSubmit) console.log("   FormSubmit 首次提交会先发一封激活邮件，点一下才真正生效。");
      return 0;
    }
    console.log(`❌ 提交被拒（HTTP ${res.status}）`);
    console.log(`   返回: ${body.slice(0, 200).replace(/\s+/g, " ")}`);
    if (res.status === 429) console.log("   429 = 触发速率限制（Formspree 是每分钟 20 次），等一分钟再试。");
    if (res.status === 404) console.log("   404 = 表单 ID 不对，回后台复制一遍。");
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
