export interface CacheDeletePageMessage {
  kind: 'runtime.page';
  type: 'cache.delete';
  payload: {
    cacheKey: string;
  };
}

export interface CacheClearPageMessage {
  kind: 'runtime.page';
  type: 'cache.clear';
}

export type RuntimePageMessage =
  | CacheDeletePageMessage
  | CacheClearPageMessage;
