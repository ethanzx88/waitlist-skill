#!/usr/bin/env node
/**
 * 批量检查域名可用性。零 credential，只用公开 RDAP + DNS-over-HTTPS。
 *
 * 用法:
 *   node check-domains.mjs --names "aaa,bbb,ccc" --tlds "com,io,ai"
 *   node check-domains.mjs --domains "aaa.com,bbb.io"
 *   node check-domains.mjs --names "aaa,bbb" --json
 *
 * 两层判定:
 *   1) RDAP（权威）。rdap.org 会把请求转发到该 TLD 的注册局 RDAP 服务器。
 *      被转发走了 + 404  -> available（注册局说没这个域名）
 *      被转发走了 + 200  -> taken
 *      没被转发走         -> 该 TLD 没有公开 RDAP（.io / .co / .me / .sh / .so 都是），走第 2 层
 *   2) DNS-over-HTTPS 查 NS 记录（启发式，比 RDAP 弱）。
 *      NXDOMAIN(Status 3) -> available?（很可能没注册）
 *      有 NS 记录          -> taken
 *
 * 注意: "未注册" 不等于 "买得到"。premium / reserved / 注册局保留词都可能查得到
 * 但下单时价格离谱或直接被拒。最终价格一律以注册商页面为准。
 */

const RDAP_BOOTSTRAP = "https://rdap.org/domain/";
const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const TIMEOUT_MS = 8000;
const CONCURRENCY = 6;

function parseArgs(argv) {
  const out = { names: [], tlds: ["com"], domains: [], json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--names") out.names = splitList(argv[++i]);
    else if (a === "--tlds") out.tlds = splitList(argv[++i]).map((t) => t.replace(/^\./, ""));
    else if (a === "--domains") out.domains = splitList(argv[++i]);
    else if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

const splitList = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

async function fetchWithTimeout(url, init = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

/** 第 1 层: RDAP。只有在请求被转发到真正的注册局服务器时，结论才算权威。 */
async function rdapLookup(domain) {
  try {
    const res = await fetchWithTimeout(RDAP_BOOTSTRAP + encodeURIComponent(domain), {
      redirect: "follow",
      headers: { accept: "application/rdap+json" },
    });
    const forwarded = !new URL(res.url).hostname.endsWith("rdap.org");
    if (!forwarded) return null; // 该 TLD 无公开 RDAP，交给第 2 层
    if (res.status === 404) return "available";
    if (res.status === 200) return "taken";
    return null;
  } catch {
    return null;
  }
}

/** 第 2 层: DoH 查 NS。用 HTTPS 而非系统 DNS，避开被拦截的解析器。 */
async function dohLookup(domain) {
  try {
    const res = await fetchWithTimeout(
      `${DOH_ENDPOINT}?name=${encodeURIComponent(domain)}&type=NS`,
      { headers: { accept: "application/dns-json" } }
    );
    if (!res.ok) return "unknown";
    const j = await res.json();
    if (j.Status === 3) return "available?"; // NXDOMAIN
    if (j.Status === 0 && (j.Answer || []).length) return "taken";
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function checkOne(domain) {
  const rdap = await rdapLookup(domain);
  if (rdap) return { domain, status: rdap, via: "rdap" };
  const doh = await dohLookup(domain);
  return { domain, status: doh, via: "dns" };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

function buyLinks(domain) {
  const d = encodeURIComponent(domain);
  return {
    porkbun: `https://porkbun.com/checkout/search?q=${d}`,
    cloudflare: `https://dash.cloudflare.com/?to=/:account/domains/register/${d}`,
    namecheap: `https://www.namecheap.com/domains/registration/results/?domain=${d}`,
  };
}

const LABEL = {
  available: "✅ 未注册",
  "available?": "🟡 很可能未注册",
  taken: "❌ 已注册",
  unknown: "❔ 查不到",
};

function renderTable(rows) {
  const lines = [
    "| 域名 | 状态 | 依据 | 去买 |",
    "| --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    const l = buyLinks(r.domain);
    const free = r.status.startsWith("available");
    const buy = free
      ? `[Porkbun](${l.porkbun}) · [Cloudflare](${l.cloudflare}) · [Namecheap](${l.namecheap})`
      : "-";
    lines.push(`| \`${r.domain}\` | ${LABEL[r.status] || r.status} | ${r.via} | ${buy} |`);
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(`用法:
  node check-domains.mjs --names "aaa,bbb" --tlds "com,io,ai"
  node check-domains.mjs --domains "aaa.com,bbb.io"
  加 --json 输出机器可读结果`);
    return;
  }

  let domains = [...args.domains];
  for (const n of args.names) for (const t of args.tlds) domains.push(`${n}.${t}`);
  domains = [...new Set(domains.filter((d) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)))];

  if (!domains.length) {
    console.error("没有可检查的域名。用 --names + --tlds 或 --domains 传入。");
    process.exitCode = 1;
    return;
  }

  const rows = await mapLimit(domains, CONCURRENCY, checkOne);

  const order = { available: 0, "available?": 1, unknown: 2, taken: 3 };
  rows.sort(
    (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.domain.localeCompare(b.domain)
  );

  if (args.json) {
    console.log(JSON.stringify(rows.map((r) => ({ ...r, links: buyLinks(r.domain) })), null, 2));
    return;
  }

  const free = rows.filter((r) => r.status.startsWith("available")).length;
  console.log(renderTable(rows));
  console.log(
    `\n共查 ${rows.length} 个，${free} 个未被注册。` +
      `\n🟡 = 靠 DNS 推断（该 TLD 无公开 RDAP），比 ✅ 弱一档。` +
      `\n"未注册" 不等于 "买得到"：premium / 保留词点进去可能报天价。价格以注册商页面为准。`
  );
}

main();
