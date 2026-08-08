#!/usr/bin/env node
/**
 * 跨 agent 安装器。把这个 skill 装到你机器上各个 agent 能读到的位置。
 *
 * 用法:
 *   node scripts/install.mjs            检测已装的 agent，装到对应目录
 *   node scripts/install.mjs --list     只看检测结果，不装
 *   node scripts/install.mjs --all      装到所有已知目录（不管 agent 装没装）
 *   node scripts/install.mjs --target claude,codex
 *   node scripts/install.mjs --copy     用复制而不是链接（默认链接，改动实时生效）
 *   node scripts/install.mjs --uninstall
 *
 * 两个它替你处理掉的坑:
 *
 * 1. Agent Skills 规范要求 SKILL.md 里的 name 必须和父目录名一致。
 *    这个仓库的目录名是 waitlist_skill，skill 名是 waitlist-launch，
 *    直接 ln -s 整个仓库会不合规。安装器按 name 建正确的目录名。
 *
 * 2. Windows 上建目录链接要用 junction（不需要管理员权限），
 *    symlink 需要开发者模式或管理员。Node 的 fs.symlink 支持指定 'junction'。
 */

import { existsSync, mkdirSync, readFileSync, symlinkSync, rmSync, cpSync, lstatSync, readlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOME = homedir();
const IS_WIN = process.platform === "win32";

/**
 * 各家 agent 的用户级 skills 目录。
 * detect 是用来判断「这个 agent 装没装」的标志目录。
 * agents 那条是跨工具的中立位置（部分工具会读），永远装；
 * 各 agent 自己的目录再装一份，兜住不读中立目录的版本。
 */
const TARGETS = [
  { key: "agents", label: "通用 (~/.agents)", dir: join(HOME, ".agents", "skills"), detect: null,
    note: "跨工具中立目录，部分工具（较新的 Codex CLI / Cursor 等）会读" },
  { key: "claude", label: "Claude Code", dir: join(HOME, ".claude", "skills"), detect: join(HOME, ".claude") },
  { key: "codex", label: "Codex CLI", dir: join(HOME, ".codex", "skills"), detect: join(HOME, ".codex") },
  { key: "cursor", label: "Cursor", dir: join(HOME, ".cursor", "skills"), detect: join(HOME, ".cursor") },
];

function skillName() {
  const fm = readFileSync(join(SKILL_ROOT, "SKILL.md"), "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const name = fm && (fm[1].match(/^name:\s*(.+)$/m) || [])[1];
  if (!name) {
    console.error("读不到 SKILL.md 的 name 字段，仓库是不是不完整？");
    process.exit(1);
  }
  return name.trim();
}

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (flag) => {
    const i = a.indexOf(flag);
    return i === -1 ? null : a[i + 1];
  };
  return {
    list: a.includes("--list"),
    all: a.includes("--all"),
    copy: a.includes("--copy"),
    uninstall: a.includes("--uninstall"),
    help: a.includes("--help") || a.includes("-h"),
    target: (get("--target") || "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

/** 已经装过了吗？返回 "link" | "copy" | null */
function installedAs(dest) {
  if (!existsSync(dest)) return null;
  try {
    const st = lstatSync(dest);
    if (st.isSymbolicLink()) {
      const t = resolve(dirname(dest), readlinkSync(dest));
      return t === SKILL_ROOT ? "link" : "link(指向别处)";
    }
  } catch {
    /* 落到下面 */
  }
  return "copy";
}

function chooseTargets(args) {
  if (args.target.length) {
    const picked = TARGETS.filter((t) => args.target.includes(t.key));
    const unknown = args.target.filter((k) => !TARGETS.some((t) => t.key === k));
    if (unknown.length) {
      console.error(`不认识的目标: ${unknown.join(", ")}`);
      console.error(`可选: ${TARGETS.map((t) => t.key).join(", ")}`);
      process.exit(1);
    }
    return picked;
  }
  if (args.all) return TARGETS;
  // 默认：中立目录 + 检测到装了的 agent
  return TARGETS.filter((t) => t.detect === null || existsSync(t.detect));
}

function install(t, name, args) {
  const dest = join(t.dir, name);
  const existing = installedAs(dest);

  if (existing && !args.uninstall) {
    rmSync(dest, { recursive: true, force: true });
  }

  if (args.uninstall) {
    if (!existing) return { ...t, status: "本来就没装" };
    rmSync(dest, { recursive: true, force: true });
    return { ...t, status: "已卸载" };
  }

  mkdirSync(t.dir, { recursive: true });

  if (args.copy) {
    // 别把 .git 复制进去（filter 对目录返回 false 时整棵子树都不会再进来）
    cpSync(SKILL_ROOT, dest, {
      recursive: true,
      filter: (src) => basename(src) !== ".git",
    });
    return { ...t, status: existing ? "已复制（覆盖旧的）" : "已复制" };
  }

  try {
    // Windows 上 junction 不需要管理员权限，symlink 需要
    symlinkSync(SKILL_ROOT, dest, IS_WIN ? "junction" : "dir");
    return { ...t, status: existing ? "已链接（替换旧的）" : "已链接" };
  } catch (err) {
    if (err.code === "EPERM" || err.code === "EACCES") {
      return { ...t, status: `❌ 没权限建链接，加 --copy 用复制模式` };
    }
    return { ...t, status: `❌ ${err.code || err.message}` };
  }
}

function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`跨 agent 安装器。把这个 skill 装到各个 agent 能读到的位置。

用法:
  node scripts/install.mjs            检测已装的 agent，装到对应目录
  node scripts/install.mjs --list     只看检测结果，不装
  node scripts/install.mjs --all      装到所有已知目录（不管 agent 装没装）
  node scripts/install.mjs --target claude,codex
  node scripts/install.mjs --copy     用复制而不是链接（默认链接，改动实时生效）
  node scripts/install.mjs --uninstall`);
    return;
  }

  const name = skillName();
  const targets = chooseTargets(args);

  console.log(`skill: ${name}`);
  console.log(`来源:  ${SKILL_ROOT}\n`);

  if (args.list) {
    console.log("检测结果:\n");
    for (const t of TARGETS) {
      const detected = t.detect === null ? "中立目录" : existsSync(t.detect) ? "已安装" : "未检测到";
      const state = installedAs(join(t.dir, name)) || "未装";
      console.log(`  ${t.label} · ${detected} · 本 skill: ${state}`);
      console.log(`    ${t.dir}\n`);
    }
    console.log("跑 node scripts/install.mjs 就会装到「已安装」和「中立目录」这些位置。");
    return;
  }

  const results = targets.map((t) => install(t, name, args));

  for (const r of results) {
    console.log(`  ${r.status.startsWith("❌") ? "" : "✅ "}${r.label}: ${r.status}`);
    console.log(`     ${join(r.dir, name)}`);
    if (r.note) console.log(`     ${r.note}`);
    console.log();
  }

  if (args.uninstall) {
    console.log("卸载完成。");
    return;
  }

  const failed = results.filter((r) => r.status.startsWith("❌"));
  if (failed.length) {
    console.log(`${failed.length} 个位置失败了。多半是权限问题，加 --copy 再试一次。`);
    process.exitCode = 1;
    return;
  }

  console.log(args.copy
    ? "装好了。注意复制模式下改仓库不会同步，改完要重新跑一次。"
    : "装好了。用的是链接，改仓库文件即时生效。");
  console.log("\n没在列表里的 agent（Gemini CLI / Goose / Copilot / OpenCode 等）：");
  console.log("查它自己的文档看 skills 目录在哪，手动链过去。");
  console.log("不少工具会读 ~/.agents/skills，上面已经装过了，可以先试试是否已生效。");
}

main();
