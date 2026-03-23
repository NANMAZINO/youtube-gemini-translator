import type { RebuildPageMessage } from '../shared/contracts/page.ts';

export function shouldResetSurfaceForPageMessage(
  message: RebuildPageMessage,
  currentVideoId: string | null,
) {
  switch (message.type) {
    case 'cache.clear':
      return true;

    case 'cache.delete':
      return (
        !!currentVideoId &&
        message.payload.cacheKey.startsWith(`${currentVideoId}_`)
      );
  }
}
