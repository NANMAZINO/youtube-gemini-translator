import type {
  RuntimeEvent,
  RuntimeEventMap,
  RuntimeEventType,
} from '../shared/contracts/index.ts';

export type RuntimeEventSender = (
  tabId: number,
  event: RuntimeEvent,
) => Promise<unknown>;

interface EmitRuntimeEventOptions<T extends RuntimeEventType> {
  tabId?: number | null;
  type: T;
  payload: RuntimeEventMap[T];
}

export function createRuntimeEvent<T extends RuntimeEventType>(
  type: T,
  payload: RuntimeEventMap[T],
): RuntimeEvent<T> {
  return {
    kind: 'rebuild.event',
    type,
    payload,
  };
}

export async function emitRuntimeEvent<T extends RuntimeEventType>(
  tabId: number | undefined,
  event: RuntimeEvent<T>,
  sendMessage?: RuntimeEventSender,
): Promise<boolean>;
export async function emitRuntimeEvent<T extends RuntimeEventType>(
  options: EmitRuntimeEventOptions<T>,
  sendMessage?: RuntimeEventSender,
): Promise<boolean>;
export async function emitRuntimeEvent<T extends RuntimeEventType>(
  tabIdOrOptions: number | undefined | EmitRuntimeEventOptions<T>,
  eventOrSendMessage?: RuntimeEvent<T> | RuntimeEventSender,
  maybeSendMessage?: RuntimeEventSender,
) {
  const usesOptionsObject =
    typeof tabIdOrOptions === 'object' && tabIdOrOptions !== null;
  const resolvedTabId =
    usesOptionsObject
      ? tabIdOrOptions.tabId ?? undefined
      : tabIdOrOptions;
  const resolvedEvent =
    usesOptionsObject
      ? createRuntimeEvent(tabIdOrOptions.type, tabIdOrOptions.payload)
      : (eventOrSendMessage as RuntimeEvent<T>);
  const sendMessage =
    usesOptionsObject
      ? (typeof eventOrSendMessage === 'function'
          ? eventOrSendMessage
          : maybeSendMessage)
      : (maybeSendMessage ?? (typeof eventOrSendMessage === 'function' ? eventOrSendMessage : undefined));
  const activeSender: RuntimeEventSender =
    sendMessage ??
    ((targetTabId, message) => chrome.tabs.sendMessage(targetTabId, message));

  if (typeof resolvedTabId !== 'number') {
    return false;
  }

  try {
    await activeSender(resolvedTabId, resolvedEvent);
    return true;
  } catch {
    return false;
  }
}
