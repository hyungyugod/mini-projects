const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = process.env.CLIPLOGGER_PORT || 54545;
const FORMAT = (process.env.CLIPLOGGER_FORMAT || "txt").toLowerCase(); // txt | md | jsonl
const TIME_ZONE = process.env.CLIPLOGGER_TZ || "Asia/Seoul";

// ──────────────────────────────────────────────────────────────
// Base dir resolver: 바탕화면/ClipLogger 우선, 환경변수로 override 가능
function resolveDesktopBase() {
    if (process.env.CLIPLOGGER_BASE_DIR) return process.env.CLIPLOGGER_BASE_DIR;

    const home = os.homedir();
    const desktop1 = path.join(home, "Desktop");
    const desktop2 = path.join(home, "OneDrive", "Desktop"); // Windows OneDrive

    if (fs.existsSync(desktop1)) return path.join(desktop1, "ClipLogger");
    if (fs.existsSync(desktop2)) return path.join(desktop2, "ClipLogger");
    return path.join(home, "ClipLogger"); // fallback
}

// 기본 주소로 설정
const BASE_DIR = resolveDesktopBase();

// 폴더 없으면 재귀적으로 생성
function ensureDirSync(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

// 날짜 파싱(타임존 반영) → YYYY, MM, DD
function getDateParts(tsIso) {
    // tsIso가 invalid면 현재 시각
    const d = new Date(tsIso || Date.now());
    if (isNaN(d.getTime())) return getDateParts(new Date().toISOString());

    // 타임존 기준으로 연-월-일을 안전 추출
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const [{ value: yyyy }, , { value: mm }, , { value: dd }] = fmt.formatToParts(d);
    return { yyyy, mm, dd };
}

// 포맷별 문자열 생성
function toLine({ ts = "", title = "", url = "", text = "" }) {
    if (FORMAT === "md") {
        return `- **[${title || url}](${url})** \\
    _${ts}_

    > ${String(text || "").replace(/\n/g, "\n> ")}

    ---
    `;
    }

    if (FORMAT === "jsonl") {
        return JSON.stringify({ ts, title, url, text }) + "\n";
    }

    // txt 기본
    return `[${ts}] ${title} ${url}
    ${text}
    -----
    `;
}

// 날짜별 파일 경로 계산: BASE/YYYY/MM/ClipLogger-YYYY-MM-DD.ext
function resolveDailyFile(tsIso) {
    const { yyyy, mm, dd } = getDateParts(tsIso);
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dir = path.join(BASE_DIR, yyyy, mm);
    const ext = FORMAT === "jsonl" ? "jsonl" : FORMAT === "md" ? "md" : "txt";
    const file = path.join(dir, `ClipLogger-${dateStr}.${ext}`);

    return { dir, file, dateStr };
}

// 파일 append + 응답
function writeLog(payload, res) {
    const ts = payload.ts || new Date().toISOString();
    const { dir, file } = resolveDailyFile(ts);

    ensureDirSync(dir);

    const line = toLine({ ...payload, ts });

    fs.appendFile(file, line, (err) => {
        if (err) {
            return res.status(500).json({ ok: false, error: err.message });
        }

        return res.status(200).json({
            ok: true,
            path: file,
            dir,
            base: BASE_DIR,
            format: FORMAT,
            tz: TIME_ZONE,
        });
    });
}

// ──────────────────────────────────────────────────────────────
// App & Middlewares
const app = express();

// CORS: 기본 전부 허용(로컬 확장만 붙는 구조이니 충분)
app.use(cors());

// Request logging (개발 편의)
app.use(morgan("dev"));

// JSON Body parser (application/json)
app.use(express.json({ limit: "2mb" })); // 필요시 크기 조절

// Health check
app.get("/health", (req, res) => {
    res.json({
        ok: true,
        base: BASE_DIR,
        format: FORMAT,
        tz: TIME_ZONE,
        tip: "POST /log with {text,url,title,ts}",
    });
});

// Log endpoint
app.post("/log", (req, res) => {
    try {
        const payload = req.body || {};
        writeLog(
        {
            text: payload.text || "",
            url: payload.url || "",
            title: payload.title || "",
            ts: payload.ts || new Date().toISOString(),
        },
        res
        );
    } catch (e) {
        res.status(400).json({ ok: false, error: "Invalid JSON" });
    }
});

// 404
app.use((req, res) => {
    res.status(404).json({ ok: false, error: "Not found" });
});

// Global error handler (안전망)
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ ok: false, error: "Internal Server Error" });
});

// Start
app.listen(PORT, () => {
    console.log(`ClipLogger (Express) listening on http://127.0.0.1:${PORT}`);
    console.log(`Base dir : ${BASE_DIR}`);
    console.log(`Format   : ${FORMAT}`);
    console.log(`TimeZone : ${TIME_ZONE}`);
});
