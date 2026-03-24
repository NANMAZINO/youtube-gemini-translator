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
  DEFAULT_SETTINGS,
  SOURCE_LANGUAGES,
  TARGET_LANGUAGES,
  THINKING_LEVELS,
  THEME_MODES,
  UI_LOCALES,
  normalizeSettingsInput,
  type RuntimePageMessage,
  type CacheMetadata,
  type Settings,
  type SettingsInput,
  type UsageSummary,
} from '../shared/contracts/index.ts';
import { sendCommand } from '../shared/messaging.ts';
import { getUiCopy } from '../shared/ui-copy.ts';
import {
  detectSystemDarkTheme,
  resolvePopupTheme,
  resolveUiLocale,
} from '../shared/ui-preferences.ts';

const elements = {
  shell: document.getElementById('shell') as HTMLElement,
  appTitle: document.getElementById('appTitle') as HTMLHeadingElement,
  heroInfoBadge: document.getElementById('heroInfoBadge') as HTMLButtonElement,
  uiLocaleLabel: document.getElementById('uiLocaleLabel') as HTMLSpanElement,
  uiLocale: document.getElementById('uiLocale') as HTMLSelectElement,
  themeModeLabel: document.getElementById('themeModeLabel') as HTMLSpanElement,
  themeMode: document.getElementById('themeMode') as HTMLSelectElement,
  version: document.getElementById('version') as HTMLSpanElement,
  apiKeyTitle: document.getElementById('apiKeyTitle') as HTMLHeadingElement,
  apiKeyLabel: document.getElementById('apiKeyLabel') as HTMLSpanElement,
  apiKey: document.getElementById('apiKey') as HTMLInputElement,
  toggleApiKey: document.getElementById('toggleApiKey') as HTMLButtonElement,
  saveApiKey: document.getElementById('saveApiKey') as HTMLButtonElement,
  clearApiKey: document.getElementById('clearApiKey') as HTMLButtonElement,
  apiKeyHint: document.getElementById('apiKeyHint') as HTMLParagraphElement,
  settingsTitle: document.getElementById('settingsTitle') as HTMLHeadingElement,
  settingsForm: document.getElementById('settingsForm') as HTMLFormElement,
  sourceLangLabel: document.getElementById('sourceLangLabel') as HTMLSpanElement,
  sourceLang: document.getElementById('sourceLang') as HTMLSelectElement,
  targetLangLabel: document.getElementById('targetLangLabel') as HTMLSpanElement,
  targetLang: document.getElementById('targetLang') as HTMLSelectElement,
  thinkingLevelLabel: document.getElementById('thinkingLevelLabel') as HTMLSpanElement,
  thinkingLevelInfoBadge: document.getElementById('thinkingLevelInfoBadge') as HTMLButtonElement,
  thinkingLevel: document.getElementById('thinkingLevel') as HTMLSelectElement,
  resumeModeLabel: document.getElementById('resumeModeLabel') as HTMLSpanElement,
  resumeModeInfoBadge: document.getElementById('resumeModeInfoBadge') as HTMLButtonElement,
  resumeMode: document.getElementById('resumeMode') as HTMLInputElement,
  saveSettings: document.getElementById('saveSettings') as HTMLButtonElement,
  todayLabel: document.getElementById('todayLabel') as HTMLSpanElement,
  todayTokens: document.getElementById('todayTokens') as HTMLSpanElement,
  monthlyLabel: document.getElementById('monthlyLabel') as HTMLSpanElement,
  monthlyTokens: document.getElementById('monthlyTokens') as HTMLSpanElement,
  costLabel: document.getElementById('costLabel') as HTMLSpanElement,
  costInfoBadge: document.getElementById('costInfoBadge') as HTMLButtonElement,
  estimatedCost: document.getElementById('estimatedCost') as HTMLSpanElement,
  cacheLabel: document.getElementById('cacheLabel') as HTMLSpanElement,
  cacheCount: document.getElementById('cacheCount') as HTMLSpanElement,
  cacheTitle: document.getElementById('cacheTitle') as HTMLHeadingElement,
  clearCache: document.getElementById('clearCache') as HTMLButtonElement,
  cacheSummary: document.getElementById('cacheSummary') as HTMLParagraphElement,
  cacheList: document.getElementById('cacheList') as HTMLUListElement,
  status: document.getElementById('status') as HTMLParagraphElement,
  infoPopover: document.getElementById('infoPopover') as HTMLDivElement,
  infoPopoverText: document.getElementById('infoPopoverText') as HTMLParagraphElement,
};

const systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentSettings: Settings = DEFAULT_SETTINGS;
let activeInfoBadge: HTMLButtonElement | null = null;
let currentCacheView:
  | {
      kind: 'list';
      cacheList: CacheMetadata[];
    }
  | {
      kind: 'error';
      message: string;
    }
  | null = null;

const pendingState = {
  refresh: false,
  apiKey: false,
  settings: false,
  cache: false,
};

document.addEventListener('DOMContentLoaded', () => {
  renderLocalizedUi(currentSettings);
  renderVersion();
  bindEvents();
  syncPendingUi();
  void refresh();
});

function getResolvedUiLocale(settings = currentSettings) {
  return resolveUiLocale(settings.uiLocale, navigator.language);
}

function getPopupCopy(settings = currentSettings) {
  return getUiCopy(getResolvedUiLocale(settings));
}

function getDateLocale() {
  return getResolvedUiLocale() === 'ko' ? 'ko-KR' : 'en-US';
}

function renderVersion() {
  elements.version.textContent = `v${chrome.runtime.getManifest().version}`;
}

function applyDocumentPreferences(settings = currentSettings) {
  const resolvedUiLocale = getResolvedUiLocale(settings);
  const resolvedTheme = resolvePopupTheme(settings.themeMode, {
    systemDark: detectSystemDarkTheme(window.matchMedia.bind(window)),
  });

  document.documentElement.lang = resolvedUiLocale;
  document.documentElement.dataset.theme = resolvedTheme;
}

function renderSelectOptions<T extends string>(
  select: HTMLSelectElement,
  options: readonly T[],
  labels: Record<T, string>,
  selectedValue: T,
) {
  select.replaceChildren();

  options.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = labels[value];
    option.selected = value === selectedValue;
    select.appendChild(option);
  });
}

function getTranslationDraftValues() {
  return {
    sourceLang:
      (elements.sourceLang.value as Settings['sourceLang']) || currentSettings.sourceLang,
    targetLang:
      (elements.targetLang.value as Settings['targetLang']) || currentSettings.targetLang,
    thinkingLevel:
      (elements.thinkingLevel.value as Settings['thinkingLevel']) ||
      currentSettings.thinkingLevel,
    resumeMode:
      elements.resumeMode.checked ?? currentSettings.resumeMode,
  } satisfies Pick<
    SettingsInput,
    'sourceLang' | 'targetLang' | 'thinkingLevel' | 'resumeMode'
  >;
}

function renderLocalizedUi(
  settings: Settings,
  options: {
    preserveTranslationDraft?: boolean;
  } = {},
) {
  const copy = getPopupCopy(settings);
  const draftSettings = options.preserveTranslationDraft
    ? getTranslationDraftValues()
    : normalizeSettingsInput(settings);

  applyDocumentPreferences(settings);

  elements.appTitle.textContent = copy.common.appName;
  setInfoBadgeCopy(elements.heroInfoBadge, copy.common.unofficialToolNotice);
  elements.uiLocaleLabel.textContent = copy.popup.heroUiLanguage;
  elements.themeModeLabel.textContent = copy.popup.heroTheme;
  elements.apiKeyTitle.textContent = copy.popup.apiKeyTitle;
  elements.apiKeyLabel.textContent = copy.popup.apiKeyLabel;
  elements.apiKey.placeholder = copy.popup.apiKeyPlaceholder;
  elements.saveApiKey.textContent = copy.popup.saveKey;
  elements.clearApiKey.textContent = copy.popup.clear;
  elements.apiKeyHint.innerHTML = copy.popup.apiKeyHintHtml;
  elements.settingsTitle.textContent = copy.popup.settingsTitle;
  elements.sourceLangLabel.textContent = copy.popup.sourceLanguage;
  elements.targetLangLabel.textContent = copy.popup.targetLanguage;
  elements.thinkingLevelLabel.textContent = copy.popup.thinkingLevel;
  setInfoBadgeCopy(elements.thinkingLevelInfoBadge, copy.popup.thinkingLevelInfo);
  elements.resumeModeLabel.textContent = copy.popup.resumeMode;
  setInfoBadgeCopy(elements.resumeModeInfoBadge, copy.popup.resumeModeInfo);
  elements.saveSettings.textContent = copy.popup.saveSettings;
  elements.todayLabel.textContent = copy.popup.today;
  elements.monthlyLabel.textContent = copy.popup.lastThirtyDays;
  elements.costLabel.textContent = copy.popup.cost;
  setInfoBadgeCopy(elements.costInfoBadge, copy.popup.costInfo);
  elements.cacheLabel.textContent = copy.popup.cache;
  elements.cacheTitle.textContent = copy.popup.cache;
  elements.clearCache.textContent = copy.popup.clearCache;

  if (activeInfoBadge && !elements.infoPopover.hidden) {
    openInfoPopover(activeInfoBadge);
  }

  renderSelectOptions(
    elements.uiLocale,
    UI_LOCALES,
    copy.common.uiLocaleOptions,
    settings.uiLocale,
  );
  renderSelectOptions(
    elements.themeMode,
    THEME_MODES,
    copy.common.themeModeOptions,
    settings.themeMode,
  );
  renderSelectOptions(
    elements.sourceLang,
    SOURCE_LANGUAGES,
    copy.common.sourceLanguageOptions,
    draftSettings.sourceLang,
  );
  renderSelectOptions(
    elements.targetLang,
    TARGET_LANGUAGES,
    copy.common.targetLanguageOptions,
    draftSettings.targetLang,
  );
  renderSelectOptions(
    elements.thinkingLevel,
    THINKING_LEVELS,
    copy.common.thinkingLevelOptions,
    draftSettings.thinkingLevel,
  );

  elements.resumeMode.checked = draftSettings.resumeMode;
  rerenderCacheView();
  setApiKeyVisibility(elements.apiKey.type === 'text');
}

