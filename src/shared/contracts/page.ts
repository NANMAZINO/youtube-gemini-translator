export interface CacheDeletePageMessage {
  kind: 'rebuild.page';
  type: 'cache.delete';
  payload: {
    cacheKey: string;
  };
}

export interface CacheClearPageMessage {
  kind: 'rebuild.page';
  type: 'cache.clear';
}

export type RebuildPageMessage =
  | CacheDeletePageMessage
  | CacheClearPageMessage;
