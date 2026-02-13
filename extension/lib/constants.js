// lib/constants.js - 프로젝트 전역 상수 모듈
// 여러 파일에 흩어져 있던 중복 상수를 한 곳에서 관리

// ========================================
// Gemini API
// ========================================

/** Gemini 3 Flash API 엔드포인트 */
export const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

// ========================================
// YouTube DOM 셀렉터
// ========================================

/** 유튜브 자막(스크립트) 패널 셀렉터 */
export const SCRIPT_PANEL_SELECTOR =
  'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]';

/** 자막 세그먼트 리스트 렌더러 셀렉터 */
export const TRANSCRIPT_ITEMS_SELECTOR = "ytd-transcript-segment-list-renderer";

/** "스크립트 표시" 버튼을 포함하는 렌더러 섹션 */
export const TRANSCRIPT_BUTTON_SECTION_SELECTOR =
  "ytd-video-description-transcript-section-renderer";

/** 더보기(Expand) 버튼 셀렉터 */
export const DESCRIPTION_EXPAND_BUTTON_SELECTOR = "#expand, #more-button";

// ========================================
// Content Script UI 요소 ID
// ========================================

/** 번역 사이드바 Shadow DOM 호스트 ID */
export const SHADOW_HOST_ID = "yt-ai-translator-shadow-host";

/** 영상 오버레이 Shadow DOM 호스트 ID */
export const OVERLAY_HOST_ID = "yt-ai-translator-overlay-host";

/** AI 번역 메인 버튼 ID */
export const TRANSLATE_BUTTON_ID = "yt-ai-translate-btn";

/** 플로팅 AI 번역 버튼 ID (독립 진입점) */
export const FLOATING_BUTTON_ID = "yt-ai-floating-btn";

/** 재분할 버튼 ID */
export const RE_SPLIT_BUTTON_ID = "yt-ai-refine-btn-ext";

/** 가져오기 버튼 ID */
export const IMPORT_BUTTON_ID = "yt-ai-import-btn";

/** 패널 토글 버튼 ID */
export const PANEL_TOGGLE_BUTTON_ID = "yt-ai-panel-toggle-btn";

// ========================================
// 청크 분할 설정
// ========================================

/** 청크 당 최대 토큰 수 (초과 시 강제 분할) */
export const MAX_TOKENS_PER_CHUNK = 3800;

/** 소프트 리밋 (초과 + 문장 끝이면 분할) */
export const SOFT_LIMIT = 2800;

// ========================================
// 캐시 설정
// ========================================

/** 최대 캐시 저장 개수 */
export const MAX_CACHE_ENTRIES = 100;

/** 캐시 보관 일수 (이 기간 초과 시 자동 정리) */
export const CACHE_TTL_DAYS = 30;

/** 캐시 인덱스 스토리지 키 */
export const CACHE_INDEX_KEY = "idx_translations";

/** 캐시 데이터 접두사 */
export const CACHE_DATA_PREFIX = "dat_";

// ========================================
// UI 동작 설정
// ========================================

/** UI 준비 체크 최대 재시도 횟수 */
export const UI_RETRY_COUNT = 20;

/** UI 준비 체크 재시도 간격 (ms) */
export const UI_RETRY_INTERVAL_MS = 500;

/** UI 최소 높이 기본값 (px) */
export const DEFAULT_MIN_HEIGHT_PX = 400;

/** 패널 렌더 시작 후 최소 높이 해제 대기 시간 (ms) */
export const PANEL_MIN_HEIGHT_RELEASE_MS = 500;

/** 프로그램 스크롤 플래그 해제 대기 시간 (ms) */
export const PROGRAMMATIC_SCROLL_RESET_MS = 600;

/** clearUI 애니메이션 대기 시간 (ms) */
export const UI_CLOSE_ANIMATION_MS = 200;

// ========================================
// 번역 진행률 설정
// ========================================

/** 진행률 타이머 갱신 주기 (ms) */
export const PROGRESS_TIMER_INTERVAL_MS = 1000;

/** 가짜 진행률을 1% 올리는 기준 간격 (sec) */
export const CRAWL_INTERVAL_SEC = 3;

// ========================================
// 재시도 설정
// ========================================

/** API 호출 최대 재시도 횟수 */
export const MAX_RETRIES = 3;
