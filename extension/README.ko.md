# YouTube AI Translator 기술 문서

> Gemini 3 Flash Preview 기반 YouTube 자막 번역 확장 프로그램의 기술 문서입니다.  
> 일반 사용자용 안내는 [English README](../README.md) 또는 [한국어 README](../README.ko.md)를 참고하세요.

> [!NOTE]
> `src/` 기반 TypeScript/Vite 런타임이 이제 기본 확장 경로이며 결과물은 `dist/`에 빌드됩니다. 이 문서는 Phase 6 정리 동안 남아 있는 `extension/` 구현을 참고하기 위한 레거시 문서입니다. 기준 문서는 [../docs/rebuild/plan.md](../docs/rebuild/plan.md), [../docs/rebuild/architecture.md](../docs/rebuild/architecture.md), [../docs/rebuild/progress.md](../docs/rebuild/progress.md)입니다.

![Docs](https://img.shields.io/badge/Docs-Technical-0A7EA4?style=flat-square)
![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-Node%20Built--in-5FA04E?style=flat-square&logo=node.js&logoColor=white)

## 핵심 기능

- **🧠 문맥 주입**: 최근 번역 결과를 다음 요청에 함께 전달해 톤과 용어 일관성을 높입니다.
- **⚡ 스트리밍 UI**: 완료된 청크를 즉시 반영해 패널과 오버레이가 순차적으로 업데이트됩니다.
- **🧩 구조화 응답 처리**: Gemini JSON 스키마 응답을 사용하며, 번역 경로는 복구 처리를 포함하고 재분할 경로는 엄격하게 파싱합니다.
- **⏯️ Resume 모드**: 부분 저장 데이터를 바탕으로 transcript fingerprint, source checkpoint, timestamp fallback 로직으로 이어받기 지점을 계산합니다.
- **🛑 태스크 프리엠션**: 탭별 active task를 추적하고, 탭이나 영상 URL이 바뀌면 진행 중 작업을 즉시 중단합니다.
- **🔄 Service Worker keep-alive**: 번역과 재분할 중 MV3 서비스 워커가 비활성화되지 않도록 유지합니다.
- **♻️ 중단 인지 재시도**: 과부하성 오류에 대해 지수 백오프로 재시도하면서도 abort 신호는 즉시 반영합니다.
- **🗂️ 로컬 캐시**: `chrome.storage.local`에 최대 100개의 번역 결과를 30일 TTL로 저장합니다.
- **📊 토큰 사용량 기록**: 팝업에서 오늘과 최근 30일 기준 입력·출력 토큰 사용량을 집계합니다.

## 현재 기본 런타임

- 기본 빌드 산출물: `dist/`
- 기본 소스 오브 트루스: `src/`
- 임시 유지 중인 레거시 참고 경로: `extension/`

## 레거시 파일 구조

```text
extension/
├── manifest.json                    # Manifest V3 메타데이터 (v2.1.4)
├── README.md                        # 영문 기술 문서
├── README.ko.md                     # 한글 기술 문서
├── background/
│   └── service-worker.js            # 번역/재분할 오케스트레이션, 태스크 프리엠션, keep-alive
├── content.js                       # content/app/main.js로 연결되는 ESM 로더
├── content.css                      # 콘텐츠 스크립트와 주입 UI 스타일
├── icons/
│   └── icon.svg                     # 확장 아이콘 리소스
├── core/
│   ├── constants.js                 # API, 셀렉터, 캐시, 재시도, UI 설정 상수
│   ├── errors.js                    # API 에러 분류
│   ├── errors.test.js               # 에러 분류 유닛 테스트
│   ├── logger.js                    # 태그 기반 로거 유틸
│   ├── utils.js                     # 타임스탬프, 토큰 추정, fingerprint 유틸
│   └── utils.test.js                # 공용 유틸 유닛 테스트
├── infrastructure/
│   ├── api/
│   │   ├── gemini-client.js         # Gemini 번역/재분할 클라이언트
│   │   ├── retry.js                 # Abort 대응 지수 백오프 재시도 유틸
│   │   └── retry.test.js            # 재시도 로직 유닛 테스트
│   └── storage/
│       ├── cache.js                 # TTL, 인덱스, 부분 저장을 지원하는 캐시 저장소
│       ├── cache.test.js            # 캐시 동작 유닛 테스트
│       └── local-store.js           # API Key 난독화 저장 및 토큰 히스토리 저장
├── content/
│   ├── app/
│   │   ├── main.js                  # 메인 엔트리, observer, 네비게이션 처리, 모듈 조립
│   │   └── panel-controller.js      # 패널 열기/토글과 캐시 렌더링 조정
│   ├── dom/
│   │   ├── button-injector.js       # 스크립트/번역/재분할/패널 토글 버튼 주입
│   │   ├── captions.js              # 자막 추출 및 정규화
│   │   └── transcript-opener.js     # 유튜브 자막 패널 열기
│   ├── flow/
│   │   ├── translation-flow.js      # 번역/이어받기/재분할 상위 오케스트레이션
│   │   ├── translation-executor.js  # 번역 세션 실행 및 진행률 스트리밍
│   │   ├── resume-resolver.js       # 이어받기 시작 지점 계산
│   │   └── resume-resolver.test.js  # 이어받기 로직 유닛 테스트
│   └── ui/
│       ├── ui.js                    # Shadow DOM 패널 UI, import/export, 알림
│       └── ui-overlay.js            # 영상 오버레이, 드래그, 글자 크기 제어
└── popup/
    ├── popup.html                   # 설정, 토큰 사용량, 캐시 UI 마크업
    ├── popup.js                     # 팝업 동작과 렌더링
    ├── popup.css                    # 팝업 스타일
    └── components/
        ├── token-usage.js           # 토큰 집계 및 비용 계산 순수 로직
        └── token-usage.test.js      # 토큰 사용량 계산 유닛 테스트
```

## 저장소 문서

- `../README.md` - 기본 영문 사용자 가이드
- `../README.ko.md` - 한국어 사용자 가이드
- `./README.md` - 기본 영문 기술 문서
- `./README.ko.md` - 한국어 기술 문서

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 플랫폼 | Chrome Extension **Manifest V3** |
| AI 모델 | `generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview` 기반 **Gemini 3 Flash Preview** |
| UI 격리 | **Shadow DOM** |
| DOM 감지 | **MutationObserver** |
| 모듈 구성 | 의존성 분리를 둔 팩토리 스타일 조립 |
| 에러 처리 | 공통 재시도 유틸 + 명시적 API 에러 분류 |
| 안정성 | **AbortController** + service worker keep-alive |
| 저장소 | `chrome.storage.local` |
| 언어 | ES Modules 기반 Vanilla JavaScript |

## 테스트

이 저장소는 Node 내장 테스트 러너 기반 유닛 테스트를 포함합니다.

```bash
npm test
npm run test:coverage
```

| 테스트 파일 | 대상 모듈 |
| --- | --- |
| `infrastructure/storage/cache.test.js` | `cache.js` 캐시 수명주기와 부분 저장 동작 |
| `infrastructure/api/retry.test.js` | `retry.js` 지수 백오프 재시도 동작 |
| `core/errors.test.js` | `errors.js` API 에러 분류 |
| `content/flow/resume-resolver.test.js` | `resume-resolver.js` 체크포인트 및 폴백 이어받기 로직 |
| `core/utils.test.js` | `utils.js` 공용 유틸 함수 |
| `popup/components/token-usage.test.js` | `token-usage.js` 토큰 집계 및 비용 계산 |

- 커버리지 대상은 루트 `package.json`의 `test:coverage` 스크립트에서 설정합니다.
- 현재 임계값은 line, function, branch 모두 최소 80%입니다.
