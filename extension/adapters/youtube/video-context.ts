const TITLE_SUFFIX_PATTERN = /\s*-\s*YouTube\s*$/i;

export function parseYouTubeVideoId(input: string | URL) {
  const url =
    input instanceof URL ? input : new URL(input, 'https://www.youtube.com');

  const queryVideoId = url.searchParams.get('v')?.trim();
  if (queryVideoId) {
    return queryVideoId;
  }

  const pathMatch = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/i);
  return pathMatch?.[1] ?? null;
}

export function getCurrentYouTubeVideoId(locationLike: Location = window.location) {
  return parseYouTubeVideoId(locationLike.href);
}

export function normalizeYouTubeVideoTitle(title: string | null | undefined) {
  return String(title ?? '')
    .replace(TITLE_SUFFIX_PATTERN, '')
    .trim();
}

export function getCurrentYouTubeVideoTitle(root: ParentNode = document) {
  const titleCandidates = [
    root.querySelector('h1.ytd-watch-metadata'),
    root.querySelector('h1.ytd-video-primary-info-renderer'),
    root.querySelector('yt-formatted-string.ytd-watch-metadata'),
  ];

  for (const candidate of titleCandidates) {
    const text =
      candidate && 'innerText' in candidate && typeof candidate.innerText === 'string'
        ? candidate.innerText
        : candidate?.textContent ?? '';
    const normalized = normalizeYouTubeVideoTitle(text);
    if (normalized) {
      return normalized;
    }
  }

  return normalizeYouTubeVideoTitle(document.title) || 'Unknown YouTube video';
}
