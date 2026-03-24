import type {
  ResolvedUiLocale,
  SourceLanguage,
  TargetLanguage,
  ThemeMode,
  ThinkingLevel,
  UiLocale,
} from './contracts/index.ts';

type PopupFailureSection =
  | 'apiKey'
  | 'translationSettings'
  | 'usageTotals'
  | 'savedBundles';

type UiErrorCode =
  | 'ABORTED'
  | 'API_KEY_MISSING'
  | 'EMPTY_DRAFT'
  | 'EMPTY_TRANSCRIPT'
  | 'IMPORT_BUNDLE_EMPTY'
  | 'IMPORT_BUNDLE_INVALID_JSON'
  | 'IMPORT_BUNDLE_INVALID_ROW'
  | 'MODEL_OVERLOADED'
  | 'QUOTA_EXCEEDED'
  | 'REFINE_FAILED'
  | 'TRANSLATION_FAILED';

interface UiCopyShape {
  common: {
    appName: string;
    brandName: string;
    unofficialToolNotice: string;
    uiLocaleOptions: Record<UiLocale, string>;
    themeModeOptions: Record<ThemeMode, string>;
    sourceLanguageOptions: Record<SourceLanguage, string>;
    targetLanguageOptions: Record<TargetLanguage, string>;
    thinkingLevelOptions: Record<ThinkingLevel, string>;
  };
  popup: {
    heroUiLanguage: string;
    heroTheme: string;
    apiKeyTitle: string;
    apiKeyLabel: string;
    apiKeyPlaceholder: string;
    show: string;
    hide: string;
    showApiKey: string;
    hideApiKey: string;
      saveKey: string;
      clear: string;
      deleteAction: string;
      apiKeyHintHtml: string;
    settingsTitle: string;
    sourceLanguage: string;
    targetLanguage: string;
    thinkingLevel: string;
    thinkingLevelInfo: string;
    resumeMode: string;
    resumeModeInfo: string;
    saveSettings: string;
    usageTitle: string;
    usageInfo: string;
    today: string;
    lastThirtyDays: string;
    cost: string;
    costInfo: string;
    cache: string;
    clearCache: string;
    loadingSettings: string;
    enterApiKeyFirst: string;
    invalidApiKey: string;
      apiKeySaved: string;
      apiKeyCleared: string;
      settingsSaved: string;
      failedToSaveApiKey: string;
      failedToClearApiKey: string;
      failedToSaveSettings: string;
      failedToDeleteCacheEntry: string;
      failedToClearCache: string;
      deleteCacheConfirm: string;
      cachedTranslationDeleted: string;
    clearCacheConfirm: string;
    cacheCleared: string;
    failedSections: Record<PopupFailureSection, string>;
    readySummary: string;
    partialRefreshSummary: (items: string[]) => string;
    cacheEmpty: string;
    cacheCount: (count: number) => string;
    cacheCountPartial: (visibleCount: number, totalCount: number) => string;
    cacheUnavailable: string;
    cacheUnavailableDetail: (message: string) => string;
    cacheStateResume: string;
    cacheStateRefined: string;
    cacheStateReady: string;
    untitledVideo: string;
    fallbackVideoTitle: string;
    savedOn: (dateText: string) => string;
    deleteCachedTranslationFor: (title: string) => string;
  };
  content: {
    controls: {
      openTranscript: string;
      openingTranscript: string;
      translate: string;
      translateAgain: string;
      refine: string;
      refined: string;
      startingTranslation: string;
      startingRefine: string;
      translating: string;
      cancel: string;
      cancelling: string;
      openHint: string;
      readyHint: string;
      runningHint: string;
      completedHint: string;
      idleHint: string;
    };
    monitor: {
      title: string;
      slice: string;
      youtube: string;
      task: string;
      progress: string;
      target: string;
      updated: string;
      open: string;
      translate: string;
      cancel: string;
    };
    surface: {
      title: string;
      export: string;
      import: string;
      waiting: string;
      ready: string;
      cachedReady: string;
      refinedReady: string;
      importedReady: string;
      partialResumeAvailable: string;
      empty: string;
      overlayPlaceholder: string;
    };
    status: {
      idle: string;
      openingTranscript: string;
      transcriptReady: string;
      startingTranslation: string;
      startingRefine: string;
      running: string;
      retrying: string;
      completed: string;
      failed: string;
      cancelled: string;
    };
    messages: {
      genericActionFailed: string;
      videoIdMissing: string;
      extractTranscriptFromPanel: string;
      noTranscriptExtracted: string;
      startResumeAwareTask: string;
      startTranslationTask: string;
      noDraftToRefine: string;
      extractOriginalForRefine: string;
      noOriginalForRefine: string;
      backgroundTaskStarted: string;
      backgroundRefineTaskStarted: string;
      importingJson: string;
      importedReadyAndCached: string;
      noActiveTaskToCancel: string;
      requestingCancellation: string;
      cancellationRequested: string;
      jumpToSegment: string;
      importJsonTitle: string;
      toggleTranscript: string;
      translationStatusAria: string;
      translatedTranscriptMapAria: string;
      translatedTranscriptListAria: string;
      overlayInteractionTitle: string;
      importLockedVisible: string;
      importWillReplaceHiddenDraft: string;
      importIntoSurface: string;
      translatedSegments: (count: number) => string;
      completedSegments: (count: number) => string;
      completedRefineSegments: (count: number) => string;
      resumedFromChunk: (completed: number, total: number) => string;
    };
    errors: Record<UiErrorCode, string>;
  };
}

