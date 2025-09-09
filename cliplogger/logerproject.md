# 0. 크롬 익스텐션 관련
### 0-1. background
- 확장 프로그램이 설치/업데이트될 때 한 번 호출되는 이벤트 리스너를 등록한다.
- 이 타이밍에 컨텍스트 메뉴를 만들어두면, 크롬이 메뉴 항목을 기억한다.
- id: 이 메뉴를 구분하기 위한 고유 식별자.
- title: 실제 우클릭 메뉴에 표시될 문구.
- contexts: ["selection"]: 텍스트가 선택되어 있을 때만 이 메뉴가 뜨게 한다.
```js
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "cliplogger-save-selection",
        title: "ClipLogger: 선택 텍스트 저장",
        contexts: ["selection"],
    });
});
```
- if (info.menuItemId !== "cliplogger-save-selection") return; 현재 드래그하고 선택한 메뉴가 위에서 내가 만든 메뉴가 아닐 때는 클릭이벤트를 실행하지 않는다.
- payload는 드래그한 정보를 저장하는 객체로 발생한 이벤트 객체에서 정보들을 가져와 일시적으로 적재한다.
- 이후 이 payload를 json으로 만들어서 서버로 보낸다.
- 서버에서 돌아온 응답이 존재하면 이를 js 객체로 파싱하여 성공여부에 대한 알림을 띄운다. 만약 실패하면 실패했다고 알림을 띄운다.
```js
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== "cliplogger-save-selection") return;

    const payload = {
        text: info.selectionText || "",
        url: info.pageUrl || tab?.url || "",
        title: tab?.title || "",
        ts: new Date().toISOString(),
    };

    try {
        const res = await fetch("http://127.0.0.1:54545/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        notify({ title: "ClipLogger 실패", message: `HTTP ${res.status}` });
        return;
    }

    const data = await res.json();
    
    notify({
        title: "ClipLogger 저장 완료",
        message: `${data.path} (${data.format || "txt"})`,
    });

    } catch (e) {
        notify({ title: "ClipLogger 에러", message: String(e) });
    } 
});
```
- 위에서 사용하고 있는 notify 함수를 정의하는데 이는 크롬의 notifications를 이용한다.
- 어디서든 notify({ title: "성공", message: "저장이 완료되었습니다" }) 라고 쓰면, → 크롬 우측 하단에 팝업 알림이 뜬다.
```js
function notify({ title, message }) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon128.png", // 없으면 임시로 chrome 기본 아이콘 사용됨
        title,
        message,
        priority: 1, // 우선순위를 의미한다.
    }); 
}
```