function setInfoBadgeCopy(element: HTMLButtonElement, message: string) {
  element.title = message;
  element.dataset.infoMessage = message;
  element.setAttribute('aria-label', message);
}

function closeInfoPopover() {
  elements.infoPopover.hidden = true;
  if (activeInfoBadge) {
    activeInfoBadge.setAttribute('aria-expanded', 'false');
  }
  activeInfoBadge = null;
}

function openInfoPopover(trigger: HTMLButtonElement) {
  const message = trigger.dataset.infoMessage;
  if (!message) {
    return;
  }

  if (activeInfoBadge === trigger && !elements.infoPopover.hidden) {
    closeInfoPopover();
    return;
  }

  if (activeInfoBadge) {
    activeInfoBadge.setAttribute('aria-expanded', 'false');
  }

  activeInfoBadge = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  elements.infoPopoverText.textContent = message;
  elements.infoPopover.hidden = false;

  const triggerRect = trigger.getBoundingClientRect();
  const popoverRect = elements.infoPopover.getBoundingClientRect();
  const margin = 12;
  const left = Math.min(
    Math.max(margin, triggerRect.left + (triggerRect.width - popoverRect.width) / 2),
    window.innerWidth - popoverRect.width - margin,
  );
  const top = Math.min(
    window.innerHeight - popoverRect.height - margin,
    triggerRect.bottom + 8,
  );

  elements.infoPopover.style.left = `${Math.round(left)}px`;
  elements.infoPopover.style.top = `${Math.round(Math.max(margin, top))}px`;
}

function bindInfoBadge(button: HTMLButtonElement) {
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'infoPopover');
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    openInfoPopover(button);
  });
}

function rerenderCacheView() {
  if (!currentCacheView) {
    return;
  }

  if (currentCacheView.kind === 'list') {
    renderCacheList(currentCacheView.cacheList, { persistState: false });
    return;
  }

  renderCacheLoadError(currentCacheView.message, { persistState: false });
}

