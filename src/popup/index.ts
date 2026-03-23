import { calculateEstimatedCost, formatTokenCount } from '../domain/usage/token-usage';
import {
  clearApiKey,
  getApiKey,
  saveApiKey,
} from '../adapters/storage/api-key-storage.ts';
import { isLikelyApiKey, normalizeApiKeyInput } from './api-key.ts';
import {
  describeCacheEntry,
  getApiKeyToggleState,
  summarizeCacheList,
  summarizeRefreshFailures,
} from './presentation.ts';
import {
  normalizeSettingsInput,
  type RebuildPageMessage,
  type CacheMetadata,
  type Settings,
  type SettingsInput,
  type UsageSummary,
} from '../shared/contracts/index.ts';
import { sendCommand } from '../shared/messaging.ts';

const elements = {
  shell: document.getElementById('shell') as HTMLElement,
  version: document.getElementById('version') as HTMLSpanElement,
  apiKey: document.getElementById('apiKey') as HTMLInputElement,
  toggleApiKey: document.getElementById('toggleApiKey') as HTMLButtonElement,
  saveApiKey: document.getElementById('saveApiKey') as HTMLButtonElement,
  clearApiKey: document.getElementById('clearApiKey') as HTMLButtonElement,
  settingsForm: document.getElementById('settingsForm') as HTMLFormElement,
  sourceLang: document.getElementById('sourceLang') as HTMLSelectElement,
  targetLang: document.getElementById('targetLang') as HTMLSelectElement,
  thinkingLevel: document.getElementById('thinkingLevel') as HTMLSelectElement,
  resumeMode: document.getElementById('resumeMode') as HTMLInputElement,
  todayTokens: document.getElementById('todayTokens') as HTMLSpanElement,
  monthlyTokens: document.getElementById('monthlyTokens') as HTMLSpanElement,
  estimatedCost: document.getElementById('estimatedCost') as HTMLSpanElement,
  cacheCount: document.getElementById('cacheCount') as HTMLSpanElement,
  clearCache: document.getElementById('clearCache') as HTMLButtonElement,
  cacheSummary: document.getElementById('cacheSummary') as HTMLParagraphElement,
  cacheList: document.getElementById('cacheList') as HTMLUListElement,
  status: document.getElementById('status') as HTMLParagraphElement,
};

const pendingState = {
  refresh: false,
  apiKey: false,
  settings: false,
  cache: false,
};

document.addEventListener('DOMContentLoaded', () => {
  renderVersion();
  bindEvents();
  syncPendingUi();
  void refresh();
});

function renderVersion() {
  elements.version.textContent = `v${chrome.runtime.getManifest().version}`;
}

function bindEvents() {
  elements.toggleApiKey.addEventListener('click', () => {
    setApiKeyVisibility(elements.apiKey.type === 'password');
  });

  elements.saveApiKey.addEventListener('click', () => {
    void handleSaveApiKey();
  });

  elements.clearApiKey.addEventListener('click', () => {
    void handleClearApiKey();
  });

  elements.apiKey.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleSaveApiKey();
    }
  });

  elements.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSaveSettings();
  });

  elements.clearCache.addEventListener('click', () => {
    void handleClearCache();
  });
}

function setPending(kind: keyof typeof pendingState, value: boolean) {
  pendingState[kind] = value;
  syncPendingUi();
}

function syncPendingUi() {
  const shellBusy = Object.values(pendingState).some(Boolean);
  const apiKeyBusy = pendingState.refresh || pendingState.apiKey;
  const settingsBusy = pendingState.refresh || pendingState.settings;
  const cacheBusy = pendingState.refresh || pendingState.cache;

  elements.shell.setAttribute('aria-busy', shellBusy ? 'true' : 'false');

  elements.apiKey.disabled = apiKeyBusy;
  elements.toggleApiKey.disabled = apiKeyBusy;
  elements.saveApiKey.disabled = apiKeyBusy;
  elements.clearApiKey.disabled = apiKeyBusy;

  elements.sourceLang.disabled = settingsBusy;
  elements.targetLang.disabled = settingsBusy;
  elements.thinkingLevel.disabled = settingsBusy;
  elements.resumeMode.disabled = settingsBusy;
  elements.settingsForm
    .querySelectorAll<HTMLButtonElement>('button')
    .forEach((button) => {
      button.disabled = settingsBusy;
    });

  elements.clearCache.disabled = cacheBusy;
  elements.cacheList
    .querySelectorAll<HTMLButtonElement>('[data-cache-action="delete"]')
    .forEach((button) => {
      button.disabled = cacheBusy;
    });
}

