import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findActiveTranslationIndex,
  projectTranslationSurfaceState,
} from './surface-state.ts';
import { CONTENT_UI_LABELS } from './ui-labels.ts';

test('projectTranslationSurfaceState prefers active task state over idle capability state', () => {
  const state = projectTranslationSurfaceState({
    capability: {
      transcriptButtonFound: true,
      panelFound: true,
      panelOpen: true,
      containerFound: true,
      segmentCount: 12,
    },
    controllerState: null,
    task: {
      taskId: 'task-1',
      videoId: 'video-1',
      phase: 'translation',
      status: 'running',
      completedChunks: 2,
      totalChunks: 5,
      attempt: null,
      translationsCount: null,
      translations: null,
      errorCode: null,
      message: 'Chunk 2 complete.',
      lastEventType: 'translation.progress',
      updatedAt: 100,
    },
  });

  assert.equal(state.panelVisible, true);
  assert.equal(state.tone, 'info');
  assert.equal(state.progressText, '2/5');
  assert.equal(state.detailText, 'Chunk 2 complete.');
});

test('projectTranslationSurfaceState exposes completed translations to the panel and overlay', () => {
  const translations = [
    { start: '0:01', text: 'hello' },
    { start: '0:03', text: 'world' },
  ];

  const state = projectTranslationSurfaceState({
    capability: {
      transcriptButtonFound: true,
      panelFound: true,
      panelOpen: true,
      containerFound: true,
      segmentCount: 12,
    },
    controllerState: null,
    task: {
      taskId: 'task-2',
      videoId: 'video-2',
      phase: 'translation',
      status: 'completed',
      completedChunks: 3,
      totalChunks: 3,
      attempt: null,
      translationsCount: 2,
      translations,
      errorCode: null,
      message: null,
      lastEventType: 'translation.completed',
      updatedAt: 200,
    },
  });

  assert.equal(state.overlayVisible, true);
  assert.equal(state.translations.length, 2);
  assert.equal(state.tone, 'success');
  assert.equal(state.exportEnabled, true);
  assert.equal(state.showRefineAction, true);
  assert.equal(state.refineEnabled, true);
});

test('projectTranslationSurfaceState exposes cached preview translations without an active task', () => {
  const state = projectTranslationSurfaceState({
    capability: {
      transcriptButtonFound: true,
      panelFound: true,
      panelOpen: true,
      containerFound: true,
      segmentCount: 12,
    },
    controllerState: {
      busy: false,
      openingTranscript: false,
      startingTranslation: false,
      startingRefine: false,
      cancellingTask: false,
      activeTaskId: null,
      statusMessage: null,
      lastCommandType: null,
      previewTranslations: [{ start: '0:01', text: 'cached line' }],
      previewSource: 'cache',
      previewIsRefined: false,
      hasCachedRecord: true,
    },
    task: null,
  });

  assert.equal(state.statusText, CONTENT_UI_LABELS.surface.cachedReady);
  assert.equal(state.overlayVisible, true);
  assert.equal(state.exportEnabled, true);
  assert.equal(state.importEnabled, false);
});

test('projectTranslationSurfaceState disables refine when the visible result is already refined', () => {
  const state = projectTranslationSurfaceState({
    capability: {
      transcriptButtonFound: true,
      panelFound: true,
      panelOpen: true,
      containerFound: true,
      segmentCount: 12,
    },
    controllerState: null,
    task: {
      taskId: 'task-3',
      videoId: 'video-3',
      phase: 'refine',
      status: 'completed',
      completedChunks: null,
      totalChunks: null,
      attempt: null,
      translationsCount: 1,
      translations: [{ start: '0:01', text: 'refined line' }],
      errorCode: null,
      message: null,
      lastEventType: 'refine.completed',
      updatedAt: 300,
    },
  });

  assert.equal(state.showRefineAction, true);
  assert.equal(state.refineEnabled, false);
  assert.equal(state.refineLabel, 'Refined');
});

test('projectTranslationSurfaceState keeps import available when only a hidden partial cache exists', () => {
  const state = projectTranslationSurfaceState({
    capability: {
      transcriptButtonFound: true,
      panelFound: true,
      panelOpen: true,
      containerFound: true,
      segmentCount: 12,
    },
    controllerState: {
      busy: false,
      openingTranscript: false,
      startingTranslation: false,
      startingRefine: false,
      cancellingTask: false,
      activeTaskId: null,
      statusMessage:
        'A partial cached translation is available. Turn on Resume mode to continue it, or import a new JSON bundle.',
      lastCommandType: null,
      previewTranslations: [],
      previewSource: 'none',
      previewIsRefined: false,
      hasCachedRecord: true,
    },
    task: null,
  });

  assert.equal(state.importEnabled, true);
  assert.equal(
    state.statusText,
    'A partial cached translation is available. Turn on Resume mode to continue it, or import a new JSON bundle.',
  );
});

test('findActiveTranslationIndex follows the current playback time', () => {
  const translations = [
    { start: '0:01', text: 'hello' },
    { start: '0:05', text: 'world' },
    { start: '0:10', text: 'again' },
  ];

  assert.equal(findActiveTranslationIndex(0, translations), -1);
  assert.equal(findActiveTranslationIndex(4.5, translations), 0);
  assert.equal(findActiveTranslationIndex(10.1, translations), 2);
});
