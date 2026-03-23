[English README](README.md) · [아키텍처](docs/rebuild/architecture.md) · [진행 로그](docs/rebuild/progress.md) · [레거시 기술 문서](extension/README.ko.md)

# YouTube AI Translator

> YouTube 자막을 문맥까지 고려해 번역해 주는 Chrome 확장 프로그램입니다.

![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-3%20Flash%20Preview-8E75FF?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?style=flat-square&logo=javascript&logoColor=black)

**YouTube AI Translator**는 YouTube 자막을 읽어 Google **Gemini 3 Flash Preview**로 번역하고, 결과를 패널과 영상 오버레이에 실시간으로 보여줍니다.  
기본 자동 번역처럼 문장만 잘라 옮기는 대신, 앞뒤 흐름을 반영해 더 자연스럽게 읽히는 자막을 목표로 합니다.

> [!NOTE]
> TypeScript/Vite 재구성이 이제 기본 런타임 경로입니다. 실행 계획, 목표 아키텍처, 세션별 진행 기록은 [docs/rebuild/plan.md](docs/rebuild/plan.md), [docs/rebuild/architecture.md](docs/rebuild/architecture.md), [docs/rebuild/progress.md](docs/rebuild/progress.md)에서 관리합니다. 레거시 `extension/` 트리는 Phase 6 정리 동안 회귀 기준선 용도로만 임시 유지됩니다.

## 한눈에 보기

- **🧠 문맥 기반 번역**: 이전 청크의 번역 흐름을 이어 받아 톤과 용어를 더 일관되게 유지합니다.
- **⚡ 실시간 표시**: 번역 진행 상황과 결과가 패널과 영상 오버레이에 바로 반영됩니다.
- **🔐 로컬 API Key 관리**: 재구성된 팝업에서 Gemini API Key를 저장, 표시, 삭제할 수 있습니다.
- **⏯️ 이어받기 모드**: 새로고침이나 중단 이후에도 완료된 청크를 재사용해 이어서 번역합니다.
- **🗂️ 로컬 캐시**: 번역 결과를 최대 100개까지 저장하고 30일 후 자동 정리합니다.
- **📊 사용량 확인**: 팝업에서 오늘 / 최근 30일 기준 토큰 사용량과 예상 비용을 확인할 수 있습니다.

## 빠른 시작

### 1. 확장 프로그램 설치

현재는 Chrome 웹스토어 배포본이 아니라, 개발자 모드에서 로드하는 방식입니다.

1. 저장소를 내려받거나 압축을 풉니다.
2. `npm install` 을 실행합니다.
3. `npm run build` 를 실행합니다.
4. Chrome에서 `chrome://extensions` 를 엽니다.
5. 우측 상단 `개발자 모드`를 켭니다.
6. `압축해제된 확장 프로그램을 로드합니다`를 눌러 이 저장소의 `dist` 폴더를 선택합니다.

### 2. Gemini API Key 등록

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 API Key를 생성합니다.
2. Chrome 툴바의 확장 프로그램 아이콘을 열어 `YouTube AI Translator`를 클릭합니다.
3. 팝업의 API Key 입력란에 값을 붙여넣고 저장합니다.

> API Key는 브라우저 로컬 스토리지에 난독화되어 저장됩니다.  
> 별도 중계 서버 없이 브라우저에서 Google Gemini API로 직접 요청합니다.

### 3. 번역 시작

1. 자막이 있는 YouTube 영상 페이지를 엽니다.
2. 영상 액션 영역의 `Open Transcript` 버튼으로 자막 패널을 엽니다.
3. 자막 패널 안의 `Translate` 버튼을 눌러 번역을 시작합니다.
4. 후처리나 재사용이 필요하면 재구성된 번역 surface의 `Refine`, `Export JSON`, `Import JSON`을 사용합니다.

## 사용 방법

### 번역 결과 보는 법

- 번역 중에는 진행 상태가 패널에 표시됩니다.
- 완료된 문장은 영상 위 오버레이 자막과 번역 패널에 함께 반영됩니다.
- 오버레이는 드래그로 위치를 옮길 수 있고, 마우스 휠로 글자 크기를 조절할 수 있습니다.
- 오버레이를 더블클릭하면 위치가 초기화됩니다.

### 팝업에서 바꿀 수 있는 설정

- **Gemini API Key**: 브라우저에서 Gemini로 직접 요청할 때 사용할 키 저장, 표시, 삭제
- **Thinking Level**: `Minimal`, `Low`, `Medium`, `High`
- **언어 설정**: 원본 언어 자동 감지, 번역 언어 선택
- **Resume Mode**: 중단된 번역 이어받기
- **토큰 사용량**: 오늘 / 최근 30일 사용량과 추정 비용 확인
- **캐시 관리**: 항목별 삭제, 전체 삭제

### 재구성 parity 상태

- 기본 재구성 런타임은 번역, 이어받기, 재분할, JSON 내보내기/가져오기, 팝업 설정, API Key 관리, 사용량 확인, 캐시 관리를 기본 경로에서 제공합니다.
- 남은 Phase 6 핵심 작업은 레거시 코드 정리와 실제 브라우저에서의 YouTube DOM 변형 수동 검증입니다.

## 제한 사항

- YouTube 자막 데이터가 있는 영상에서만 동작합니다.
- Google Gemini API 사용량과 응답 상태에 따라 `403`, `429`, `503` 오류가 발생할 수 있습니다.
- Chrome 확장 프로그램 개발자 모드 설치를 전제로 합니다.

## 저장소 구성

이 저장소는 두 층으로 문서를 나눠 두었습니다.

- 이 문서: 일반 사용자를 위한 설치와 사용 안내
- [docs/rebuild/architecture.md](docs/rebuild/architecture.md): 현재 런타임 아키텍처와 경계
- [docs/rebuild/progress.md](docs/rebuild/progress.md): 재구성 진행 상태와 최근 작업 기록
- [extension/README.md](extension/README.md): 정리 중인 레거시 구현 참고용 영문 문서
- [extension/README.ko.md](extension/README.ko.md): 정리 중인 레거시 구현 참고용 한국어 문서

## 개발 및 테스트

```bash
npm run dev
npm run build
npm run rebuild:check
npm test
npm run test:coverage
```

루트 `package.json`은 이제 기본 확장 아티팩트를 `dist/`로 빌드하며, 정리 단계가 끝날 때까지 Node 내장 테스트 러너로 레거시 모듈과 재구성된 TypeScript 런타임을 함께 검증합니다.

## FAQ

**Q. 자막이 없는 영상도 번역되나요?**  
A. 아니요. YouTube에서 제공하는 자막 데이터가 있어야 합니다.

**Q. 비용은 얼마나 드나요?**  
A. 비용은 Google Gemini API 사용량에 따라 달라집니다. 팝업에서 오늘 / 최근 30일 기준 추정치를 확인할 수 있습니다.

**Q. 번역이 중간에 멈췄어요.**  
A. 네트워크 문제나 API 혼잡, 할당량 제한일 수 있습니다. 버튼이 재시도 상태로 바뀌면 다시 시도해 보세요.

## 연락처

`imxtraa7@gmail.com`
