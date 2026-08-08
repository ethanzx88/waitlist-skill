#!/usr/bin/env node
/**
 * 检查生成出来的落地页有没有漏填、有没有把关键结构改坏。
 *
 * 用法:
 *   node check-template.mjs <slug>/index.html
 *
 * 退出码 0 = 全过，1 = 有问题。
 *
 * 之所以做成脚本而不是内联 node -e：内联写法在 bash 和 PowerShell 里
 * 引号转义规则不同，跨平台很容易炸。
 */

import { readFileSync } from "node:fs";

const file = process.argv[2];

if (!file) {
  console.error("用法: node check-template.mjs <slug>/index.html");
  process.exit(1);
}

let html;
try {
  html = readFileSync(file, "utf8");
} catch (err) {
  console.error(`读不到文件: ${file}`);
  console.error(String(err.message));
  process.exit(1);
}

const problems = [];
const passes = [];

/* ---------- 1. 占位符 ---------- */
const leftover = [...new Set(html.match(/\{\{[A-Z0-9_]+\}\}/g) || [])];
if (leftover.length) {
  problems.push(`还有 ${leftover.length} 个占位符没填: ${leftover.join(", ")}`);
} else {
  passes.push("占位符全部填充");
}

/* ---------- 2. 收集端点 ---------- */
const endpoint = (html.match(/endpoint:\s*"([^"]*)"/) || [])[1];
if (!endpoint) {
  problems.push("CONFIG.endpoint 没找到，模板结构被改坏了？");
} else if (endpoint.includes("{{") || !endpoint.startsWith("http")) {
  problems.push(`CONFIG.endpoint 还不是有效地址: "${endpoint}"`);
} else {
  const mode = (html.match(/mode:\s*"([^"]*)"/) || [])[1];
  if (mode === "sheet" && !endpoint.includes("script.google.com")) {
    problems.push(`mode 是 "sheet" 但 endpoint 不是 Apps Script 地址: ${endpoint}`);
  } else if (mode === "formsubmit" && !endpoint.includes("formsubmit.co")) {
    problems.push(`mode 是 "formsubmit" 但 endpoint 不是 FormSubmit 地址: ${endpoint}`);
  } else {
    passes.push(`收集端点已配置 (mode=${mode})`);
  }
}

/* ---------- 3. hero 区不能有邮箱输入框 ---------- */
const hero = (html.match(/<header class="hero"[\s\S]*?<\/header>/) || [])[0] || "";
if (!hero) {
  problems.push("找不到 hero 区，模板结构被改坏了？");
} else if (/<input[^>]*type=["']email["']/.test(hero)) {
  problems.push('hero 区出现了邮箱输入框。两段式结构被破坏，收上来的会是低质量信号');
} else {
  passes.push("hero 区无邮箱输入框（两段式结构完好）");
}

/* ---------- 4. 「你现在怎么解决」必填项还在 ---------- */
const ctx = (html.match(/<textarea[^>]*id=["']context["'][^>]*>/) || [])[0];
if (!ctx) {
  problems.push('弹窗里的「你现在怎么解决这个问题」输入框被删了。这一栏比邮箱本身值钱十倍');
} else if (!/\brequired\b/.test(ctx)) {
  problems.push('「你现在怎么解决这个问题」不再是必填项');
} else {
  passes.push("「你现在怎么解决」必填项完好");
}

/* ---------- 5. 价格写出来了 ---------- */
const price = (html.match(/<span class="price-amount">([\s\S]*?)<\/span>/) || [])[1];
if (!price || !price.trim()) {
  problems.push("定价区是空的。没有价格的落地页测出来的只是「免费我就要」");
} else if (!/\d/.test(price)) {
  problems.push(`定价区没有数字: "${price.trim()}"`);
} else {
  passes.push(`定价已写出: ${price.trim()}`);
}

/* ---------- 输出 ---------- */
for (const p of passes) console.log(`✅ ${p}`);
for (const p of problems) console.log(`❌ ${p}`);

console.log();
if (problems.length) {
  console.log(`${problems.length} 个问题要修。`);
  process.exit(1);
}
console.log("全部通过，可以部署了。");
