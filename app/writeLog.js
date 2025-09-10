import fs from "fs";
import path from "path";
import { BASE_DIR, FORMAT } from "./config.js";

/** 파일 존재 여부 */
function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

/** 새 파일일 때 날짜 제목/표 헤더 등 초기 머리말 작성(Markdown) */
function ensureMarkdownHeader(file, dateStr) {
  if (exists(file)) return;
  const header = [
    `# ClipLogger ${dateStr}`,
    "",
    "| Time (ISO) | Title | URL | Text |",
    "|---|---|---|---|",
    ""
  ].join("\n");
  fs.writeFileSync(file, header, "utf-8");
}

/** Markdown 안전 처리(파이프, 개행 등) */
function mdCell(s) {
  if (!s) return "";
  const v = String(s).replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
  return v;
}

/** JSON Lines 모드 */
function appendJsonl(file, payload) {
  fs.appendFileSync(file, JSON.stringify(payload) + "\n", "utf-8");
}

/** Markdown 표 한 줄 추가 */
function appendMarkdownRow(file, payload) {
  const row = `| ${mdCell(payload.ts)} | ${mdCell(payload.title)} | ${mdCell(payload.url)} | ${mdCell(payload.text)} |\n`;
  fs.appendFileSync(file, row, "utf-8");
}

export function writeLog(payload, res) {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const dir = path.join(BASE_DIR, dateStr);
    if (!exists(dir)) fs.mkdirSync(dir, { recursive: true });

    if (FORMAT === "jsonl") {
      const file = path.join(dir, "log.jsonl");
      appendJsonl(file, payload);
    } else {
      
    // 기본 md
      const file = path.join(dir, "log.md");
      ensureMarkdownHeader(file, dateStr);
      appendMarkdownRow(file, payload);
    }

    res.json({ ok: true, saved: FORMAT });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "write error" });
  }
}