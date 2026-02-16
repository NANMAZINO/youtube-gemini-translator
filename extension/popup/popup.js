// YouTube AI Translator - Popup Script
import {
  getCacheCount,
  getCacheStorageSize,
  getAllCacheMetadata,
  deleteFromCache,
  clearCache,
} from '../lib/cache.js';
import { saveApiKey, getApiKey, clearApiKey } from '../lib/storage.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Popup');

const elements = {
  apiKey: document.getElementById('apiKey'),
  toggleVisibility: document.getElementById('toggleVisibility'),
  saveKey: document.getElementById('saveKey'),
  clearKey: document.getElementById('clearKey'),
  targetLang: document.getElementById('targetLang'),
  sourceLang: document.getElementById('sourceLang'),
  thinkingLevel: document.getElementById('thinkingLevel'),
  resumeMode: document.getElementById('resumeMode'),
  inputTokens: document.getElementById('inputTokens'),
  outputTokens: document.getElementById('outputTokens'),
  totalTokens: document.getElementById('totalTokens'),
  cacheCount: document.getElementById('cacheCount'),
  cacheSize: document.getElementById('cacheSize'),
  cacheList: document.getElementById('cacheList'),
  clearCache: document.getElementById('clearCache'),
  status: document.getElementById('status'),
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadTokenUsage();
  await updateCacheInfo();
  setupEventListeners();
  setupTooltips();
});

async function loadSettings() {
  const result = await chrome.storage.local.get([
    'targetLang',
    'sourceLang',
    'thinkingLevel',
    'resumeMode',
  ]);

  const apiKey = await getApiKey();
  if (apiKey) elements.apiKey.value = apiKey;
  if (result.targetLang) elements.targetLang.value = result.targetLang;
  if (result.sourceLang) elements.sourceLang.value = result.sourceLang;
  if (result.thinkingLevel) elements.thinkingLevel.value = result.thinkingLevel;
  elements.resumeMode.checked = result.resumeMode !== false;
}

async function handleSaveApiKey() {
  const key = elements.apiKey.value.trim();

  if (!key) {
    showStatus('API Key를 입력해주세요.', 'error');
    return;
  }

  if (!key.startsWith('AI') && key.length < 30) {
    showStatus('올바른 API Key 형식이 아닙니다.', 'error');
    return;
  }

  await saveApiKey(key);
  showStatus('API Key가 저장되었습니다.', 'success');
}

async function handleClearApiKey() {
  await clearApiKey();
  elements.apiKey.value = '';
  showStatus('API Key가 삭제되었습니다.', 'success');
}

async function saveSettings() {
  const settings = {
    targetLang: elements.targetLang.value,
    sourceLang: elements.sourceLang.value,
    thinkingLevel: elements.thinkingLevel.value,
    resumeMode: elements.resumeMode.checked,
  };
  await chrome.storage.local.set(settings);
}

let tokenData = { today: { input: 0, output: 0 }, monthly: { input: 0, output: 0 } };

async function loadTokenUsage() {
  const result = await chrome.storage.local.get('tokenHistory');
  const history = result.tokenHistory || {};
  const today = new Date().toISOString().split('T')[0];

  tokenData.today = history[today] || { input: 0, output: 0 };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  tokenData.monthly = Object.entries(history)
    .filter(([date]) => date >= cutoffStr)
    .reduce(
      (acc, [, usage]) => ({
        input: acc.input + (usage.input || 0),
        output: acc.output + (usage.output || 0),
      }),
      { input: 0, output: 0 },
    );

  displayTokenUsage('today');
  setupUsageTabs();
}

function displayTokenUsage(tab) {
  const usage = tokenData[tab];
  elements.inputTokens.textContent = formatNumber(usage.input);
  elements.outputTokens.textContent = formatNumber(usage.output);
  elements.totalTokens.textContent = formatNumber(usage.input + usage.output);

  const cost = usage.input * (0.5 / 1_000_000) + usage.output * (3.0 / 1_000_000);
  document.getElementById('estimatedCost').textContent = `$${cost.toFixed(3)}`;
}

function setupUsageTabs() {
  const tabs = document.querySelectorAll('.usage-tab');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((target) => target.classList.remove('active'));
      tab.classList.add('active');
      displayTokenUsage(tab.dataset.tab);
    });
  });
}

function formatNumber(num) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return `${num}`;
}

async function updateCacheInfo() {
  await loadCacheCount();
  await loadCacheList();
}