### 0-2. manifest
- 매니페스트의 스펙 버전. 지금은 Manifest V3(MV3) 를 사용.
- MV3의 특징: 백그라운드 페이지 대신 서비스 워커, 이벤트 기반으로 필요할 때만 깨어나는 수명주기.
- name 에서 정의한 이름대로 확장프로그램의 이름이 목록, 크롬웹스토어 등에서 보인다.
- "description": "Save selected text with URL to a local log file." -> 확장 프로그램의 짧은 설명. 스토어/확장 상세에서 표시
- "permissions": ["contextMenus", "notifications"] 은 아래와 같다.
- "contextMenus": 우클릭 컨텍스트 메뉴 생성/제어 권한.
- "notifications": chrome.notifications로 알림을 띄울 권한.
- "host_permissions": ["http://127.0.0.1:54545/*", "http://localhost:54545/*"] : 호스트 접근 권한(CORS 대상 도메인 화이트리스트).
- 127.0.0.1 = 내 컴퓨터 자신으로 루프백 주소라고 불린다. -> 기본적으로 루프백 통신은 방화벽에 막히지 않는다.
- "background": {} -> 내 크롬 확장프로그램은 백그라운드에서 이렇게 동작한다는 것을 설정하는 블록이다.
- "service_worker": "background.js" : background.js를 서비스 워커 방식 (필요할때만 잠깐 실행된다.)으로 가동한다는 뜻이다.
- "type": "module" 을 설정하면 이를 자바스크립트 모듈로 실행하여 import나 export 등의 문법을 자유롭게 실행하게 둔다.
```json
{
  "manifest_version": 3,
  "name": "ClipLogger",
  "version": "0.2.0",
  "description": "Save selected text with URL to a local log file.",
  "permissions": ["contextMenus", "notifications"],
  "host_permissions": ["http://127.0.0.1:54545/*", "http://localhost:54545/*"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

# 1. 로거 서버
### 1-1. 로거 서버 기본 설정
- require: Node.js에서 다른 파일이나 모듈을 불러오는 함수로 import와 같은 역할을 한다.
- require("http") → Node.js 내부에 내장된 "http" 모듈을 가져옴. -> 이렇게 하려했으나 이보다 express가 더 좋기 때문에 아래로 코드를 수정하였다.
- 아래는 express를 이용하여 서버를 구성한 코드이다.
- 또한 사용할 포트와 기본 저장양식, 그리고 날짜기준을 지정하는데 env 파일에 지정해서 사용하거나 기본값을 사용하면 된다.
```js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = process.env.CLIPLOGGER_PORT || 54545;
const FORMAT = (process.env.CLIPLOGGER_FORMAT || "txt").toLowerCase(); // txt | md | jsonl
const TIME_ZONE = process.env.CLIPLOGGER_TZ || "Asia/Seoul";
```
- joindms 여러 경로 조각을 하나의 올바른 파일 경로 문자열로 합쳐주는 함수로서 운영체제(OS)에 맞는 경로 구분자를 자동으로 써준다.
- resolveDesktopBase은 윈도우 바탕화면이던 OneDrive가 포함된 바탕화면이던간에 해당 컴퓨터의 바탕화면 아래 ClipLogger라는 폴더의 주소를 반환한다.
- 그리고 초기에 이렇게 설정된 값을 그 프로그램의 BASE_DIR로 삼는다.
- ensureDirSync은 폴더를 만드는 함수로서 호출되면 내부에 재귀적으로 해당 주소에 맞는 폴더를 만드는 함수이다.
```js
function resolveDesktopBase() {
    if (process.env.CLIPLOGGER_BASE_DIR) return process.env.CLIPLOGGER_BASE_DIR;

    const home = os.homedir();
    const desktop1 = path.join(home, "Desktop");
    const desktop2 = path.join(home, "OneDrive", "Desktop"); // Windows OneDrive

    if (fs.existsSync(desktop1)) return path.join(desktop1, "ClipLogger");
    if (fs.existsSync(desktop2)) return path.join(desktop2, "ClipLogger");
    return path.join(home, "ClipLogger"); // fallback
}
const BASE_DIR = resolveDesktopBase();

function ensureDirSync(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
```
- getDateParts 날짜를 파싱하는 함수이다.
- 주어진 타임스템프가 있으면 이를 연월일로 추출한다. 만약 주어진 타임스탬프가 없으면 현재 시각으로 추출한다.
- 만약 잘못된 날짜면 즉시 현재시각으로 재호출해 안전하게 복구한다.
- Intl.DateTimeFormat으로 타임존을 적용한 날짜 포맷터 생성. -> 결국 포멧된 파트들을 { yyyy, mm, dd } 이렇게 구조화된 객체로 반환한다.
```js
function getDateParts(tsIso) {
    // tsIso가 invalid면 현재 시각
    const d = new Date(tsIso || Date.now());
    
    // 잘못된 날짜일 경우
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
```
- toLine함수는 포멧별로 로그를 짜맞추는 역할을 한다. 
- 마크다운, jsonl, txt 중 선택된 값으로 포멧하고 이 포멧된 문자열을 반환한다.
```js
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
```
- resolveDailyFile는 날짜별로 파일경로를 계산한다. getDateParts에서 날짜로 가져와서 -로 엮어서 묶고 폴더명과 확장자면 그리고 그렇게 만든 파일명을 반환한다.
```js
// 날짜별 파일 경로 계산: BASE/YYYY/MM/ClipLogger-YYYY-MM-DD.ext
function resolveDailyFile(tsIso) {
    const { yyyy, mm, dd } = getDateParts(tsIso);
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dir = path.join(BASE_DIR, yyyy, mm);
    const ext = FORMAT === "jsonl" ? "jsonl" : FORMAT === "md" ? "md" : "txt";
    const file = path.join(dir, `ClipLogger-${dateStr}.${ext}`);
    
    return { dir, file, dateStr };
}
```
- writeLog는 payload를 가지고 로그를 컴퓨터에 저장하고 응답객체를 반환한다.
```js
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
```

### 1-2. 로거 서버 설정
- 
```js
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
```