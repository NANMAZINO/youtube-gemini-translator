# YouTube AI Translator 레거시 런타임 참고 문서

> TypeScript 이전 `extension/` 구현을 위한 보관용 기술 참고 문서입니다.  
> 현재 런타임, 설치 방법, 메인 아키텍처는 [루트 README](../README.md), [한국어 README](../README.ko.md), 그리고 [../docs/rebuild/](../docs/rebuild/architecture.md) 아래 마이그레이션 문서를 기준으로 봐주세요.

> [!NOTE]
> 이제 `src/`가 기본 확장 런타임이며 결과물은 `dist/`에 빌드됩니다. 이 `extension/` 트리는 일반적인 개발이나 설치에서 더 이상 로드 대상이 아니며, 남아 있는 중복 구현을 정리하는 동안 회귀 비교와 참고 용도로만 유지합니다.

![Docs](https://img.shields.io/badge/Docs-Legacy%20Reference-0A7EA4?style=flat-square)
![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-Node%20Built--in-5FA04E?style=flat-square&logo=node.js&logoColor=white)

## 상태

- 메인 런타임: `src/`
- 메인 빌드 결과물: `dist/`
- 레거시 참고 경로: `extension/`
- 권장 기본 검증 명령: `npm run check`

## 레거시 핵심 기능

- 자막 청크 간 문맥 주입
- 패널 및 오버레이 스트리밍 업데이트
- 부분 저장 기반 Resume Mode
- 작업 취소와 service worker keep-alive
- 로컬 캐시 저장과 토큰 사용량 추적

## 레거시 파일 구조

```text
extension/
├── manifest.json
├── README.md
├── README.ko.md
├── background/
├── content/
├── core/
├── infrastructure/
├── lib/
└── popup/
```

## 이 폴더를 볼 때

- 정리 작업 중 레거시와 현재 동작을 비교해야 할 때
- 예전 UI나 저장 경로가 어떻게 동작했는지 추적해야 할 때
- `extension/`에만 남아 있는 중복 로직을 제거하려고 할 때

현재 확장 프로그램을 빌드, 테스트, 로드하려면 `src/`, `dist/`, 루트 README부터 보는 것이 맞습니다.
