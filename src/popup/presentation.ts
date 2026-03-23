import type { CacheMetadata } from '../shared/contracts/index.ts';

export function getApiKeyToggleState(isVisible: boolean) {
  return {
    text: isVisible ? 'Hide' : 'Show',
    ariaLabel: isVisible ? 'Hide API key' : 'Show API key',
    ariaPressed: isVisible ? 'true' : 'false',
  } as const;
}

function formatList(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? '';
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

export function summarizeRefreshFailures(failedSections: string[]) {
  if (failedSections.length === 0) {
    return {
      message: 'Everything is ready.',
      type: 'success',
    } as const;
  }

  return {
    message: `Loaded available data, but ${formatList(failedSections)} could not be refreshed.`,
    type: 'error',
  } as const;
}

export function summarizeCacheList(totalCount: number, visibleCount: number) {
  if (totalCount === 0) {
    return 'No saved subtitle bundles yet.';
  }

  if (visibleCount < totalCount) {
    return `Showing ${visibleCount} of ${totalCount} saved subtitle bundles.`;
  }

  return `${totalCount} saved subtitle bundle${totalCount === 1 ? '' : 's'}.`;
}

export function describeCacheEntry(item: CacheMetadata, locale?: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  });
  const stateLabel = item.isPartial
    ? 'Resume available'
    : item.isRefined
      ? 'Refined'
      : 'Ready';
  const title = item.title.trim() || 'this video';

  return {
    stateLabel,
    languageLabel: `${item.sourceLang} -> ${item.targetLang}`,
    savedLabel: `Saved ${formatter.format(new Date(item.timestamp))}`,
    deleteLabel: `Delete cached translation for ${title}`,
  } as const;
}
