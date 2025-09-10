import express from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "fs";
import { writeLog } from "./writeLog.js";
import { BASE_DIR, FORMAT, TIME_ZONE, PORT, PID_FILE } from "./config.js";

const app = express();

// CORS (개발/로컬 확장용 기본 허용)
app.use(cors());

// 요청 로깅
app.use(morgan("dev"));

// JSON body 파싱
app.use(express.json({ limit: "2mb" }));

// Health Check
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    base: BASE_DIR,
    format: FORMAT,
    tz: TIME_ZONE,
    tip: "POST /log with {text,url,title,ts}"
  });
});

// Log 수집
app.post("/log", (req, res) => {
  try {
    const p = req.body || {};
    writeLog(
      {
        text: p.text || "",
        url: p.url || "",
        title: p.title || "",
        ts: p.ts || new Date().toISOString(),
      },
      res
    );
  } catch (e) {
    res.status(400).json({ ok: false, error: "Invalid JSON" });
  }
});

// 내부 종료 엔드포인트(배치 stop에서만 사용)
app.post("/__shutdown", (req, res) => {
  res.json({ ok: true, msg: "shutting down" });
  setTimeout(() => process.kill(process.pid, "SIGTERM"), 100);
});

// 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

// 전역 에러
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "Internal Server Error" });
});

// PID 파일 기록
try { fs.writeFileSync(PID_FILE, String(process.pid)); } catch {}

const server = app.listen(PORT, () => {
  console.log(`ClipLogger (Express) http://127.0.0.1:${PORT}`);
  console.log(`Base dir : ${BASE_DIR}`);
  console.log(`Format   : ${FORMAT}`);
  console.log(`TimeZone : ${TIME_ZONE}`);
});

// 정상 종료 처리
const cleanup = () => {
  try { fs.existsSync(PID_FILE) && fs.unlinkSync(PID_FILE); } catch {}
  server && server.close(() => process.exit(0));
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
