import type {
  RuntimeCommand,
  RuntimeCommandResult,
} from '../shared/contracts/index.ts';
import { createFailure, createSuccess, isRebuildCommand } from '../shared/messaging.ts';
import { REBUILD_META } from '../shared/rebuild-meta.ts';
import {
  clearCacheRecords,
  deleteCacheRecord,
  listCacheMetadata,
  readCacheRecord,
  saveCacheRecord,
} from '../adapters/storage/cache-storage.ts';
import { getSettings, saveSettings } from '../adapters/storage/settings-storage.ts';
import { getUsageSummary } from '../adapters/storage/usage-storage.ts';
import {
  BackgroundCommandError,
  createBackgroundService,
} from './service.ts';

const backgroundService = createBackgroundService();

async function handleCommand(
  command: RuntimeCommand,
  tabId?: number | null,
): Promise<RuntimeCommandResult> {
  switch (command.type) {
    case 'settings.get':
      return createSuccess(command.type, await getSettings());

    case 'settings.save':
      return createSuccess(command.type, await saveSettings(command.payload));

    case 'cache.list':
      return createSuccess(command.type, await listCacheMetadata());

    case 'cache.get':
      return createSuccess(
        command.type,
        await readCacheRecord(
          command.payload.videoId,
          command.payload.targetLang,
        ),
      );

    case 'cache.import':
      return createSuccess(
        command.type,
        await saveCacheRecord(
          command.payload.videoId,
          command.payload.translations,
          {
            title: command.payload.title,
            sourceLang: 'Imported',
            targetLang: command.payload.targetLang,
            isRefined: false,
          },
        ),
      );

    case 'cache.delete':
      return createSuccess(command.type, {
        deleted: await deleteCacheRecord(command.payload.cacheKey),
      });

    case 'cache.clear':
      return createSuccess(command.type, {
        cleared: await clearCacheRecords(),
      });

    case 'usage.get':
      return createSuccess(command.type, await getUsageSummary());

    case 'translation.start':
      return createSuccess(
        command.type,
        await backgroundService.startTranslation(command.payload, { tabId }),
      );

    case 'translation.resume':
      return createSuccess(
        command.type,
        await backgroundService.resumeTranslation(command.payload, { tabId }),
      );

    case 'translation.cancel':
      return createSuccess(
        command.type,
        await backgroundService.cancelTranslation(command.payload),
      );

    case 'refine.start':
      return createSuccess(
        command.type,
        await backgroundService.startRefine(command.payload, { tabId }),
      );
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  backgroundService.cancelTasksForTab(tabId, 'tab-removed');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    backgroundService.cancelTasksForTab(tabId, 'tab-updated');
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'keep-alive') return;

  const timer = setInterval(() => {
    try {
      port.postMessage({ type: 'ping' });
    } catch {
      clearInterval(timer);
    }
  }, 25_000);

  port.onDisconnect.addListener(() => {
    clearInterval(timer);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isRebuildCommand(message)) return false;

  handleCommand(message, sender.tab?.id)
    .then(sendResponse)
    .catch((error: unknown) => {
      const code =
        error instanceof BackgroundCommandError
          ? error.code
          : 'UNEXPECTED_ERROR';
      const messageText =
        error instanceof Error ? error.message : 'Unknown background runtime error';
      sendResponse(createFailure(message.type, code, messageText));
    });

  return true;
});

console.info(
  `[YT AI Translator] Background runtime loaded (${REBUILD_META.phase}: ${REBUILD_META.title})`,
);
