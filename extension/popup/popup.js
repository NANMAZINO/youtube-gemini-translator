// YouTube AI Translator - Popup Script
import { getCacheCount, getCacheStorageSize, getAllCacheMetadata, deleteFromCache, clearCache } from '../lib/cache.js';
import { saveApiKey, getApiKey, clearApiKey } from '../lib/storage.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Popup');

// API Key 관리, 설정, 사용량 표시

// ========================================
// DOM 요소
// ========================================
const elements = {
  apiKey: document.getElementById('apiKey'),
  toggleVisibility: document.getElementById('toggleVisibility'),
  saveKey: document.getElementById('saveKey'),
  clearKey: document.getElementById('clearKey'),
  targetLang: document.getElementById('targetLang'),
  sourceLang: document.getElementById('sourceLang'),
  thinkingLevel: document.getElementById('thinkingLevel'),
  inputTokens: document.getElementById('inputTokens'),
  outputTokens: document.getElementById('outputTokens'),
  totalTokens: document.getElementById('totalTokens'),
  cacheCount: document.getElementById('cacheCount'),
  cacheSize: document.getElementById('cacheSize'),
  cacheList: document.getElementById('cacheList'),
  clearCache: document.getElementById('clearCache'),
  status: document.getElementById('status')
};

// ========================================
// 초기화
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadTokenUsage();
  await updateCacheInfo();
  setupEventListeners();
  setupTooltips();
});

// ========================================
// 설정 로드/저장
// ========================================
async function loadSettings() {
  const result = await chrome.storage.local.get(['targetLang', 'sourceLang', 'thinkingLevel']);

  // API 키는 난독화 모듈을 통해 조회
  const apiKey = await getApiKey();
  if (apiKey) elements.apiKey.value = apiKey;
  if (result.targetLang) elements.targetLang.value = result.targetLang;
  if (result.sourceLang) elements.sourceLang.value = result.sourceLang;
  if (result.thinkingLevel) elements.thinkingLevel.value = result.thinkingLevel;
}

async function handleSaveApiKey() {
  const key = elements.apiKey.value.trim();
  
  if (!key) {
    showStatus('API Key를 입력해주세요.', 'error');
    return;
  }
  
  // 간단한 형식 검증
  if (!key.startsWith('AI') && key.length < 30) {
    showStatus('올바른 API Key 형식이 아닙니다.', 'error');
    return;
  }
  
  // 난독화 모듈을 통해 저장 (XOR + Base64)
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
    thinkingLevel: elements.thinkingLevel.value
  };
  await chrome.storage.local.set(settings);
}

// ========================================
// 토큰 사용량
// ========================================
let tokenData = { today: { input: 0, output: 0 }, monthly: { input: 0, output: 0 } };

async function loadTokenUsage() {
  const result = await chrome.storage.local.get('tokenHistory');
  const history = result.tokenHistory || {};
  const today = new Date().toISOString().split('T')[0];
  
  // 오늘 사용량
  tokenData.today = history[today] || { input: 0, output: 0 };
  
  // 30일 사용량 계산
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  
  tokenData.monthly = Object.entries(history)
    .filter(([date]) => date >= cutoffStr)
    .reduce((acc, [, usage]) => ({
      input: acc.input + (usage.input || 0),
      output: acc.output + (usage.output || 0)
    }), { input: 0, output: 0 });
  
  // 초기 표시 (오늘)
  displayTokenUsage('today');
  
  // 탭 전환 이벤트
  setupUsageTabs();
}

function displayTokenUsage(tab) {
  const usage = tokenData[tab];
  elements.inputTokens.textContent = formatNumber(usage.input);
  elements.outputTokens.textContent = formatNumber(usage.output);
  elements.totalTokens.textContent = formatNumber(usage.input + usage.output);
  
  const cost = (usage.input * 0.50 / 1000000) + (usage.output * 3.00 / 1000000);
  document.getElementById('estimatedCost').textContent = `$${cost.toFixed(3)}`;
}

