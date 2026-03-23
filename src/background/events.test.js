import assert from 'node:assert/strict';
import test from 'node:test';

import { createRuntimeEvent, emitRuntimeEvent } from './events.ts';

test('emitRuntimeEvent forwards the explicit sender when using the options overload', async () => {
  const calls = [];

  const sent = await emitRuntimeEvent(
    {
      tabId: 17,
      type: 'translation.progress',
      payload: {
        taskId: 'task-1',
        videoId: 'video-1',
        completedChunks: 1,
        totalChunks: 2,
      },
    },
    async (tabId, event) => {
      calls.push({ tabId, event });
      return true;
    },
  );

  assert.equal(sent, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tabId, 17);
  assert.equal(calls[0].event.kind, 'runtime.event');
  assert.equal(calls[0].event.type, 'translation.progress');
});

test('emitRuntimeEvent returns false when no tab id is available', async () => {
  const sent = await emitRuntimeEvent(
    createRuntimeEvent('translation.cancelled', {
      taskId: 'task-2',
      videoId: 'video-2',
    }),
    async () => {
      throw new Error('should not be called');
    },
  );

  assert.equal(sent, false);
});