function setApiKeyVisibility(isVisible: boolean) {
  elements.apiKey.type = isVisible ? 'text' : 'password';

  const toggleState = getApiKeyToggleState(isVisible);
  elements.toggleApiKey.textContent = toggleState.text;
  elements.toggleApiKey.setAttribute('aria-label', toggleState.ariaLabel);
  elements.toggleApiKey.setAttribute('aria-pressed', toggleState.ariaPressed);
}

async function refresh() {
  setPending('refresh', true);
  setStatus('Loading your translator settings...');

  try {
    const [apiKeyResult, settingsResult, usageResult, cacheResult] =
      await Promise.allSettled([
        getApiKeyData(),
        getSettingsData(),
        getUsageData(),
        getCacheListData(),
      ]);

    const failedSections: string[] = [];

    if (apiKeyResult.status === 'fulfilled') {
      renderApiKey(apiKeyResult.value);
    } else {
      failedSections.push('your saved API key');
    }

    if (settingsResult.status === 'fulfilled') {
      renderSettings(settingsResult.value);
    } else {
      failedSections.push('translation settings');
    }

    if (usageResult.status === 'fulfilled') {
      renderUsage(usageResult.value);
    } else {
      renderUsageUnavailable();
      failedSections.push('usage totals');
    }

    if (cacheResult.status === 'fulfilled') {
      renderCacheList(cacheResult.value);
    } else {
      renderCacheLoadError(
        cacheResult.reason instanceof Error
          ? cacheResult.reason.message
          : 'Saved subtitle bundles could not be loaded.',
      );
      failedSections.push('saved subtitle bundles');
    }

    const summary = summarizeRefreshFailures(failedSections);
    setStatus(summary.message, summary.type);
  } finally {
    setPending('refresh', false);
  }
}

async function getApiKeyData(): Promise<string | null> {
  return getApiKey();
}

