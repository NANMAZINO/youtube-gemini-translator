# YouTube AI Translator

Gemini 3 Flash 기반 YouTube 자막 전체 문맥 번역 Chrome 확장 프로그램

## 설치 방법

1. 이 저장소를 다운로드 또는 클론합니다.
2. Chrome 브라우저에서 `chrome://extensions`에 접속합니다.
3. 우측 상단의 **개발자 모드**를 활성화합니다.
4. **압축해제된 확장 프로그램을 로드합니다**를 클릭하여 `extension` 폴더를 선택합니다.

## 사용 방법

기타 설정들은 확장 프로그램 아이콘을(팝업)을 클릭하여 설정할 수 있습니다.

### 1. API Key 설정

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 API Key를 발급받습니다.
2. 확장 프로그램 아이콘(팝업)을 클릭하여 API Key를 입력하고 저장합니다.

### 2. 번역 실행

1. YouTube 영상 페이지에 접속합니다.
2. 영상 하단의 **...더보기**(영상 설명)를 클릭한 후, 하단의 **스크립트 표시** 버튼을 클릭하여 자막 패널을 엽니다.
3. 자막 패널 상단에 나타나는 **🤖 AI 번역** 버튼을 클릭합니다.
4. 번역 결과는 영상 위에 오버레이로 실시간 표시됩니다.

## 제한사항

- 자막(Script) 데이터가 제공되지 않는 영상은 번역이 불가능합니다.
- 한 번에 하나의 번역만 가능합니다.

## 파일 구조

```
extension/
├── manifest.json      # 확장 프로그램 설정 (V3)
├── background.js      # Gemini API 통신 및 메시지 라우팅
├── content.js         # 모듈 시스템 초기화 및 로더
├── content.css        # 기본 콘텐츠 스타일
├── lib/               # 공통 라이브러리 모듈
│   └── gemini.js      # Gemini 3 Flash API 통신 엔진
├── content/           # 기능별 콘텐츠 스크립트
│   ├── main.js        # 메인 컨트롤러 및 이벤트 리스너
│   ├── ui.js          # Shadow DOM 기반 UI 생성 및 렌더링
│   ├── captions.js    # 자막 추출 및 전처리 로직
│   ├── cache.js       # IndexedDB 캐시 레이어
│   └── utils.js       # 유틸리티 함수
└── popup/             # 확장 프로그램 팝업 UI
    ├── popup.html
    ├── popup.js
    └── popup.css
```
