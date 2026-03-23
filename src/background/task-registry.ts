import type { TaskPhase, TranslationTask } from '../shared/contracts/index.ts';

export interface ActiveTaskRecord {
  task: TranslationTask;
  abortController: AbortController;
  tabId?: number;
}

interface StartTaskOptions {
  videoId: string;
  phase: TaskPhase;
  sourceLang?: TranslationTask['sourceLang'];
  targetLang?: TranslationTask['targetLang'];
  tabId?: number | null;
}

let taskCounter = 0;

function createTaskId(phase: TaskPhase) {
  taskCounter += 1;
  return `${phase}-${Date.now()}-${taskCounter}`;
}

function updateTaskTimestamp(task: TranslationTask) {
  task.updatedAt = Date.now();
}

export class TaskRegistry {
  #activeTasks = new Map<string, ActiveTaskRecord>();
  #tabTasks = new Map<number, string>();

  register(task: TranslationTask, tabId?: number) {
    const abortController = new AbortController();
    const record: ActiveTaskRecord = { task, abortController, tabId };

    if (typeof tabId === 'number') {
      const previousTaskId = this.#tabTasks.get(tabId);
      if (previousTaskId) {
        this.cancel(previousTaskId);
      }

      this.#tabTasks.set(tabId, task.taskId);
    }

    this.#activeTasks.set(task.taskId, record);
    return record;
  }

  startTask(options: StartTaskOptions) {
    const now = Date.now();
    const task: TranslationTask = {
      taskId: createTaskId(options.phase),
      videoId: options.videoId,
      phase: options.phase,
      status: 'preparing',
      sourceLang: options.sourceLang,
      targetLang: options.targetLang,
      startedAt: now,
      updatedAt: now,
    };

    const record = this.register(
      task,
      typeof options.tabId === 'number' ? options.tabId : undefined,
    );

    return {
      task: { ...record.task },
      signal: record.abortController.signal,
    };
  }

  get(taskId: string) {
    return this.#activeTasks.get(taskId) ?? null;
  }

  getByTab(tabId: number) {
    const taskId = this.#tabTasks.get(tabId);
    return taskId ? this.get(taskId) : null;
  }

  isActive(taskId: string) {
    const record = this.get(taskId);
    return !!record && !record.abortController.signal.aborted;
  }

  setStatus(taskId: string, status: TranslationTask['status']) {
    const record = this.get(taskId);
    if (!record) return null;

    record.task.status = status;
    updateTaskTimestamp(record.task);
    return record.task;
  }

  updateTaskStatus(taskId: string, status: TranslationTask['status']) {
    const task = this.setStatus(taskId, status);
    return task ? { ...task } : null;
  }

  cancel(taskId: string) {
    const record = this.get(taskId);
    if (!record) return false;

    record.abortController.abort();
    updateTaskTimestamp(record.task);
    return true;
  }

  cancelTask(taskId: string, _reason?: string) {
    return this.cancel(taskId);
  }

  cancelForTab(tabId: number) {
    const record = this.getByTab(tabId);
    if (!record) return false;

    record.abortController.abort();
    updateTaskTimestamp(record.task);
    return true;
  }

  cancelTasksForTab(tabId: number, _reason?: string) {
    return this.cancelForTab(tabId);
  }

  clear(taskId: string) {
    const record = this.get(taskId);
    if (!record) return false;

    this.#activeTasks.delete(taskId);

    if (
      typeof record.tabId === 'number' &&
      this.#tabTasks.get(record.tabId) === taskId
    ) {
      this.#tabTasks.delete(record.tabId);
    }

    return true;
  }

  finalizeTask(taskId: string) {
    return this.clear(taskId);
  }

  getSignal(taskId: string) {
    return this.get(taskId)?.abortController.signal;
  }
}
