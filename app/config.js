import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// exe(=pkg)로 실행 중인지 감지
const isPackaged = !!process.pkg;

// 사용자 문서 폴더(Windows)
const userDocs = process.env.USERPROFILE
  ? path.join(process.env.USERPROFILE, "Documents")
  : process.cwd();

export const PORT = process.env.PORT || 54545;

// 패키징되었을 때는 Documents/ClipLogger/data로 고정, 개발 중엔 프로젝트 내부 data/
export const BASE_DIR = isPackaged
  ? path.join(userDocs, "ClipLogger", "data")
  : path.resolve(__dirname, "../data");

export const FORMAT = process.env.FORMAT || "md";
export const TIME_ZONE = process.env.TIME_ZONE || "Asia/Seoul";

// PID 파일은 실행 가능한 위치 인근이 아닌, 쓰기 가능한 폴더로
export const PID_FILE = isPackaged
  ? path.join(userDocs, "ClipLogger", "cliplogger.pid")
  : path.resolve(__dirname, "../cliplogger.pid");