function setupUsageTabs() {
  const tabs = document.querySelectorAll('.usage-tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      displayTokenUsage(tab.dataset.tab);
    });
  });
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// ========================================
// 캐시 관리 고도화
// ========================================
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

/**
 * 바이트를 읽기 쉬운 단위로 변환
 */
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

  // DOM API 기반 생성 (XSS 방지)
  elements.cacheList.replaceChildren();
  list.forEach(item => {
    const cacheItem = document.createElement('div');
    cacheItem.className = 'cache-item';

    const infoMain = document.createElement('div');
    infoMain.className = 'cache-info-main';

    // 원본 videoId 추출 (언어 접미사 제거)
    const originalId = item.videoId.replace(/_[^_]+$/, '');
    const link = document.createElement('a');
    link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(originalId)}`;
    link.target = '_blank';
    link.className = 'cache-title';
    link.title = item.title;
    link.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'cache-meta';

    const dateSpan = document.createElement('span');
    dateSpan.textContent = `📅 ${new Date(item.timestamp).toLocaleDateString()}`;

    const langSpan = document.createElement('span');
    langSpan.textContent = `🌐 ${item.sourceLang} → ${item.targetLang}`;

    meta.append(dateSpan, langSpan);
    infoMain.append(link, meta);

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
    const success = await deleteFromCache(cacheKey);
    
    if (success) {
      // 동기화: 현재 탭이 삭제된 영상의 탭이라면 UI 초기화 메시지 전송 시도
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url?.includes('youtube.com')) {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'DELETE_CACHE', 
          payload: { videoId: cacheKey } 
        }).catch(() => {}); // 씹혀도 무관
      }

      showStatus('삭제되었습니다.', 'success');
      await updateCacheInfo();
    }
  } catch (err) {
    showStatus('삭제 실패', 'error');
  }
}

async function clearCacheAll() {
  if (!confirm('모든 번역 캐시를 삭제하시겠습니까?')) return;
  try {
    const success = await clearCache();
    if (success) {
      // 동기화: 현재 유튜브 탭 UI 초기화
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

// ========================================
// 이벤트 리스너
// ========================================
function setupEventListeners() {
  // API Key 보기/숨기기 토글
  elements.toggleVisibility.addEventListener('click', () => {
    const type = elements.apiKey.type === 'password' ? 'text' : 'password';
    elements.apiKey.type = type;
    elements.toggleVisibility.textContent = type === 'password' ? '👁️' : '🙈';
  });
  
  // API Key 저장
  elements.saveKey.addEventListener('click', handleSaveApiKey);
  
  // API Key 삭제
  elements.clearKey.addEventListener('click', handleClearApiKey);
  
  // 설정 변경 시 자동 저장
  elements.targetLang.addEventListener('change', saveSettings);
  elements.sourceLang.addEventListener('change', saveSettings);
  elements.thinkingLevel.addEventListener('change', saveSettings);
  
  // 캐시 삭제
  elements.clearCache.addEventListener('click', clearCacheAll);
  
  // Enter 키로 저장
  elements.apiKey.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSaveApiKey();
    }
  });
}

// ========================================
// 상태 메시지 표시
// ========================================
function showStatus(message, type) {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  
  // 3초 후 숨김
  setTimeout(() => {
    elements.status.className = 'status hidden';
  }, 3000);
}

// ========================================
// 툴팁 (JS 기반)
// ========================================
function setupTooltips() {
  let tooltipBox = null;
  
  document.querySelectorAll('.info-icon').forEach(icon => {
    icon.addEventListener('mouseenter', (e) => {
      const text = icon.getAttribute('data-tooltip');
      if (!text) return;
      
      // 기존 툴팁 제거
      if (tooltipBox) tooltipBox.remove();
      
      // 새 툴팁 생성
      tooltipBox = document.createElement('div');
      tooltipBox.className = 'tooltip-box';
      tooltipBox.textContent = text;
      document.body.appendChild(tooltipBox);
      
      // 위치 계산 (아이콘 바로 아래)
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
