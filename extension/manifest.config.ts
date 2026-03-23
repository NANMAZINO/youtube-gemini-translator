const manifest = {
  manifest_version: 3,
  name: 'YouTube AI Translator',
  description: 'Context-aware YouTube caption translation powered by Gemini.',
  version: '3.0.0',
  permissions: ['activeTab', 'storage', 'scripting', 'unlimitedStorage'],
  host_permissions: [
    'https://www.youtube.com/*',
    'https://generativelanguage.googleapis.com/*',
  ],
  background: {
    service_worker: 'extension/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://www.youtube.com/*'],
      js: ['extension/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  action: {
    default_popup: 'extension/popup/index.html',
    default_title: 'YouTube AI Translator',
  },
} satisfies chrome.runtime.ManifestV3;

export default manifest;
