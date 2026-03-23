[English README](README.md) · [영문 기술 문서](extension/README.md) · [기술 문서](extension/README.ko.md)

# YouTube AI Translator

> YouTube 자막을 문맥까지 고려해 번역해 주는 Chrome 확장 프로그램입니다.

![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-3%20Flash%20Preview-8E75FF?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?style=flat-square&logo=javascript&logoColor=black)

**YouTube AI Translator**는 YouTube 자막을 읽어 Google **Gemini 3 Flash Preview**로 번역하고, 결과를 패널과 영상 오버레이에 실시간으로 보여줍니다.  
기본 자동 번역처럼 문장만 잘라 옮기는 대신, 앞뒤 흐름을 반영해 더 자연스럽게 읽히는 자막을 목표로 합니다.

## 한눈에 보기

- **🧠 문맥 기반 번역**: 이전 청크의 번역 흐름을 이어 받아 톤과 용어를 더 일관되게 유지합니다.
- **⚡ 실시간 표시**: 번역 진행 상황과 결과가 패널과 영상 오버레이에 바로 반영됩니다.
- **✂️ 재분할 지원**: 조각난 자동 자막을 문장 단위에 가깝게 다시 정리할 수 있습니다.
- **⏯️ 이어받기 모드**: 새로고침이나 중단 이후에도 완료된 청크를 재사용해 이어서 번역합니다.
- **🗂️ 로컬 캐시**: 번역 결과를 최대 100개까지 저장하고 30일 후 자동 정리합니다.
- **📊 사용량 확인**: 팝업에서 오늘 / 최근 30일 기준 토큰 사용량과 예상 비용을 확인할 수 있습니다.

## 빠른 시작

### 1. 확장 프로그램 설치

현재는 Chrome 웹스토어 배포본이 아니라, 개발자 모드에서 로드하는 방식입니다.

1. 저장소를 내려받거나 압축을 풉니다.
2. Chrome에서 `chrome://extensions` 를 엽니다.
3. 우측 상단 `개발자 모드`를 켭니다.
4. `압축해제된 확장 프로그램을 로드합니다`를 눌러 이 저장소의 `extension` 폴더를 선택합니다.

### 2. Gemini API Key 등록

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 API Key를 생성합니다.
2. Chrome 툴바의 확장 프로그램 아이콘을 열어 `YouTube AI Translator`를 클릭합니다.
3. 팝업의 API Key 입력란에 값을 붙여넣고 저장합니다.

> API Key는 브라우저 로컬 스토리지에 난독화되어 저장됩니다.  
> 별도 중계 서버 없이 브라우저에서 Google Gemini API로 직접 요청합니다.

### 3. 번역 시작

1. 자막이 있는 YouTube 영상 페이지를 엽니다.
2. 영상 하단 영역에 나타나는 `📜 스크립트 열기` 버튼으로 자막 패널을 엽니다.
3. 패널 상단의 `AI 번역` 버튼을 눌러 번역을 시작합니다.

## 사용 방법

### 번역 결과 보는 법

- 번역 중에는 진행 상태가 패널에 표시됩니다.
- 완료된 문장은 영상 위 오버레이 자막과 번역 패널에 함께 반영됩니다.
- 오버레이는 드래그로 위치를 옮길 수 있고, 마우스 휠로 글자 크기를 조절할 수 있습니다.
- 오버레이를 더블클릭하면 위치가 초기화됩니다.

### 재분할

자동 생성 자막이 지나치게 잘게 나뉜 경우, 번역 후 `재분할` 버튼으로 더 읽기 쉬운 묶음으로 다시 정리할 수 있습니다.

### 팝업에서 바꿀 수 있는 설정

- **Thinking Level**: `Minimal`, `Low`, `Medium`, `High`
- **언어 설정**: 원본 언어 자동 감지, 번역 언어 선택
- **Resume Mode**: 중단된 번역 이어받기
- **토큰 사용량**: 오늘 / 최근 30일 사용량과 추정 비용 확인
- **캐시 관리**: 항목별 삭제, 전체 삭제

### JSON 내보내기 / 가져오기

- 번역 패널의 `💾` 버튼으로 현재 번역을 JSON으로 저장할 수 있습니다.
- `📁` 버튼으로 기존 JSON을 다시 불러올 수 있습니다.

## 제한 사항

- YouTube 자막 데이터가 있는 영상에서만 동작합니다.
- Google Gemini API 사용량과 응답 상태에 따라 `403`, `429`, `503` 오류가 발생할 수 있습니다.
- Chrome 확장 프로그램 개발자 모드 설치를 전제로 합니다.

## 저장소 구성

이 저장소는 두 층으로 문서를 나눠 두었습니다.

- 이 문서: 일반 사용자를 위한 설치와 사용 안내
- [extension/README.md](extension/README.md): 기본 영문 기술 문서
- [extension/README.ko.md](extension/README.ko.md): 구조, 모듈, 테스트를 설명하는 한국어 기술 문서

## 개발 및 테스트

```bash
npm test
npm run test:coverage
```

루트 `package.json`은 Node 내장 테스트 러너를 사용하며, 주요 유틸과 캐시/재시도/이어받기 로직에 대한 테스트를 포함합니다.

## FAQ

**Q. 자막이 없는 영상도 번역되나요?**  
A. 아니요. YouTube에서 제공하는 자막 데이터가 있어야 합니다.

**Q. 비용은 얼마나 드나요?**  
A. 비용은 Google Gemini API 사용량에 따라 달라집니다. 팝업에서 오늘 / 최근 30일 기준 추정치를 확인할 수 있습니다.

**Q. 번역이 중간에 멈췄어요.**  
A. 네트워크 문제나 API 혼잡, 할당량 제한일 수 있습니다. 버튼이 재시도 상태로 바뀌면 다시 시도해 보세요.

## 연락처

`imxtraa7@gmail.com`
