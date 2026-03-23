import assert from 'node:assert/strict';
import test from 'node:test';

import { projectContentActionState } from './action-controls.ts';
import { CONTENT_UI_LABELS } from './ui-labels.ts';

test('projectContentActionState exposes the floating transcript action when the panel is closed', () => {
  const state = projectContentActionState({
    capability: {
      transcriptButtonFound: false,
      panelFound: false,
      panelOpen: false,
      containerFound: false,
      segmentCount: 0,
    },
    controllerState: null,
    task: null,
  });

  assert.equal(state.showFloatingAction, true);
  assert.equal(state.showPanelActions, false);
  assert.equal(state.floatingLabel, 'Open Transcript');
  assert.equal(state.helperText, CONTENT_UI_LABELS.controls.openHint);
});

test('projectContentActionState disables translate and exposes cancel while a task is active', () => {
  const state = projectContentActionState({
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
      completedChunks: 1,
      totalChunks: 3,
      attempt: null,
      translationsCount: null,
      translations: null,
      errorCode: null,
      message: 'Chunk 1 complete.',
      lastEventType: 'translation.progress',
      updatedAt: 100,
    },
  });

  assert.equal(state.showFloatingAction, false);
  assert.equal(state.showPanelActions, true);
  assert.equal(state.translateLabel, 'Translating...');
  assert.equal(state.translateDisabled, true);
  assert.equal(state.showCancelAction, true);
  assert.equal(state.cancelDisabled, false);
  assert.equal(state.helperText, 'Chunk 1 complete.');
});

test('projectContentActionState offers rerun copy after completion', () => {
  const state = projectContentActionState({
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
      translationsCount: 18,
      translations: [{ start: '0:01', text: 'hello' }],
      errorCode: null,
      message: 'Completed 18 translated segments.',
      lastEventType: 'translation.completed',
      updatedAt: 200,
    },
  });

  assert.equal(state.translateLabel, 'Translate Again');
  assert.equal(state.translateDisabled, false);
  assert.equal(state.showCancelAction, false);
  assert.equal(state.helperText, CONTENT_UI_LABELS.controls.completedHint);
});
