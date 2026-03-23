export const UI_ICONS = Object.freeze({
  transcriptOpen: '📜',
  translate: '🤖',
  refine: '✂️',
  panel: '📑',
  pin: '📌',
  export: '📤',
  import: '📥',
  close: '✕',
  success: '✅',
});

export const UI_LABELS = Object.freeze({
  transcriptOpen: `${UI_ICONS.transcriptOpen} 스크립트 열기`,
  translate: `${UI_ICONS.translate} AI 번역`,
  refine: `${UI_ICONS.refine} 재분할`,
  refineDone: `${UI_ICONS.success} 재분할 완료`,
  panelClosed: UI_ICONS.panel,
  panelOpen: `${UI_ICONS.close} 닫기`,
  title: `${UI_ICONS.translate} AI 번역 스크립트`,
});
