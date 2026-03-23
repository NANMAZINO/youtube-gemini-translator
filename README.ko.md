[English README](README.md) · [마이그레이션 계획](docs/rebuild/plan.md) · [아키텍처 스냅샷](docs/rebuild/architecture.md) · [진행 로그](docs/rebuild/progress.md) · [레거시 런타임 참고 문서](extension/README.ko.md)

# YouTube AI Translator

> Gemini 기반으로 YouTube 자막을 문맥까지 고려해 번역하는 Chrome 확장 프로그램입니다.

![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-Node%20Built--in-5FA04E?style=flat-square&logo=node.js&logoColor=white)

이제 `src/`가 메인 확장 런타임이며, `npm run build` 결과물인 `dist/`를 Chrome에 로드하면 됩니다. 남아 있는 `extension/` 트리는 회귀 비교용으로만 유지하는 최소 레거시 참고 경로입니다.

## 무엇을 하나요

- YouTube transcript를 읽고 앞뒤 문맥을 반영해 자막을 번역합니다.
- YouTube 시청 페이지 안에 transcript 기반 제어 버튼을 직접 주입합니다.
- 번역 결과를 transcript surface와 영상 오버레이에 함께 표시합니다.
- 이어받기, 재분할, JSON 내보내기/가져오기, 캐시 관리, 사용량 확인을 지원합니다.
- Gemini API Key는 중계 서버 없이 팝업에서 로컬로 관리합니다.

## 빠른 시작

### 1. 확장 프로그램 설치

1. 이 저장소를 클론하거나 다운로드합니다.
2. `npm install`을 실행합니다.
3. `npm run build`를 실행합니다.
4. Chrome에서 `chrome://extensions`를 엽니다.
5. `개발자 모드`를 켭니다.
6. `압축해제된 확장 프로그램을 로드합니다`를 눌러 이 저장소의 `dist/` 폴더를 선택합니다.

### 2. Gemini API Key 등록

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 API Key를 생성합니다.
2. Chrome 툴바에서 확장 프로그램 팝업을 엽니다.
3. 키를 붙여넣고 저장합니다.

키는 `chrome.storage.local`에 난독화된 형태로 저장되며, 요청은 브라우저에서 Gemini API로 직접 전송됩니다.

### 3. 영상 번역 시작

1. 자막이 있는 YouTube 영상을 엽니다.
2. 시청 페이지 액션 영역의 `Open Transcript`를 누릅니다.
3. transcript 패널 안에서 `Translate`를 누릅니다.
4. 후처리나 재사용이 필요하면 `Refine`, `Export`, `Import`를 사용합니다.

## 주요 기능

- 자막 청크 간 문맥을 유지하는 번역
- 중단된 작업을 잇는 Resume Mode
- 팝업에서 관리하는 로컬 번역 캐시
- 토큰 사용량 및 예상 비용 요약
- 드래그, 크기 조절, 위치 초기화를 지원하는 영상 오버레이
- 번역 자막용 JSON 번들 내보내기/가져오기

## 저장소 구조

- `src/`: 메인 TypeScript/Vite 런타임
- `dist/`: Chrome에 로드할 빌드 결과물
- `docs/rebuild/`: 마이그레이션 계획, 아키텍처 스냅샷, 진행 기록, transcript 회귀 체크리스트
- `extension/`: 회귀 비교용으로만 남겨둔 레거시 런타임 참고 경로

## 개발

```bash
npm install
npm run dev
npm run build
npm run check
npm test
npm run test:coverage
```

`npm run check`는 타입 검사, 테스트, 프로덕션 빌드를 한 번에 실행하는 기본 검증 명령입니다.

## 현재 상태

- `src/` 기반 TypeScript/Vite 런타임이 기본 구현입니다.
- Chrome에는 `extension/`이 아니라 `dist/` 결과물을 로드해야 합니다.
- 남아 있는 `extension/` 트리는 레거시 동작 비교를 위한 참고 자료일 뿐입니다.
- YouTube DOM 처리나 오버레이 동작을 바꿀 때는 실제 브라우저 수동 검증이 여전히 중요합니다.

## 제한 사항

- YouTube 자막이 제공되는 영상에서만 동작합니다.
- Gemini 할당량 또는 서비스 상태에 따라 `403`, `429`, `503` 오류가 발생할 수 있습니다.
- 현재 설치 방식은 Chrome 개발자 모드를 전제로 합니다.

## 연락처

`imxtraa7@gmail.com`
