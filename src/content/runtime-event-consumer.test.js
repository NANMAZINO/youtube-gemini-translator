import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInitialRuntimeTaskProjection,
  createRuntimeEventConsumer,
  getLatestTaskView,
  projectRuntimeEvent,
} from './runtime-event-consumer.ts';

test('projectRuntimeEvent tracks translation progress and completion', () => {
  let projection = createInitialRuntimeTaskProjection();

  projection = projectRuntimeEvent(
    projection,
    {
      kind: 'runtime.event',
      type: 'translation.progress',
      payload: {
        taskId: 'task-1',
        videoId: 'video-1',
        completedChunks: 1,
        totalChunks: 3,
        message: 'Chunk 1 complete.',
      },
    },
    100,
  );

  let latestTask = getLatestTaskView(projection);
  assert.equal(latestTask?.phase, 'translation');
  assert.equal(latestTask?.status, 'running');
  assert.equal(latestTask?.completedChunks, 1);
  assert.equal(latestTask?.totalChunks, 3);
  assert.equal(latestTask?.message, 'Chunk 1 complete.');
  assert.equal(latestTask?.updatedAt, 100);

  projection = projectRuntimeEvent(
    projection,
    {
      kind: 'runtime.event',
      type: 'translation.completed',
      payload: {
        taskId: 'task-1',
        videoId: 'video-1',
        translations: [
          { start: '0:01', text: 'hello' },
          { start: '0:02', text: 'world' },
        ],
      },
    },
    200,
  );

  latestTask = getLatestTaskView(projection);
  assert.equal(latestTask?.status, 'completed');
  assert.equal(latestTask?.translationsCount, 2);
  assert.equal(latestTask?.translations?.length, 2);
  assert.equal(latestTask?.completedChunks, 1);
  assert.equal(latestTask?.message, 'Completed 2 translated segments.');
  assert.equal(latestTask?.updatedAt, 200);
});

test('projectRuntimeEvent normalizes refine retry and failure states', () => {
  let projection = createInitialRuntimeTaskProjection();

  projection = projectRuntimeEvent(projection, {
    kind: 'runtime.event',
    type: 'translation.retrying',
    payload: {
      taskId: 'task-2',
      videoId: 'video-2',
      phase: 'refine',
      attempt: 2,
      message: 'MODEL_OVERLOADED',
    },
  });

  projection = projectRuntimeEvent(projection, {
    kind: 'runtime.event',
    type: 'refine.failed',
    payload: {
      taskId: 'task-2',
      videoId: 'video-2',
      code: 'REFINE_FAILED',
      message: 'Retry budget exceeded.',
    },
  });

  const latestTask = getLatestTaskView(projection);
  assert.equal(latestTask?.phase, 'refine');
  assert.equal(latestTask?.status, 'failed');
  assert.equal(latestTask?.attempt, 2);
  assert.equal(latestTask?.errorCode, 'REFINE_FAILED');
  assert.equal(latestTask?.message, 'Retry budget exceeded.');
});

test('createRuntimeEventConsumer ignores unrelated messages and publishes updates', () => {
  const updates = [];
  const finishes = [];
  const consumer = createRuntimeEventConsumer({
    onTaskUpdated(task) {
      updates.push(task);
    },
    onTaskFinished(task) {
      finishes.push(task);
    },
  });

  assert.equal(consumer.handleMessage({ kind: 'other.event' }), false);
  assert.equal(updates.length, 0);

  consumer.handleMessage({
    kind: 'runtime.event',
    type: 'translation.cancelled',
    payload: {
      taskId: 'task-3',
      videoId: 'video-3',
    },
  });

  assert.equal(updates.length, 1);
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0].status, 'cancelled');
});