function buildEnglishCopy(): UiCopyShape {
  return {
    common: {
      appName: 'YouTube AI Translator',
      brandName: 'YouTube AI Translator',
      unofficialToolNotice:
        'Unofficial tool. Not affiliated with YouTube or Google.',
      uiLocaleOptions: {
        auto: 'Auto',
        en: 'English',
        ko: 'Korean',
      },
      themeModeOptions: {
        system: 'System',
        light: 'Light',
        dark: 'Dark',
      },
      sourceLanguageOptions: {
        Auto: 'Auto',
        '한국어': 'Korean',
        English: 'English',
        '日本語': 'Japanese',
      },
      targetLanguageOptions: {
        '한국어': 'Korean',
        English: 'English',
        '日本語': 'Japanese',
      },
      thinkingLevelOptions: {
        minimal: 'Minimal',
        low: 'Low',
        medium: 'Medium',
        high: 'High',
      },
    },
    popup: {
      heroUiLanguage: 'UI language',
      heroTheme: 'Theme',
      apiKeyTitle: 'Gemini API Key',
      apiKeyLabel: 'API key',
      apiKeyPlaceholder: 'Enter your API key',
      show: 'Show',
      hide: 'Hide',
      showApiKey: 'Show API key',
      hideApiKey: 'Hide API key',
      saveKey: 'Save key',
      clear: 'Clear',
      deleteAction: 'Delete',
      apiKeyHintHtml:
        'Create a key in <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.',
      settingsTitle: 'Settings',
      sourceLanguage: 'Source language',
      targetLanguage: 'Target language',
      thinkingLevel: 'Thinking level',
      thinkingLevelInfo: 'Minimal works well for most translations.',
      resumeMode: 'Resume unfinished runs',
      resumeModeInfo:
        'When enabled, the translator reuses saved partial progress and continues an unfinished translation instead of starting over.',
      saveSettings: 'Save settings',
      usageTitle: 'Token usage',
      usageInfo: 'For exact token counts and billing details, check Google AI Studio.',
      today: 'Today',
      lastThirtyDays: '30 Days',
      cost: 'Cost',
      costInfo:
        'Estimated cost only. Actual billed amount may differ based on Gemini pricing, rounding, and provider-side accounting.',
      cache: 'Cache',
      clearCache: 'Clear cache',
      loadingSettings: 'Loading your translator settings...',
      enterApiKeyFirst: 'Enter your Gemini API key first.',
      invalidApiKey: 'That does not look like a valid Gemini API key yet.',
      apiKeySaved: 'API key saved.',
      apiKeyCleared: 'API key cleared.',
      settingsSaved: 'Settings saved.',
      failedToSaveApiKey: 'Failed to save the API key.',
      failedToClearApiKey: 'Failed to clear the API key.',
      failedToSaveSettings: 'Failed to save settings.',
      failedToDeleteCacheEntry: 'Failed to delete the cache entry.',
      failedToClearCache: 'Failed to clear the cache.',
      deleteCacheConfirm: 'Delete this cached translation?',
      cachedTranslationDeleted: 'Cached translation deleted.',
      clearCacheConfirm: 'Clear all cached translations?',
      cacheCleared: 'Cache cleared.',
      failedSections: {
        apiKey: 'your saved API key',
        translationSettings: 'translation settings',
        usageTotals: 'usage totals',
        savedBundles: 'saved subtitle bundles',
      },
      readySummary: 'Everything is ready.',
      partialRefreshSummary(items) {
        if (items.length <= 1) {
          return `Loaded available data, but ${items[0] ?? ''} could not be refreshed.`;
        }

        if (items.length === 2) {
          return `Loaded available data, but ${items[0]} and ${items[1]} could not be refreshed.`;
        }

        return `Loaded available data, but ${items.slice(0, -1).join(', ')}, and ${items.at(-1)} could not be refreshed.`;
      },
      cacheEmpty: 'No saved subtitle bundles yet.',
      cacheCount(count) {
        return `${count} saved subtitle bundle${count === 1 ? '' : 's'}.`;
      },
      cacheCountPartial(visibleCount, totalCount) {
        return `Showing ${visibleCount} of ${totalCount} saved subtitle bundles.`;
      },
      cacheUnavailable:
        'Saved subtitle bundles are temporarily unavailable.',
      cacheUnavailableDetail(message) {
        return `Could not load saved subtitle bundles right now. ${message}`;
      },
      cacheStateResume: 'Resume available',
      cacheStateRefined: 'Refined',
      cacheStateReady: 'Ready',
      untitledVideo: 'Untitled video',
      fallbackVideoTitle: 'this video',
      savedOn(dateText) {
        return `Saved ${dateText}`;
      },
      deleteCachedTranslationFor(title) {
        return `Delete cached translation for ${title}`;
      },
    },
    content: {
      controls: {
        openTranscript: 'Open Transcript',
        openingTranscript: 'Opening transcript...',
        translate: 'Translate',
        translateAgain: 'Translate Again',
        refine: 'Refine',
        refined: 'Refined',
        startingTranslation: 'Starting...',
        startingRefine: 'Refining...',
        translating: 'Translating...',
        cancel: 'Cancel',
        cancelling: 'Cancelling...',
        openHint: 'Open transcript to begin.',
        readyHint: 'Ready to translate.',
        runningHint: 'Translating...',
        completedHint: 'Done.',
        idleHint: '',
      },
      monitor: {
        title: 'YT AI Translator',
        slice: 'Slice',
        youtube: 'YouTube',
        task: 'Task',
        progress: 'Progress',
        target: 'Target',
        updated: 'Updated',
        open: 'Open',
        translate: 'Translate',
        cancel: 'Cancel',
      },
      surface: {
        title: '',
        export: 'Export',
        import: 'Import',
        waiting: '',
        ready: '',
        cachedReady: 'Cached',
        refinedReady: 'Refined',
        importedReady: 'Imported',
        partialResumeAvailable:
          'Partial cache available. Enable Resume mode or import JSON.',
        empty: '',
        overlayPlaceholder: '',
      },
      status: {
        idle: '',
        openingTranscript: 'Opening transcript...',
        transcriptReady: 'Ready',
        startingTranslation: 'Preparing...',
        startingRefine: 'Refining...',
        running: 'Translating...',
        retrying: 'Retrying...',
        completed: 'Done',
        failed: 'Failed',
        cancelled: 'Cancelled',
      },
      messages: {
        genericActionFailed: 'The action could not be completed.',
        videoIdMissing: 'Could not determine the current YouTube video id.',
        extractTranscriptFromPanel:
          'Extracting transcript segments from the YouTube panel...',
        noTranscriptExtracted:
          'No transcript segments were extracted from the current page.',
        startResumeAwareTask: 'Starting a resume-aware translation task...',
        startTranslationTask: 'Starting a translation task...',
        noDraftToRefine: 'There is no translated draft to refine yet.',
        extractOriginalForRefine:
          'Extracting original transcript segments for refine...',
        noOriginalForRefine:
          'No original transcript segments were extracted for refine.',
        backgroundTaskStarted:
          'Background task started. Waiting for the first runtime event...',
        backgroundRefineTaskStarted:
          'Background refine task started. Waiting for the first runtime event...',
        importingJson:
          'Importing JSON subtitles into the translation surface...',
        importedReadyAndCached:
          'Imported subtitles are ready and cached locally.',
        noActiveTaskToCancel: 'There is no active task to cancel.',
        requestingCancellation:
          'Requesting cancellation for the active task...',
        cancellationRequested:
          'Cancellation requested. Waiting for runtime confirmation...',
        jumpToSegment: 'Jump the player to this translated segment.',
        importJsonTitle: 'Import a JSON subtitle bundle.',
        toggleTranscript: 'Toggle transcript',
        translationStatusAria: 'Translation status',
        translatedTranscriptMapAria: 'Translated transcript map',
        translatedTranscriptListAria: 'Translated transcript',
        overlayInteractionTitle:
          'Drag to move, wheel to resize, double-click to reset.',
        importLockedVisible:
          'Import becomes available again when the current translation is no longer on screen.',
        importWillReplaceHiddenDraft:
          'Import a JSON subtitle bundle. Any hidden saved draft for this video will be replaced.',
        importIntoSurface:
          'Import a JSON subtitle bundle into the translation surface.',
        translatedSegments(count) {
          return `${count} segments`;
        },
        completedSegments(count) {
          return `Completed ${count} translated segments.`;
        },
        completedRefineSegments(count) {
          return `Completed refine output with ${count} segments.`;
        },
        resumedFromChunk(completed, total) {
          return `Resumed from chunk ${completed}/${total}.`;
        },
      },
      errors: {
        ABORTED: 'Task cancelled.',
        API_KEY_MISSING: 'API key is not set.',
        EMPTY_DRAFT: 'Refine start requires at least one translated draft segment.',
        EMPTY_TRANSCRIPT:
          'Translation start requires at least one transcript segment.',
        IMPORT_BUNDLE_EMPTY:
          'Imported JSON must be a non-empty array of caption rows with "start" and "text".',
        IMPORT_BUNDLE_INVALID_JSON:
          'Imported JSON must be valid JSON subtitle data.',
        IMPORT_BUNDLE_INVALID_ROW:
          'Imported JSON must be a non-empty array of caption rows with "start" and "text".',
        MODEL_OVERLOADED:
          'Gemini is temporarily overloaded. Please try again in a moment.',
        QUOTA_EXCEEDED:
          'Gemini quota was exceeded. Check your plan or billing and try again later.',
        REFINE_FAILED: 'Refine failed.',
        TRANSLATION_FAILED: 'Translation failed.',
      },
    },
  };
}

