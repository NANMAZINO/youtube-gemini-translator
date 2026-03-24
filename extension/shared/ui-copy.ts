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
        '비공식 도구입니다. YouTube 또는 Google과 관련이 없습니다.',
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
      heroUiLanguage: 'UI 언어',
      heroTheme: '테마',
      apiKeyTitle: 'Gemini API 키',
      apiKeyLabel: 'API 키',
      apiKeyPlaceholder: 'API 키를 입력하세요',
      show: '보기',
      hide: '숨기기',
      showApiKey: 'API 키 보기',
      hideApiKey: 'API 키 숨기기',
      saveKey: '키 저장',
      clear: '지우기',
      deleteAction: '삭제',
      apiKeyHintHtml:
        '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>에서 키를 발급하세요.',
      settingsTitle: '설정',
      sourceLanguage: '원본 언어',
      targetLanguage: '대상 언어',
      thinkingLevel: '추론 수준',
      thinkingLevelInfo: '대부분의 번역은 Minimal로도 충분합니다.',
      resumeMode: '미완료 작업 이어서 실행',
      resumeModeInfo:
        '켜면 이전에 저장된 부분 진행 상태를 이어 받아, 끝나지 않은 번역을 처음부터 다시 하지 않고 계속 진행합니다.',
      saveSettings: '설정 저장',
      today: '오늘',
      lastThirtyDays: '30일',
      cost: '예상 비용',
      costInfo:
        '예상 비용입니다. 실제 청구 금액은 Gemini 가격 정책, 반올림, 제공자 측 집계 방식에 따라 달라질 수 있습니다.',
      cache: '캐시',
      clearCache: '캐시 비우기',
      loadingSettings: '번역기 설정을 불러오는 중...',
      enterApiKeyFirst: '먼저 Gemini API 키를 입력하세요.',
      invalidApiKey:
        '아직 올바른 Gemini API 키 형식으로 보이지 않습니다.',
      apiKeySaved: 'API 키를 저장했습니다.',
      apiKeyCleared: 'API 키를 지웠습니다.',
      settingsSaved: '설정을 저장했습니다.',
      failedToSaveApiKey: 'API 키를 저장하지 못했습니다.',
      failedToClearApiKey: 'API 키를 지우지 못했습니다.',
      failedToSaveSettings: '설정을 저장하지 못했습니다.',
      failedToDeleteCacheEntry: '캐시 항목을 삭제하지 못했습니다.',
      failedToClearCache: '캐시를 비우지 못했습니다.',
      deleteCacheConfirm: '이 캐시 번역을 삭제할까요?',
      cachedTranslationDeleted: '캐시된 번역을 삭제했습니다.',
      clearCacheConfirm: '모든 캐시 번역을 삭제할까요?',
      cacheCleared: '캐시를 비웠습니다.',
      failedSections: {
        apiKey: '저장된 API 키',
        translationSettings: '번역 설정',
        usageTotals: '사용량 통계',
        savedBundles: '저장된 자막 번들',
      },
      readySummary: '모든 데이터가 준비되었습니다.',
      partialRefreshSummary(items) {
        return `사용 가능한 데이터는 불러왔지만 ${items.join(' 및 ')} 새로고침에는 실패했습니다.`;
      },
      cacheEmpty: '저장된 자막 번들이 아직 없습니다.',
      cacheCount(count) {
        return `저장된 자막 번들 ${count}개`;
      },
      cacheCountPartial(visibleCount, totalCount) {
        return `저장된 자막 번들 ${totalCount}개 중 ${visibleCount}개 표시 중`;
      },
      cacheUnavailable:
        '저장된 자막 번들을 일시적으로 사용할 수 없습니다.',
      cacheUnavailableDetail(message) {
        return `지금은 저장된 자막 번들을 불러올 수 없습니다. ${message}`;
      },
      cacheStateResume: '이어하기 가능',
      cacheStateRefined: '다듬음',
      cacheStateReady: '준비됨',
      untitledVideo: '제목 없는 영상',
      fallbackVideoTitle: '이 영상',
      savedOn(dateText) {
        return `${dateText} 저장`;
      },
      deleteCachedTranslationFor(title) {
        return `${title}의 캐시 번역 삭제`;
      },
    },
    content: {
      controls: {
        openTranscript: '스크립트 열기',
        openingTranscript: '스크립트 여는 중...',
        translate: '번역',
        translateAgain: '다시 번역',
        refine: '다듬기',
        refined: '다듬음',
        startingTranslation: '시작 중...',
        startingRefine: '다듬는 중...',
        translating: '번역 중...',
        cancel: '취소',
        cancelling: '취소 중...',
        openHint: '시작하려면 스크립트를 여세요.',
        readyHint: '번역할 준비가 되었습니다.',
        runningHint: '번역 중...',
        completedHint: '완료되었습니다.',
        idleHint: '',
      },
      monitor: {
        title: 'YT AI 번역기',
        slice: '조각',
        youtube: 'YouTube',
        task: '작업',
        progress: '진행',
        target: '대상',
        updated: '업데이트',
        open: '열기',
        translate: '번역',
        cancel: '취소',
      },
      surface: {
        title: '',
        export: '내보내기',
        import: '가져오기',
        waiting: '',
        ready: '',
        cachedReady: '캐시됨',
        refinedReady: '다듬음',
        importedReady: '가져옴',
        partialResumeAvailable:
          '부분 캐시가 있습니다. 이어서 실행 모드를 켜거나 JSON을 가져오세요.',
        empty: '',
        overlayPlaceholder: '',
      },
      status: {
        idle: '',
        openingTranscript: '스크립트 여는 중...',
        transcriptReady: '준비됨',
        startingTranslation: '준비 중...',
        startingRefine: '다듬는 중...',
        running: '번역 중...',
        retrying: '재시도 중...',
        completed: '완료',
        failed: '실패',
        cancelled: '취소됨',
      },
      messages: {
        genericActionFailed: '작업을 완료하지 못했습니다.',
        videoIdMissing: '현재 YouTube 영상 ID를 확인할 수 없습니다.',
        extractTranscriptFromPanel:
          'YouTube 패널에서 대본 구간을 추출하는 중...',
        noTranscriptExtracted:
          '현재 페이지에서 대본 구간을 추출하지 못했습니다.',
        startResumeAwareTask: '이어받기 가능한 번역 작업을 시작하는 중...',
        startTranslationTask: '번역 작업을 시작하는 중...',
        noDraftToRefine: '다듬을 번역 초안이 아직 없습니다.',
        extractOriginalForRefine:
          '다듬기를 위해 원본 대본 구간을 추출하는 중...',
        noOriginalForRefine:
          '다듬기를 위한 원본 대본 구간을 추출하지 못했습니다.',
        backgroundTaskStarted:
          '백그라운드 작업이 시작되었습니다. 첫 런타임 이벤트를 기다리는 중...',
        backgroundRefineTaskStarted:
          '백그라운드 다듬기 작업이 시작되었습니다. 첫 런타임 이벤트를 기다리는 중...',
        importingJson:
          '번역 표면에 JSON 자막을 가져오는 중...',
        importedReadyAndCached:
          '가져온 자막이 준비되었고 로컬 캐시에 저장되었습니다.',
        noActiveTaskToCancel: '취소할 활성 작업이 없습니다.',
        requestingCancellation: '활성 작업 취소를 요청하는 중...',
        cancellationRequested:
          '취소를 요청했습니다. 런타임 확인을 기다리는 중...',
        jumpToSegment: '플레이어를 이 번역 구간으로 이동합니다.',
        importJsonTitle: 'JSON 자막 번들을 가져옵니다.',
        toggleTranscript: '스크립트 접기/펼치기',
        translationStatusAria: '번역 상태',
        translatedTranscriptMapAria: '번역된 대본 목록',
        translatedTranscriptListAria: '번역된 대본',
        overlayInteractionTitle:
          '드래그로 이동하고, 휠로 크기를 조절하고, 더블클릭으로 초기화합니다.',
        importLockedVisible:
          '현재 번역이 화면에 보이는 동안에는 가져오기를 사용할 수 없습니다.',
        importWillReplaceHiddenDraft:
          'JSON 자막 번들을 가져옵니다. 이 영상의 숨겨진 저장 초안은 대체됩니다.',
        importIntoSurface:
          '번역 표면으로 JSON 자막 번들을 가져옵니다.',
        translatedSegments(count) {
          return `${count}개 구간`;
        },
        completedSegments(count) {
          return `번역된 구간 ${count}개를 완료했습니다.`;
        },
        completedRefineSegments(count) {
          return `다듬기 결과 ${count}개 구간을 완료했습니다.`;
        },
        resumedFromChunk(completed, total) {
          return `${completed}/${total} 청크부터 이어서 시작했습니다.`;
        },
      },
      errors: {
        ABORTED: '작업이 취소되었습니다.',
        API_KEY_MISSING: 'API 키가 설정되어 있지 않습니다.',
        EMPTY_DRAFT: '다듬기를 시작하려면 번역 초안 구간이 최소 1개 필요합니다.',
        EMPTY_TRANSCRIPT:
          '번역을 시작하려면 대본 구간이 최소 1개 필요합니다.',
        IMPORT_BUNDLE_EMPTY:
          '가져온 JSON은 "start"와 "text"가 있는 자막 행 배열이어야 하며 비어 있으면 안 됩니다.',
        IMPORT_BUNDLE_INVALID_JSON:
          '가져온 JSON은 올바른 JSON 자막 데이터여야 합니다.',
        IMPORT_BUNDLE_INVALID_ROW:
          '가져온 JSON은 "start"와 "text"가 있는 자막 행 배열이어야 하며 비어 있으면 안 됩니다.',
        MODEL_OVERLOADED:
          'Gemini가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도하세요.',
        QUOTA_EXCEEDED:
          'Gemini 사용 한도를 초과했습니다. 요금제 또는 결제를 확인한 뒤 다시 시도하세요.',
        REFINE_FAILED: '다듬기에 실패했습니다.',
        TRANSLATION_FAILED: '번역에 실패했습니다.',
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