async function getSettingsData(): Promise<Settings> {
  const response = await sendCommand<'settings.get'>({
    kind: 'rebuild.command',
    type: 'settings.get',
  });

  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

async function getUsageData(): Promise<UsageSummary> {
  const response = await sendCommand<'usage.get'>({
    kind: 'rebuild.command',
    type: 'usage.get',
  });

  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

async function getCacheListData(): Promise<CacheMetadata[]> {
  const response = await sendCommand<'cache.list'>({
    kind: 'rebuild.command',
    type: 'cache.list',
  });

  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

function renderApiKey(apiKey: string | null) {
  elements.apiKey.value = apiKey ?? '';
  setApiKeyVisibility(false);
}

function renderSettings(settings: Settings) {
  const normalizedSettings = normalizeSettingsInput(settings);

  elements.sourceLang.value = normalizedSettings.sourceLang;
  elements.targetLang.value = normalizedSettings.targetLang;
  elements.thinkingLevel.value = normalizedSettings.thinkingLevel;
  elements.resumeMode.checked = normalizedSettings.resumeMode;
}

function renderUsage(usage: UsageSummary) {
  const todayTotal = usage.today.input + usage.today.output;
  const monthlyTotal = usage.monthly.input + usage.monthly.output;

  elements.todayTokens.textContent = formatTokenCount(todayTotal);
  elements.monthlyTokens.textContent = formatTokenCount(monthlyTotal);
  elements.estimatedCost.textContent = `$${calculateEstimatedCost(usage.monthly).toFixed(3)}`;
}

function renderUsageUnavailable() {
  elements.todayTokens.textContent = '--';
  elements.monthlyTokens.textContent = '--';
  elements.estimatedCost.textContent = '$--';
}

function renderCacheList(cacheList: CacheMetadata[]) {
  elements.cacheCount.textContent = `${cacheList.length}`;
  elements.cacheSummary.textContent = summarizeCacheList(
    cacheList.length,
    cacheList.length,
  );
  elements.cacheList.replaceChildren();

  if (cacheList.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'No saved subtitle bundles yet.';
    elements.cacheList.appendChild(empty);
    syncPendingUi();
    return;
  }

  cacheList.forEach((item) => {
    const summary = describeCacheEntry(item);
    const listItem = document.createElement('li');
    listItem.className = 'cache-item';
    const copy = document.createElement('div');
    copy.className = 'cache-copy';

    const title = document.createElement('strong');
    title.textContent = item.title.trim() || 'Untitled video';

    const meta = document.createElement('span');
    meta.className = 'cache-meta';
    meta.textContent = `${summary.stateLabel} · ${summary.languageLabel}`;

    const detail = document.createElement('span');
    detail.className = 'cache-detail';
    detail.textContent = summary.savedLabel;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'secondary cache-delete';
    deleteButton.dataset.cacheAction = 'delete';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', summary.deleteLabel);
    deleteButton.title = summary.deleteLabel;
    deleteButton.addEventListener('click', () => {
      void handleDeleteCache(item.cacheKey);
    });

    copy.append(title, meta, detail);
    listItem.append(copy, deleteButton);
    elements.cacheList.appendChild(listItem);
  });

  syncPendingUi();
}

function renderCacheLoadError(message: string) {
  elements.cacheCount.textContent = '--';
  elements.cacheSummary.textContent = 'Saved subtitle bundles are temporarily unavailable.';
  elements.cacheList.replaceChildren();

  const empty = document.createElement('li');
  empty.className = 'empty-state';
  empty.textContent = `Could not load saved subtitle bundles right now. ${message}`;
  elements.cacheList.appendChild(empty);
  syncPendingUi();
}

async function handleSaveApiKey() {
  setPending('apiKey', true);
  try {
    const apiKey = normalizeApiKeyInput(elements.apiKey.value);

    if (!apiKey) {
      setStatus('Enter your Gemini API key first.', 'error');
      return;
    }

    if (!isLikelyApiKey(apiKey)) {
      setStatus('That does not look like a valid Gemini API key yet.', 'error');
      return;
    }

    await saveApiKey(apiKey);
    elements.apiKey.value = apiKey;
    setApiKeyVisibility(false);
    setStatus('API key saved.', 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Failed to save the API key.',
      'error',
    );
  } finally {
    setPending('apiKey', false);
  }
}

async function handleClearApiKey() {
  setPending('apiKey', true);
  try {
    await clearApiKey();
    elements.apiKey.value = '';
    setApiKeyVisibility(false);
    setStatus('API key cleared.', 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Failed to clear the API key.',
      'error',
    );
  } finally {
    setPending('apiKey', false);
  }
}

async function notifyActiveYouTubeTab(message: RebuildPageMessage) {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (
    activeTab?.id == null ||
    typeof activeTab.url !== 'string' ||
    !activeTab.url.includes('youtube.com')
  ) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(activeTab.id, message);
  } catch {
    // Ignore tabs where the rebuild content script is not active.
  }
}

async function handleSaveSettings() {
  setPending('settings', true);
  try {
    const payload: SettingsInput = normalizeSettingsInput({
      sourceLang: elements.sourceLang.value as Settings['sourceLang'],
      targetLang: elements.targetLang.value as Settings['targetLang'],
      thinkingLevel: elements.thinkingLevel.value as Settings['thinkingLevel'],
      resumeMode: elements.resumeMode.checked,
    });

    const response = await sendCommand<'settings.save'>({
      kind: 'rebuild.command',
      type: 'settings.save',
      payload,
    });

    if (!response.ok) {
      setStatus(response.error.message, 'error');
      return;
    }

    renderSettings(response.data);
    setStatus('Settings saved.', 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Failed to save settings.',
      'error',
    );
  } finally {
    setPending('settings', false);
  }
}

async function handleDeleteCache(cacheKey: string) {
  setPending('cache', true);
  try {
    if (!window.confirm('Delete this cached translation?')) {
      return;
    }

    const response = await sendCommand<'cache.delete'>({
      kind: 'rebuild.command',
      type: 'cache.delete',
      payload: { cacheKey },
    });

    if (!response.ok) {
      setStatus(response.error.message, 'error');
      return;
    }

    const cacheList = await getCacheListData();
    renderCacheList(cacheList);
    await notifyActiveYouTubeTab({
      kind: 'rebuild.page',
      type: 'cache.delete',
      payload: { cacheKey },
    });
    setStatus('Cached translation deleted.', 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Failed to delete the cache entry.',
      'error',
    );
  } finally {
    setPending('cache', false);
  }
}

async function handleClearCache() {
  setPending('cache', true);
  try {
    if (!window.confirm('Clear all cached translations?')) {
      return;
    }

    const response = await sendCommand<'cache.clear'>({
      kind: 'rebuild.command',
      type: 'cache.clear',
    });

    if (!response.ok) {
      setStatus(response.error.message, 'error');
      return;
    }

    renderCacheList([]);
    elements.cacheCount.textContent = '0';
    await notifyActiveYouTubeTab({
      kind: 'rebuild.page',
      type: 'cache.clear',
    });
    setStatus('Cache cleared.', 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Failed to clear the cache.',
      'error',
    );
  } finally {
    setPending('cache', false);
  }
}

function setStatus(message: string, type?: 'success' | 'error') {
  elements.status.textContent = message;
  elements.status.className = 'status';

  if (type) {
    elements.status.classList.add(type);
  }
}
