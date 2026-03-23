<p align="right">
  <a href="transcript-regression-checklist.md">English</a>
</p>

# ✅ Transcript 회귀 체크리스트

> YouTube DOM 민감 변경에 대한 수동 검증 체크리스트.

---

## Fixture 기준점

런타임 어댑터가 계속 지원해야 하는 구/신 YouTube transcript 구조의 의도적으로 작은 스냅샷입니다.

| Fixture | 경로 |
|---|---|
| 클래식 transcript DOM | `extension/adapters/youtube/__fixtures__/transcript-legacy.html` |
| 모던 transcript DOM | `extension/adapters/youtube/__fixtures__/transcript-modern.html` |

**자동화된 회귀 테스트:**

| 테스트 | 경로 |
|---|---|
| DOM fixture 테스트 | `extension/adapters/youtube/transcript-dom.fixture.test.js` |
| Extractor 테스트 | `extension/adapters/youtube/transcript-extractor.test.js` |
| Opener 테스트 | `extension/adapters/youtube/transcript-opener.test.js` |

> [!NOTE]
> 수동 브라우저 체크리스트 전에 항상 `npm test`를 먼저 실행하세요. 자동 테스트는 통과했는데 수동 체크가 실패하면 fixture 업데이트가 필요할 수 있습니다.

---

## 수동 브라우저 체크리스트

`npm run build` 후 `dist/`에서 실제 Chrome 로드를 사용합니다.

### 1. Transcript 진입 & 패널 상태

- [ ] 자막이 사용 가능한 시청 페이지에 `Open Transcript`가 표시됨
- [ ] 패널이 아직 **마운트되지 않은** 상태에서 transcript 열기가 동작함
- [ ] 패널이 이미 마운트되었지만 **숨겨진** 상태에서 transcript 열기가 동작함
- [ ] **속성 업데이트**만으로 구동되는 transcript 가시성 변경이 커스텀 액션을 고립시키지 않음

### 2. Transcript 파싱

- [ ] 구 `ytd-transcript-segment-renderer` 페이지에서 타임스탬프와 텍스트가 순서대로 추출됨
- [ ] 신 `transcript-segment-view-model` 페이지에서 타임스탬프와 텍스트가 순서대로 추출됨
- [ ] 번역된 표면이 네이티브 YouTube transcript **옆에** 마운트된 상태를 유지함 (대체하지 않음)

### 3. 번역 & 복구

- [ ] **Translate**가 transcript 패널에서 새 실행을 시작함
- [ ] **Resume**가 새로고침이나 내비게이션 중단 뒤 부분 캐시에서 이어서 실행함
- [ ] **Refine**이 행을 잃지 않고 현재 번역 번들에 대해 실행함
- [ ] **Import**가 번역된 행을 올바르게 교체하거나 복원함
- [ ] **Export**가 다시 가져올 수 있는 번들을 다운로드함

### 4. Popup / 캐시 통합

- [ ] Popup 설정이 초기화 없이 기존 저장 값을 로드함
- [ ] Popup 캐시 **삭제**가 해당 동영상에 대한 현재 YouTube 페이지 표면을 지움
- [ ] Popup 캐시 **전체 삭제**가 활성 YouTube 탭의 모든 페이지 내 번역 상태를 제거함

### 5. 오버레이 동작

- [ ] 오버레이 텍스트가 새 번역 실행 후 재생과 동기화 상태를 유지함
- [ ] 오버레이 **숨김/표시**가 오래된 큐를 되살리지 않으면서 리스너를 해제하고 복원함
- [ ] **드래그**, **휠 크기 조절**, **더블클릭 초기화**가 활성 오버레이에서 여전히 동작함

---

> [!TIP]
> 이 체크리스트를 PR 코멘트에 복사해서 코드 리뷰 시 항목별로 체크하세요.
