# 🛠 YouTube AI Translator (Technical Documentation)

> **Gemini 3 Flash Preview 기반 YouTube 자막 문맥 번역 프로젝트**  
> 일반 사용자를 위한 안내는 [사용자 가이드](../README.md)를 참고하세요.

---

## ✨ 핵심 기능 (Technical Features)

- **문맥 주입 (Context Injection):** 이전 청크의 번역 문맥(최근 결과)을 다음 요청에 주입해 톤/용어 일관성 유지.
- **스트리밍 UI (Streaming UI):** 청크 완료 메시지를 즉시 반영해 번역 결과를 순차 렌더링.
- **구조화 응답 (JSON Mode):** Gemini JSON Schema 응답을 사용하며, 번역 경로는 백틱 제거 + 손상 JSON 복구를 적용하고 재분할 경로는 파싱 실패를 명시적 에러로 처리.
- **부분 저장 & 이어받기 (Resume Mode):** 진행 중 청크를 부분 저장하고 transcript fingerprint + source checkpoint + timestamp fallback으로 재개 지점 계산.
- **태스크 프리엠션 (Task Preemption):** 탭 단위 active task 추적 + AbortController로 탭 이동/URL 변경 시 불필요 작업 즉시 중단.
- **Service Worker Keep-Alive:** 번역/재분할 중 keep-alive 포트 ping으로 MV3 Service Worker 비활성화 방지.
- **중단 인지 재시도 (Abort-aware Retry):** 429/503(overloaded) 대응 지수 백오프 재시도와 중단 신호(AbortSignal) 동시 처리.
- **로컬 스토리지 캐시:** `chrome.storage.local` 기반 캐시 인덱스(최대 100개) + TTL(30일) 자동 만료. 팝업에서 관리(목록/개별삭제/전체삭제).
- **토큰 사용량 기록:** 일/30일 기준 입력·출력 토큰 히스토리를 저장하고 팝업에서 추정 비용 표시.

---

## 🗂 파일 구조

```
extension/
├── manifest.json                 # Manifest V3 (v2.1.4)
├── README.md                     # 기술 문서(현재 파일)
├── background/
│   └── service-worker.js         # Service Worker: 번역/재분할 오케스트레이션, 태스크 프리엠션, keep-alive 대응
├── content.js                    # ESM 로더 (content/app/main.js 진입)
├── content.css                   # 콘텐츠/버튼 스타일
├── icons/
│   └── icon.svg                  # 확장 아이콘 리소스
├── core/
│   ├── constants.js              # 전역 상수 (API URL, 셀렉터, UI/캐시/재시도 설정)
│   ├── errors.js                 # API 에러 분류 (MODEL_OVERLOADED/QUOTA_EXCEEDED 등)
│   ├── errors.test.js            # errors.js 유닛 테스트
│   ├── logger.js                 # 모듈 태그 + 레벨 로깅
│   ├── utils.js                  # 타임스탬프/토큰 추정/fingerprint 유틸
│   └── utils.test.js             # utils.js 유닛 테스트
├── infrastructure/
│   ├── api/
│   │   ├── gemini-client.js      # Gemini 번역/재분할 통합 API 클라이언트
│   │   ├── retry.js              # AbortSignal 대응 지수 백오프 재시도 유틸
│   │   └── retry.test.js         # retry.js 유닛 테스트
│   └── storage/
│       ├── cache.js              # 캐시 (30일 TTL, 최대 100개 인덱스, 부분 저장)
│       ├── cache.test.js         # cache.js 유닛 테스트
│       └── local-store.js        # API Key 난독화 저장, 토큰 히스토리
├── content/
│   ├── app/
│   │   ├── main.js               # 엔트리: Observer/네비게이션 처리, 모듈 조립
│   │   └── panel-controller.js   # 패널 열기/토글 + 캐시 렌더
│   ├── dom/
│   │   ├── button-injector.js    # "📜 스크립트 열기", "🤖 AI 번역", "재분할", 패널 토글 주입
│   │   ├── captions.js           # 자막 추출/가공
│   │   └── transcript-opener.js  # 유튜브 스크립트 패널 오픈
│   ├── flow/
│   │   ├── translation-flow.js   # 번역/이어받기/재분할 플로우 오케스트레이션
│   │   ├── translation-executor.js # 번역 실행 세션(스트리밍/진행률/부분저장) 전담
│   │   ├── resume-resolver.js    # 이어받기 시작 청크 계산 로직
│   │   └── resume-resolver.test.js # resume-resolver.js 유닛 테스트
│   └── ui/
│       ├── ui.js                 # Shadow DOM 패널/오버레이 UI, import/export, 알림
│       └── ui-overlay.js         # 영상 오버레이/드래그/폰트 크기 제어
└── popup/
    ├── popup.html                # 설정/토큰/캐시 UI
    ├── popup.js                  # 설정 저장, 토큰/캐시 목록 렌더링
    ├── popup.css                 # 팝업 스타일
    └── components/
        ├── token-usage.js        # 토큰 집계/비용 계산 순수 로직
        └── token-usage.test.js   # token-usage.js 유닛 테스트
```

---

## 🛠 기술 스택

| 영역        | 기술                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| 플랫폼      | Chrome Extension **Manifest V3** (Service Worker 기반)                                                |
| AI 모델     | **Gemini 3 Flash Preview** (`generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview`) |
| UI 격리     | **Shadow DOM** — YouTube 호스트 페이지와 격리                                                         |
| DOM 감지    | **MutationObserver** — 패널 등장/페이지 전환 감지                                                     |
| 모듈 패턴   | **Factory Function** + DI — 단일 책임 분리, 전역 오염 최소화                                          |
| 에러 핸들링 | 공통 재시도 유틸(`retry.js`) + 에러 분류(`errors.js`)                                                 |
| 안정성      | **AbortController** + keep-alive 포트 + 중단 인지 재시도                                              |
| 보안        | **XOR + Base64** — API Key 난독화 로컬 저장                                                           |
| 언어        | Vanilla JavaScript (ES Modules)                                                                       |

---

## 🧪 테스트

Node 내장 테스트 러너 기반 유닛 테스트를 포함합니다.

```bash
# 테스트 실행
npm test

# 커버리지 포함 실행
npm run test:coverage
```

| 테스트 파일                            | 대상 모듈                                                |
| -------------------------------------- | -------------------------------------------------------- |
| `infrastructure/storage/cache.test.js` | `cache.js` — 캐시(LRU/TTL/삭제/부분 저장)                |
| `infrastructure/api/retry.test.js`     | `retry.js` — 지수 백오프 재시도                          |
| `core/errors.test.js`                  | `errors.js` — API 에러 분류                              |
| `content/flow/resume-resolver.test.js` | `resume-resolver.js` — 이어받기 시작 지점 계산/폴백 로직 |
| `core/utils.test.js`                   | `utils.js` — 타임스탬프/토큰 추정 등                     |
| `popup/components/token-usage.test.js` | `token-usage.js` — 일/30일 토큰 집계와 비용 계산         |

- 커버리지 측정 대상은 `package.json`의 `test:coverage` 스크립트(`--test-coverage-include`) 기준입니다.
- 커버리지 임계값: line / function / branch 최소 80%