async function loadCacheCount() {
  try {
    const count = await getCacheCount();
    const size = await getCacheStorageSize();

    elements.cacheCount.textContent = count;
    elements.cacheSize.textContent = formatBytes(size);
  } catch (err) {
    log.error('Fail to load cache count:', err);
    elements.cacheCount.textContent = '-';
    elements.cacheSize.textContent = '0 KB';
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

async function loadCacheList() {
  try {
    const list = await getAllCacheMetadata();
    renderCacheList(list);
  } catch (err) {
    log.error('Fail to load cache list:', err);
  }
}

function renderCacheList(list) {
  if (!list || list.length === 0) {
    elements.cacheList.replaceChildren();
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'empty-msg';
    emptyMsg.textContent = '저장된 번역 내역이 없습니다.';
    elements.cacheList.appendChild(emptyMsg);
    return;
  }

  elements.cacheList.replaceChildren();
  list.forEach((item) => {
    const cacheItem = document.createElement('div');
    cacheItem.className = 'cache-item';

    const infoMain = document.createElement('div');
    infoMain.className = 'cache-info-main';

    const titleRow = document.createElement('div');
    titleRow.className = 'cache-title-row';

    const originalId = item.videoId.replace(/_[^_]+$/, '');
    const link = document.createElement('a');
    link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(originalId)}`;
    link.target = '_blank';
    link.className = 'cache-title';
    link.title = item.title;
    link.textContent = item.title;
    titleRow.appendChild(link);

    if (item.isPartial) {
      const partialBadge = document.createElement('span');
      partialBadge.className = 'badge-partial';
      partialBadge.textContent = '진행중';
      titleRow.appendChild(partialBadge);
    }

    const meta = document.createElement('div');
    meta.className = 'cache-meta';

    const dateSpan = document.createElement('span');
    dateSpan.textContent = `📅 ${new Date(item.timestamp).toLocaleDateString()}`;

    const langSpan = document.createElement('span');
    langSpan.textContent = `🌐 ${item.sourceLang} → ${item.targetLang}`;

    meta.append(dateSpan, langSpan);
    infoMain.append(titleRow, meta);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-del';
    delBtn.title = '삭제';
    delBtn.textContent = '🗑️';
    delBtn.onclick = () => handleIndividualDelete(item.videoId);

    cacheItem.append(infoMain, delBtn);
    elements.cacheList.appendChild(cacheItem);
  });
}

async function handleIndividualDelete(cacheKey) {
  if (!confirm('이 번역 내역을 삭제할까요?')) return;

  try {
    const result = await deleteFromCache(cacheKey);

    if (result?.success) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url?.includes('youtube.com')) {
        chrome.tabs
          .sendMessage(tab.id, {
            type: 'DELETE_CACHE',
            payload: { videoId: cacheKey },
          })
          .catch(() => {});
      }

      showStatus('삭제되었습니다.', 'success');
      await updateCacheInfo();
    }
  } catch {
    showStatus('삭제 실패', 'error');
  }
}

async function clearCacheAll() {
  if (!confirm('모든 번역 캐시를 삭제하시겠습니까?')) return;

  try {
    const success = await clearCache();
    if (success) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url?.includes('youtube.com')) {
        chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_CACHE' }).catch(() => {});
      }

      await updateCacheInfo();
      showStatus('모든 캐시가 삭제되었습니다.', 'success');
    }
  } catch {
    showStatus('캐시 삭제 중 오류가 발생했습니다.', 'error');
  }
}

function setupEventListeners() {
  elements.toggleVisibility.addEventListener('click', () => {
    const type = elements.apiKey.type === 'password' ? 'text' : 'password';
    elements.apiKey.type = type;
    elements.toggleVisibility.textContent = type === 'password' ? '👁️' : '🙈';
  });

  elements.saveKey.addEventListener('click', handleSaveApiKey);
  elements.clearKey.addEventListener('click', handleClearApiKey);

  elements.targetLang.addEventListener('change', saveSettings);
  elements.sourceLang.addEventListener('change', saveSettings);
  elements.thinkingLevel.addEventListener('change', saveSettings);
  elements.resumeMode.addEventListener('change', saveSettings);

  elements.clearCache.addEventListener('click', clearCacheAll);

  elements.apiKey.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSaveApiKey();
    }
  });
}

function showStatus(message, type) {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;

  setTimeout(() => {
    elements.status.className = 'status hidden';
  }, 3000);
}

function setupTooltips() {
  let tooltipBox = null;

  document.querySelectorAll('.info-icon').forEach((icon) => {
    icon.addEventListener('mouseenter', () => {
      const text = icon.getAttribute('data-tooltip');
      if (!text) return;

      if (tooltipBox) tooltipBox.remove();

      tooltipBox = document.createElement('div');
      tooltipBox.className = 'tooltip-box';
      tooltipBox.textContent = text;
      document.body.appendChild(tooltipBox);

      const rect = icon.getBoundingClientRect();
      tooltipBox.style.top = `${rect.bottom + 4}px`;
    });

    icon.addEventListener('mouseleave', () => {
      if (tooltipBox) {
        tooltipBox.remove();
        tooltipBox = null;
      }
    });
  });
}
