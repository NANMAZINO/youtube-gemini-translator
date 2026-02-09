// YouTube AI Translator - Popup Script
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
  const result = await chrome.storage.local.get(['apiKey', 'targetLang', 'sourceLang', 'thinkingLevel']);
  
  if (result.apiKey) elements.apiKey.value = result.apiKey;
  if (result.targetLang) elements.targetLang.value = result.targetLang;
  if (result.sourceLang) elements.sourceLang.value = result.sourceLang;
  if (result.thinkingLevel) elements.thinkingLevel.value = result.thinkingLevel;
}

async function saveApiKey() {
  const apiKey = elements.apiKey.value.trim();
  
  if (!apiKey) {
    showStatus('API Key를 입력해주세요.', 'error');
    return;
  }
  
  // 간단한 형식 검증
  if (!apiKey.startsWith('AI') && apiKey.length < 30) {
    showStatus('올바른 API Key 형식이 아닙니다.', 'error');
    return;
  }
  
  await chrome.storage.local.set({ apiKey });
  showStatus('API Key가 저장되었습니다.', 'success');
}

async function clearApiKey() {
  await chrome.storage.local.remove('apiKey');
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes('youtube.com')) {
      elements.cacheCount.textContent = '-';
      elements.cacheSize.textContent = '0 KB';
      return;
    }
    
    // 캐시 개수 및 용량 병렬 로드
    const [countRes, sizeRes] = await Promise.all([
      chrome.tabs.sendMessage(tab.id, { type: 'GET_CACHE_COUNT' }),
      chrome.tabs.sendMessage(tab.id, { type: 'GET_CACHE_SIZE' })
    ]);
    
    elements.cacheCount.textContent = countRes?.count ?? 0;
    elements.cacheSize.textContent = formatBytes(sizeRes?.size ?? 0);
  } catch {
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes('youtube.com')) return;
    
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_ALL_CACHE' });
    renderCacheList(response?.list || []);
  } catch (err) {
    // content script 미로드 시 발생하는 에러는 무시 (정상 동작)
    if (err.message?.includes('Receiving end does not exist')) return;
    console.error('[Popup] Fail to load cache list:', err);
  }
}

function renderCacheList(list) {
  if (!list || list.length === 0) {
    elements.cacheList.innerHTML = '<p class="empty-msg">저장된 번역 내역이 없습니다.</p>';
    return;
  }

  elements.cacheList.innerHTML = list.map(item => `
    <div class="cache-item">
      <div class="cache-info-main">
        <a href="https://www.youtube.com/watch?v=${item.videoId}" target="_blank" class="cache-title" title="${item.title}">
          ${item.title}
        </a>
        <div class="cache-meta">
          <span>📅 ${new Date(item.timestamp).toLocaleDateString()}</span>
          <span>🌐 ${item.sourceLang} → ${item.targetLang}</span>
        </div>
      </div>
      <button class="btn-del" data-id="${item.videoId}" title="삭제">🗑️</button>
    </div>
  `).join('');

  // 삭제 버튼 이벤트 바인딩
  elements.cacheList.querySelectorAll('.btn-del').forEach(btn => {
    btn.onclick = (e) => {
      const videoId = e.currentTarget.dataset.id;
      handleIndividualDelete(videoId);
    };
  });
}

async function handleIndividualDelete(videoId) {
  if (!confirm('이 번역 내역을 삭제할까요?')) return;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { 
      type: 'DELETE_CACHE', 
      payload: { videoId } 
    });
    
    if (response?.success) {
      showStatus('삭제되었습니다.', 'success');
      await updateCacheInfo();
    }
  } catch (err) {
    showStatus('삭제 실패', 'error');
  }
}

async function clearCache() {
  if (!confirm('모든 번역 캐시를 삭제하시겠습니까?')) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes('youtube.com')) {
      showStatus('YouTube 페이지에서 실행해주세요.', 'error');
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_CACHE' });
    if (response?.success) {
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
  elements.saveKey.addEventListener('click', saveApiKey);
  
  // API Key 삭제
  elements.clearKey.addEventListener('click', clearApiKey);
  
  // 설정 변경 시 자동 저장
  elements.targetLang.addEventListener('change', saveSettings);
  elements.sourceLang.addEventListener('change', saveSettings);
  elements.thinkingLevel.addEventListener('change', saveSettings);
  
  // 캐시 삭제
  elements.clearCache.addEventListener('click', clearCache);
  
  // Enter 키로 저장
  elements.apiKey.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveApiKey();
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