function bindEvents() {
  [
    elements.heroInfoBadge,
    elements.thinkingLevelInfoBadge,
    elements.resumeModeInfoBadge,
    elements.costInfoBadge,
  ].forEach(bindInfoBadge);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (
      activeInfoBadge &&
      target instanceof Node &&
      !elements.infoPopover.contains(target) &&
      !activeInfoBadge.contains(target)
    ) {
      closeInfoPopover();
    }
  });

  elements.infoPopover.addEventListener('click', () => {
    closeInfoPopover();
  });

  window.addEventListener('scroll', () => {
    closeInfoPopover();
  }, { passive: true });

  window.addEventListener('wheel', () => {
    closeInfoPopover();
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeInfoPopover();
    }
  });

  elements.toggleApiKey.addEventListener('click', () => {
    setApiKeyVisibility(elements.apiKey.type === 'password');
  });

  elements.uiLocale.addEventListener('change', () => {
    void handleSaveUiPreferences();
  });

  elements.themeMode.addEventListener('change', () => {
    void handleSaveUiPreferences();
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

  systemThemeMediaQuery.addEventListener('change', () => {
    if (currentSettings.themeMode !== 'system') {
      return;
    }

    applyDocumentPreferences(currentSettings);
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

  elements.uiLocale.disabled = settingsBusy;
  elements.themeMode.disabled = settingsBusy;
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

  const toggleState = getApiKeyToggleState(isVisible, getPopupCopy().popup);
  elements.toggleApiKey.textContent = toggleState.text;
  elements.toggleApiKey.setAttribute('aria-label', toggleState.ariaLabel);
  elements.toggleApiKey.setAttribute('aria-pressed', toggleState.ariaPressed);
}

async function refresh() {
  setPending('refresh', true);
  setStatus(getPopupCopy().popup.loadingSettings);

  try {
    const [apiKeyResult, settingsResult, usageResult, cacheResult] =
      await Promise.allSettled([
        getApiKeyData(),
        getSettingsData(),
        getUsageData(),
        getCacheListData(),
      ]);

    if (settingsResult.status === 'fulfilled') {
      currentSettings = settingsResult.value;
      renderLocalizedUi(currentSettings);
    }

    const failedSections: string[] = [];
    const popupCopy = getPopupCopy().popup;

    if (apiKeyResult.status === 'fulfilled') {
      renderApiKey(apiKeyResult.value);
    } else {
      failedSections.push(popupCopy.failedSections.apiKey);
    }

    if (settingsResult.status !== 'fulfilled') {
      failedSections.push(popupCopy.failedSections.translationSettings);
    }

    if (usageResult.status === 'fulfilled') {
      renderUsage(usageResult.value);
    } else {
      renderUsageUnavailable();
      failedSections.push(popupCopy.failedSections.usageTotals);
    }

    if (cacheResult.status === 'fulfilled') {
      renderCacheList(cacheResult.value);
    } else {
      renderCacheLoadError(
        cacheResult.reason instanceof Error
          ? cacheResult.reason.message
          : popupCopy.cacheUnavailable,
      );
      failedSections.push(popupCopy.failedSections.savedBundles);
    }

    const summary = summarizeRefreshFailures(failedSections, getPopupCopy().popup);
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
    kind: 'runtime.command',
    type: 'settings.get',
  });

  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

async function getUsageData(): Promise<UsageSummary> {
  const response = await sendCommand<'usage.get'>({
    kind: 'runtime.command',
    type: 'usage.get',
  });

  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

async function getCacheListData(): Promise<CacheMetadata[]> {
  const response = await sendCommand<'cache.list'>({
    kind: 'runtime.command',
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
  currentSettings = settings;
  renderLocalizedUi(settings);
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

function renderCacheList(
  cacheList: CacheMetadata[],
  options: { persistState?: boolean } = {},
) {
  const uiCopy = getPopupCopy();
  if (options.persistState !== false) {
    currentCacheView = {
      kind: 'list',
      cacheList: [...cacheList],
    };
  }
  elements.cacheCount.textContent = `${cacheList.length}`;
  elements.cacheSummary.textContent = summarizeCacheList(
    cacheList.length,
    cacheList.length,
    uiCopy.popup,
  );
  elements.cacheList.replaceChildren();

  if (cacheList.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = uiCopy.popup.cacheEmpty;
    elements.cacheList.appendChild(empty);
    syncPendingUi();
    return;
  }

  cacheList.forEach((item) => {
    const summary = describeCacheEntry(item, uiCopy, getDateLocale());
    const listItem = document.createElement('li');
    listItem.className = 'cache-item';
    const copyContainer = document.createElement('div');
    copyContainer.className = 'cache-copy';

    const title = document.createElement('strong');
    title.textContent = item.title.trim() || uiCopy.popup.untitledVideo;

    const meta = document.createElement('span');
    meta.className = 'cache-meta';
    meta.textContent = `${summary.stateLabel} · ${summary.languageLabel}`;

    meta.textContent = [summary.stateLabel, summary.languageLabel].join(' · ');

    meta.textContent = [summary.stateLabel, summary.languageLabel].join(' / ');

    const detail = document.createElement('span');
    detail.className = 'cache-detail';
    detail.textContent = summary.savedLabel;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'secondary cache-delete';
    deleteButton.dataset.cacheAction = 'delete';
    deleteButton.textContent = uiCopy.popup.deleteAction;
    deleteButton.setAttribute('aria-label', summary.deleteLabel);
    deleteButton.title = summary.deleteLabel;
    deleteButton.addEventListener('click', () => {
      void handleDeleteCache(item.cacheKey);
    });

    copyContainer.append(title, meta, detail);
    listItem.append(copyContainer, deleteButton);
    elements.cacheList.appendChild(listItem);
  });

  syncPendingUi();
}

function renderCacheLoadError(
  message: string,
  options: { persistState?: boolean } = {},
) {
  const popupCopy = getPopupCopy().popup;
  if (options.persistState !== false) {
    currentCacheView = {
      kind: 'error',
      message,
    };
  }
  elements.cacheCount.textContent = '--';
  elements.cacheSummary.textContent = popupCopy.cacheUnavailable;
  elements.cacheList.replaceChildren();

  const empty = document.createElement('li');
  empty.className = 'empty-state';
  empty.textContent = popupCopy.cacheUnavailableDetail(message);
  elements.cacheList.appendChild(empty);
  syncPendingUi();
}

async function handleSaveApiKey() {
  setPending('apiKey', true);
  try {
    const popupCopy = getPopupCopy().popup;
    const apiKey = normalizeApiKeyInput(elements.apiKey.value);

    if (!apiKey) {
      setStatus(popupCopy.enterApiKeyFirst, 'error');
      return;
    }

    if (!isLikelyApiKey(apiKey)) {
      setStatus(popupCopy.invalidApiKey, 'error');
      return;
    }

    await saveApiKey(apiKey);
    elements.apiKey.value = apiKey;
    setApiKeyVisibility(false);
    setStatus(popupCopy.apiKeySaved, 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : getPopupCopy().popup.failedToSaveApiKey,
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
    setStatus(getPopupCopy().popup.apiKeyCleared, 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : getPopupCopy().popup.failedToClearApiKey,
      'error',
    );
  } finally {
    setPending('apiKey', false);
  }
}

async function handleSaveUiPreferences() {
  setPending('settings', true);
  try {
    const payload: SettingsInput = normalizeSettingsInput({
      ...currentSettings,
      uiLocale: elements.uiLocale.value as Settings['uiLocale'],
      themeMode: elements.themeMode.value as Settings['themeMode'],
    });

    const response = await sendCommand<'settings.save'>({
      kind: 'runtime.command',
      type: 'settings.save',
      payload,
    });

    if (!response.ok) {
      renderLocalizedUi(currentSettings, { preserveTranslationDraft: true });
      setStatus(response.error.message, 'error');
      return;
    }

    currentSettings = response.data;
    renderLocalizedUi(currentSettings, { preserveTranslationDraft: true });
    setStatus(getPopupCopy().popup.settingsSaved, 'success');
  } catch (error) {
    renderLocalizedUi(currentSettings, { preserveTranslationDraft: true });
    setStatus(
      error instanceof Error ? error.message : getPopupCopy().popup.failedToSaveSettings,
      'error',
    );
  } finally {
    setPending('settings', false);
  }
}

async function notifyActiveYouTubeTab(message: RuntimePageMessage) {
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
    // Ignore tabs where the content runtime is not active.
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
      uiLocale: elements.uiLocale.value as Settings['uiLocale'],
      themeMode: elements.themeMode.value as Settings['themeMode'],
    });

    const response = await sendCommand<'settings.save'>({
      kind: 'runtime.command',
      type: 'settings.save',
      payload,
    });

    if (!response.ok) {
      setStatus(response.error.message, 'error');
      return;
    }

    currentSettings = response.data;
    renderSettings(response.data);
    setStatus(getPopupCopy().popup.settingsSaved, 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : getPopupCopy().popup.failedToSaveSettings,
      'error',
    );
  } finally {
    setPending('settings', false);
  }
}

async function handleDeleteCache(cacheKey: string) {
  setPending('cache', true);
  try {
    if (!window.confirm(getPopupCopy().popup.deleteCacheConfirm)) {
      return;
    }

    const response = await sendCommand<'cache.delete'>({
      kind: 'runtime.command',
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
      kind: 'runtime.page',
      type: 'cache.delete',
      payload: { cacheKey },
    });
    setStatus(getPopupCopy().popup.cachedTranslationDeleted, 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : getPopupCopy().popup.failedToDeleteCacheEntry,
      'error',
    );
  } finally {
    setPending('cache', false);
  }
}

async function handleClearCache() {
  setPending('cache', true);
  try {
    if (!window.confirm(getPopupCopy().popup.clearCacheConfirm)) {
      return;
    }

    const response = await sendCommand<'cache.clear'>({
      kind: 'runtime.command',
      type: 'cache.clear',
    });

    if (!response.ok) {
      setStatus(response.error.message, 'error');
      return;
    }

    renderCacheList([]);
    elements.cacheCount.textContent = '0';
    await notifyActiveYouTubeTab({
      kind: 'runtime.page',
      type: 'cache.clear',
    });
    setStatus(getPopupCopy().popup.cacheCleared, 'success');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : getPopupCopy().popup.failedToClearCache,
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