function buildKoreanCopy(): UiCopyShape {
  return {
    common: {
      appName: 'YouTube AI Translator',
      brandName: 'YouTube AI Translator',
      unofficialToolNotice:
        'YouTube나 Google과 무관한 비공식 도구입니다.',
      uiLocaleOptions: {
        auto: '자동',
        en: '영어',
        ko: '한국어',
      },
      themeModeOptions: {
        system: '시스템',
        light: '라이트',
        dark: '다크',
      },
      sourceLanguageOptions: {
        Auto: '자동',
        '한국어': '한국어',
        English: '영어',
        '日本語': '일본어',
      },
      targetLanguageOptions: {
        '한국어': '한국어',
        English: '영어',
        '日本語': '일본어',
      },
      thinkingLevelOptions: {
        minimal: 'Minimal',
        low: 'Low',
        medium: 'Medium',
        high: 'High',
      },
    },
    popup: {
      heroUiLanguage: '인터페이스 언어',
      heroTheme: '테마',
      apiKeyTitle: 'Gemini API 키',
      apiKeyLabel: 'API 키',
      apiKeyPlaceholder: 'API 키를 입력해 주세요',
      show: '보기',
      hide: '숨기기',
      showApiKey: 'API 키 보기',
      hideApiKey: 'API 키 숨기기',
      saveKey: '키 저장',
      clear: '지우기',
      deleteAction: '삭제',
      apiKeyHintHtml:
        '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>에서 API 키를 무료로 발급받을 수 있습니다.',
      settingsTitle: '설정',
      sourceLanguage: '원본 언어',
      targetLanguage: '대상 언어',
      thinkingLevel: 'AI 추론 수준',
      thinkingLevelInfo: '일반적인 영상은 Minimal 수준으로도 충분히 매끄럽게 번역됩니다.',
      resumeMode: '중단된 번역 이어서 하기',
      resumeModeInfo:
        '이 옵션을 켜면 중간에 멈춘 번역을 처음부터 다시 시작하지 않고, 멈춘 부분부터 이어서 진행합니다.',
      saveSettings: '변경 내용 저장',
      usageTitle: '토큰 소모량',
      usageInfo: '정확한 수치는 Google AI Studio에서 확인해 주세요.',
      today: '오늘',
      lastThirtyDays: '최근 30일',
      cost: '예상 비용',
      costInfo:
        '어디까지나 예상 비용일 뿐입니다. 실제 청구 금액은 Gemini의 가격 정책이나 환율 등에 따라 다를 수 있습니다.',
      cache: '보관함',
      clearCache: '비우기',
      loadingSettings: '번역기 설정 불러오는 중...',
      enterApiKeyFirst: '기능을 사용하려면 먼저 Gemini API 키를 입력해 주세요.',
      invalidApiKey:
        '입력하신 정보가 올바른 Gemini API 키 형식이 아닌 것 같습니다.',
      apiKeySaved: 'API 키가 저장되었습니다.',
      apiKeyCleared: 'API 키가 삭제되었습니다.',
      settingsSaved: '설정이 저장되었습니다.',
      failedToSaveApiKey: 'API 키 서식 저장 중 문제가 발생했습니다.',
      failedToClearApiKey: 'API 키를 삭제하는 데 실패했습니다.',
      failedToSaveSettings: '설정 저장 중 문제가 발생했습니다.',
      failedToDeleteCacheEntry: '번역 기록을 삭제하지 못했습니다.',
      failedToClearCache: '번역 보관함을 비우지 못했습니다.',
      deleteCacheConfirm: '저장된 번역 데이터를 정말 삭제할까요?',
      cachedTranslationDeleted: '저장된 번역을 삭제했습니다.',
      clearCacheConfirm: '보관된 모든 번역 데이터를 지울까요?',
      cacheCleared: '번역 보관함을 비웠습니다.',
      failedSections: {
        apiKey: 'API 키',
        translationSettings: '번역 설정',
        usageTotals: '사용량 통계',
        savedBundles: '저장된 번역 데이터',
      },
      readySummary: '모든 준비가 끝났습니다.',
      partialRefreshSummary(items) {
        return `기존 데이터는 불러왔지만, ${items.join(' 및 ')} 정보는 최신화하지 못했습니다.`;
      },
      cacheEmpty: '아직 보관된 번역 데이터가 없어요.',
      cacheCount(count) {
        return `보관된 번역 ${count}개`;
      },
      cacheCountPartial(visibleCount, totalCount) {
        return `전체 ${totalCount}개 중 ${visibleCount}개의 번역 기록을 표시하고 있습니다.`;
      },
      cacheUnavailable:
        '저장된 번역 데이터를 일시적으로 불러올 수 없습니다.',
      cacheUnavailableDetail(message) {
        return `지금은 번역 기록을 불러올 수 없습니다. (${message})`;
      },
      cacheStateResume: '이어서 번역 가능',
      cacheStateRefined: '다듬기 완료',
      cacheStateReady: '준비 완료',
      untitledVideo: '제목 없는 영상',
      fallbackVideoTitle: '이 영상',
      savedOn(dateText) {
        return `${dateText}에 저장됨`;
      },
      deleteCachedTranslationFor(title) {
        return `${title}의 캐시 번역 삭제`;
      },
    },
    content: {
      controls: {
        openTranscript: '스크립트 열기',
        openingTranscript: '자막 스크립트 불러오는 중...',
        translate: '번역 시작',
        translateAgain: '다시 번역',
        refine: '번역 재분할',
        refined: '다듬기 완료',
        startingTranslation: '번역 준비 중...',
        startingRefine: '문맥 짚어보는 중...',
        translating: '열심히 번역 중...',
        cancel: '취소',
        cancelling: '취소하는 중...',
        openHint: '글로벌 자막 스크립트를 열면 번역을 시작할 수 있습니다.',
        readyHint: '번역 요청 버튼을 눌러주세요.',
        runningHint: '번역이 진행 중입니다...',
        completedHint: '번역이 완료되었습니다.',
        idleHint: '',
      },
      monitor: {
        title: 'YT AI 번역기',
        slice: '구간',
        youtube: 'YouTube',
        task: '작업',
        progress: '진행도',
        target: '대상',
        updated: '마지막 업데이트',
        open: '열기',
        translate: '번역',
        cancel: '취소',
      },
      surface: {
        title: '',
        export: '내보내기',
        import: '불러오기',
        waiting: '',
        ready: '',
        cachedReady: '저장됨',
        refinedReady: '다듬어짐',
        importedReady: '불러옴',
        partialResumeAvailable:
          '이전에 번역하다 만 기록이 있어요. [이어서 번역하기] 모드를 켜거나 백업해둔 JSON 파일을 불러와주세요.',
        empty: '',
        overlayPlaceholder: '',
      },
      status: {
        idle: '',
        openingTranscript: '스크립트 불러오는 중...',
        transcriptReady: '준비 완료',
        startingTranslation: '번역 시작 데이터 수집 중...',
        startingRefine: '다듬을 준비 중...',
        running: '번역 중...',
        retrying: '잠시 후 다시 시도합니다...',
        completed: '작업 완료',
        failed: '실패함',
        cancelled: '취소됨',
      },
      messages: {
        genericActionFailed: '작업 처리 중 문제가 발생했습니다.',
        videoIdMissing: '현재 재생 중인 영상 ID를 확인할 수 없습니다.',
        extractTranscriptFromPanel:
          'YouTube에서 자막 구분을 추출하고 있습니다...',
        noTranscriptExtracted:
          '이 영상에는 추출할 수 있는 자막 정보가 없습니다.',
        startResumeAwareTask: '멈췄던 부분부터 번역 작업을 이어갑니다...',
        startTranslationTask: '새로운 번역 작업을 시작합니다...',
        noDraftToRefine: '다듬기 작업을 진행할 초안 번역이 아직 없습니다.',
        extractOriginalForRefine:
          '다듬기를 위해 원문을 살펴보고 있습니다...',
        noOriginalForRefine:
          '다듬기 작업의 기준이 될 원본 자막을 찾지 못했습니다.',
        backgroundTaskStarted:
          '백그라운드에서 작업을 시작했습니다. 서버 응답을 기다리는 중...',
        backgroundRefineTaskStarted:
          '백그라운드에서 다듬기 작업을 시작했습니다. 서버 응답을 기다리는 중...',
        importingJson:
          '백업해둔 자막 데이터를 화면에 복원 중입니다...',
        importedReadyAndCached:
          '성공적으로 자막 데이터를 불러왔습니다. 로컬 기기에도 백업해두었어요.',
        noActiveTaskToCancel: '현재 진행 중인 취소 가능한 작업이 없습니다.',
        requestingCancellation: '작업 취소 명령을 보내는 중...',
        cancellationRequested:
          '취소를 백그라운드에 요청했습니다. 정리될 때까지 잠시만 기다려주세요...',
        jumpToSegment: '플레이어를 이 자막의 시간대로 이동시킵니다.',
        importJsonTitle: '자막 백업 파일 (JSON) 불러오기',
        toggleTranscript: '번역된 스크립트 접기/펼치기',
        translationStatusAria: '현재 번역 상태',
        translatedTranscriptMapAria: '전체 번역된 대본 목록',
        translatedTranscriptListAria: '번역 대본 읽기',
        overlayInteractionTitle:
          '드래그하여 자유롭게 이동, 스크롤 휠로 크기 조절, 더블 클릭하면 제자리로 돌아옵니다.',
        importLockedVisible:
          '화면에 번역 결과가 표시 중일 때는 불러오기 기능을 사용할 수 없어요.',
        importWillReplaceHiddenDraft:
          '백업 파일을 불러오기 전 주의: 이 영상에 자동 저장되어 있던 번역 보관 데이터는 모두 덮어씌워집니다.',
        importIntoSurface:
          '화면에 백업해둔 자막 데이터를 다시 깔아줍니다.',
        translatedSegments(count) {
          return `번역된 구간 ${count}개`;
        },
        completedSegments(count) {
          return `총 ${count}개의 구간 번역을 완료했습니다.`;
        },
        completedRefineSegments(count) {
          return `${count}개 구간의 문맥 다듬기를 끝마쳤습니다.`;
        },
        resumedFromChunk(completed, total) {
          return `전체 ${total}조각 중 ${completed}번째 조각부터 이어서 번역을 재개합니다.`;
        },
      },
      errors: {
        ABORTED: '작업이 사용자에 의해 취소되었습니다.',
        API_KEY_MISSING: '이 기능을 위해 먼저 Gemini API 키를 저장해 주세요.',
        EMPTY_DRAFT: '다듬기 기능을 실행하려면 번역된 구간이 최소 1개 이상 필요합니다.',
        EMPTY_TRANSCRIPT:
          '영상에서 캡션(자막)을 찾을 수 없어서 번역을 시작할 수 없어요.',
        IMPORT_BUNDLE_EMPTY:
          '가져온 JSON 파일에 분석할 수 있는 자막 텍스트 정보가 없어요.',
        IMPORT_BUNDLE_INVALID_JSON:
          '가져온 JSON 파일이 손상되었거나 올바른 자막 형식이 아닙니다.',
        IMPORT_BUNDLE_INVALID_ROW:
          '가져온 JSON 파일 내부 항목의 필수 데이터(시작 시간, 내용 등)가 부족합니다.',
        MODEL_OVERLOADED:
          '현재 Gemini API에 요청이 많이 몰려 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.',
        QUOTA_EXCEEDED:
          'Gemini API 무료 사용 한도를 초과했습니다. 사용량이나 결제 상태를 확인해 주세요.',
        REFINE_FAILED: '문맥 다듬기 작업 중 오류가 발생했습니다.',
        TRANSLATION_FAILED: '번역 처리 중 문제가 발생했습니다.',
      },
    },
  };
}

const UI_COPY = {
  en: buildEnglishCopy(),
  ko: buildKoreanCopy(),
} as const satisfies Record<ResolvedUiLocale, UiCopyShape>;

export type UiCopy = (typeof UI_COPY)[ResolvedUiLocale];
export type ContentUiLabels = UiCopy['content'];

export function getUiCopy(locale: ResolvedUiLocale) {
  return UI_COPY[locale];
}

export function getContentUiLabels(locale: ResolvedUiLocale) {
  return getUiCopy(locale).content;
}

export function getLocalizedUiErrorMessage(
  locale: ResolvedUiLocale,
  code: string | null | undefined,
  fallbackMessage: string,
) {
  if (!code) {
    return fallbackMessage;
  }

  return getUiCopy(locale).content.errors[code as UiErrorCode] ?? fallbackMessage;
}
