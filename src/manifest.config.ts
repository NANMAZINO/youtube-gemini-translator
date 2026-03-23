const manifest = {
  manifest_version: 3,
  name: 'YouTube AI Translator',
  description: 'Context-aware YouTube caption translation powered by Gemini.',
  version: '2.2.0',
  permissions: ['activeTab', 'storage', 'scripting', 'unlimitedStorage'],
  host_permissions: [
    'https://www.youtube.com/*',
    'https://generativelanguage.googleapis.com/*',
  ],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://www.youtube.com/*'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'YouTube AI Translator',
  },
} satisfies chrome.runtime.ManifestV3;

export default manifest;
