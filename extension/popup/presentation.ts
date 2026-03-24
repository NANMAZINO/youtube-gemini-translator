import type { CacheMetadata } from '../shared/contracts/index.ts';
import type { UiCopy } from '../shared/ui-copy.ts';

export function getApiKeyToggleState(
  isVisible: boolean,
  copy: UiCopy['popup'],
) {
  return {
    text: isVisible ? copy.hide : copy.show,
    ariaLabel: isVisible ? copy.hideApiKey : copy.showApiKey,
    ariaPressed: isVisible ? 'true' : 'false',
  } as const;
}

export function summarizeRefreshFailures(
  failedSections: string[],
  copy: UiCopy['popup'],
) {
  if (failedSections.length === 0) {
    return {
      message: copy.readySummary,
      type: 'success',
    } as const;
  }

  return {
    message: copy.partialRefreshSummary(failedSections),
    type: 'error',
  } as const;
}

export function summarizeCacheList(
  totalCount: number,
  visibleCount: number,
  copy: UiCopy['popup'],
) {
  if (totalCount === 0) {
    return copy.cacheEmpty;
  }

  if (visibleCount < totalCount) {
    return copy.cacheCountPartial(visibleCount, totalCount);
  }

  return copy.cacheCount(totalCount);
}

export function describeCacheEntry(
  item: CacheMetadata,
  copy: UiCopy,
  locale?: string,
) {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  });
  const stateLabel = item.isPartial
    ? copy.popup.cacheStateResume
    : item.isRefined
      ? copy.popup.cacheStateRefined
      : copy.popup.cacheStateReady;
  const title = item.title.trim() || copy.popup.fallbackVideoTitle;
  const sourceLabel =
    copy.common.sourceLanguageOptions[
      item.sourceLang as keyof typeof copy.common.sourceLanguageOptions
    ] ?? item.sourceLang;
  const targetLabel =
    copy.common.targetLanguageOptions[
      item.targetLang as keyof typeof copy.common.targetLanguageOptions
    ] ?? item.targetLang;

  return {
    stateLabel,
    languageLabel: `${sourceLabel} -> ${targetLabel}`,
    savedLabel: copy.popup.savedOn(formatter.format(new Date(item.timestamp))),
    deleteLabel: copy.popup.deleteCachedTranslationFor(title),
  } as const;
}
