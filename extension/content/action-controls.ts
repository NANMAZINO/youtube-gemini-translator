import type { TranscriptDomCapability } from '../adapters/youtube/transcript-dom.ts';
import type { PreviewControllerState } from './preview-controller.ts';
import {
  isTerminalTaskStatus,
  type RuntimeTaskViewState,
} from './runtime-event-consumer.ts';
import { CONTENT_UI_LABELS } from './ui-labels.ts';
import type { ContentUiLabels } from '../shared/ui-copy.ts';
import type { ResolvedTheme } from '../shared/contracts/index.ts';
import {
  formatTaskProgress as formatLocalizedTaskProgress,
  getTaskDetailText,
} from './task-copy.ts';

const FLOATING_ACTION_HOST_ID = 'yt-ai-open-transcript-host';
const WATCH_ACTION_TARGET_SELECTORS = [
  'ytd-menu-renderer.ytd-watch-metadata #top-level-buttons-computed',
  '#top-level-buttons-computed',
  '#top-row.ytd-watch-metadata #owner',
] as const;

interface ActionButtonElements {
  host: HTMLDivElement;
  button: HTMLButtonElement;
}



export interface ContentActionState {
  showFloatingAction: boolean;
  floatingLabel: string;
  floatingDisabled: boolean;
  showPanelActions: boolean;
  translateLabel: string;
  translateDisabled: boolean;
  showCancelAction: boolean;
  cancelLabel: string;
  cancelDisabled: boolean;
  helperText: string | null;
}

interface ProjectContentActionStateInput {
  capability: TranscriptDomCapability | null;
  controllerState: PreviewControllerState | null;
  task: RuntimeTaskViewState | null;
}

interface ContentActionControlsOptions {
  onOpenTranscript: () => void;
  onStartTranslation: () => void;
  onCancelTask: (task: RuntimeTaskViewState | null) => void;
  getLabels: () => ContentUiLabels;
  getResolvedTheme: () => ResolvedTheme;
  /** Translation surface 내부의 Translate/Cancel 요소 접근용 콜백 */
  getSurfaceActionElements: () => {
    translateButton: HTMLButtonElement;
    cancelButton: HTMLButtonElement;
  } | null;
}

function formatTaskProgress(task: RuntimeTaskViewState) {
  return formatLocalizedTaskProgress(task, CONTENT_UI_LABELS);
}

function resolveHelperText(
  capability: TranscriptDomCapability | null,
  controllerState: PreviewControllerState | null,
  task: RuntimeTaskViewState | null,
  labels: ContentUiLabels,
) {
  if (controllerState?.statusMessage) {
    return controllerState.statusMessage;
  }

  if (task) {
    switch (task.status) {
      case 'running':
      case 'retrying':
      case 'preparing':
        return getTaskDetailText(task, labels) || formatLocalizedTaskProgress(task, labels);

      case 'failed':
      case 'cancelled':
        return getTaskDetailText(task, labels) || labels.controls.idleHint;

      case 'completed':
        return labels.controls.completedHint;

      case 'idle':
        break;
    }
  }

  if (capability?.panelOpen) {
    return labels.controls.readyHint;
  }

  return labels.controls.openHint;
}

export function projectContentActionState(
  input: ProjectContentActionStateInput,
  labels: ContentUiLabels = CONTENT_UI_LABELS,
): ContentActionState {
  const { capability, controllerState, task } = input;
  const activeTask = !!task && !isTerminalTaskStatus(task.status);

  return {
    showFloatingAction: !capability?.panelOpen,
    floatingLabel: controllerState?.openingTranscript
      ? labels.controls.openingTranscript
      : labels.controls.openTranscript,
    floatingDisabled: !!controllerState?.busy,
    showPanelActions: !!capability?.panelOpen,
    translateLabel: controllerState?.startingTranslation
      ? labels.controls.startingTranslation
      : activeTask
        ? labels.controls.translating
        : task?.status === 'completed'
          ? labels.controls.translateAgain
          : labels.controls.translate,
    translateDisabled: !!controllerState?.busy || activeTask,
    showCancelAction: !!capability?.panelOpen && (activeTask || !!controllerState?.cancellingTask),
    cancelLabel: controllerState?.cancellingTask
      ? labels.controls.cancelling
      : labels.controls.cancel,
    cancelDisabled: !activeTask || !!controllerState?.cancellingTask,
    helperText: resolveHelperText(capability, controllerState, task, labels),
  };
}

function findFloatingActionTarget() {
  for (const selector of WATCH_ACTION_TARGET_SELECTORS) {
    const target = document.querySelector(selector);
    if (target instanceof HTMLElement && target.offsetHeight > 0) {
      return target;
    }
  }

  return null;
}

function createActionButtonHost(hostId: string) {
  const host = document.createElement('div');
  host.id = hostId;
  host.style.display = 'inline-block';
  host.style.verticalAlign = 'middle';
  host.style.marginLeft = '8px';
  host.style.pointerEvents = 'auto';

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      .action-btn {
        border: none;
        border-radius: 999px;
        min-height: 36px;
        padding: 0 16px;
        background: #065fd4;
        color: #fff;
        font: 500 14px/36px 'Roboto', 'Arial', sans-serif;
        cursor: pointer;
        transition:
          opacity 160ms ease,
          transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .action-btn:hover:enabled {
        opacity: 0.85;
      }

      .action-btn:active:enabled {
        transform: scale(0.96);
      }

      .action-btn:focus-visible {
        outline: 2px solid #065fd4;
        outline-offset: 2px;
      }

      .action-btn:disabled {
        cursor: default;
        opacity: 0.5;
        transform: none;
      }

      :host([data-theme="dark"]) .action-btn {
        background: #3ea6ff;
        color: #0f0f0f;
      }

      :host([data-theme="dark"]) .action-btn:hover:enabled {
        opacity: 0.88;
      }

      @media (prefers-reduced-motion: reduce) {
        .action-btn {
          transition-duration: 0.01ms !important;
        }
      }
    </style>
    <button class="action-btn" type="button" data-role="button"></button>
  `;

  const button = shadow.querySelector('[data-role="button"]');
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Failed to initialize action button controls.');
  }

  return { host, button };
}

function ensureFloatingActionElements(theme: ResolvedTheme) {
  let host = document.getElementById(FLOATING_ACTION_HOST_ID) as HTMLDivElement | null;
  let button: HTMLButtonElement | null = null;

  if (!host || !host.shadowRoot) {
    const elements = createActionButtonHost(FLOATING_ACTION_HOST_ID);
    host = elements.host;
    button = elements.button;
  } else {
    button = host.shadowRoot.querySelector('[data-role="button"]');
  }

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Floating action button is unavailable.');
  }

  host.dataset.theme = theme;

  return {
    host,
    button,
  } satisfies ActionButtonElements;
}



export function createContentActionControls(
  options: ContentActionControlsOptions,
) {
  function renderFloatingAction(state: ContentActionState) {
    const target = findFloatingActionTarget();

    if (!state.showFloatingAction || !(target instanceof HTMLElement)) {
      document.getElementById(FLOATING_ACTION_HOST_ID)?.remove();
      return;
    }

    const elements = ensureFloatingActionElements(options.getResolvedTheme());
    if (elements.host.parentElement !== target) {
      target.appendChild(elements.host);
    }

    elements.button.textContent = state.floatingLabel;
    elements.button.disabled = state.floatingDisabled;
    elements.button.title = state.helperText ?? '';
    elements.button.onclick = () => {
      void options.onOpenTranscript();
    };
  }

  function renderPanelActions(
    state: ContentActionState,
    task: RuntimeTaskViewState | null,
  ) {
    if (!state.showPanelActions) {
      return;
    }

    const elements = options.getSurfaceActionElements();
    if (!elements) {
      return;
    }

    elements.translateButton.textContent = state.translateLabel;
    elements.translateButton.disabled = state.translateDisabled;
    elements.translateButton.hidden = false;
    elements.translateButton.onclick = () => {
      void options.onStartTranslation();
    };

    elements.cancelButton.hidden = !state.showCancelAction;
    elements.cancelButton.textContent = state.cancelLabel;
    elements.cancelButton.disabled = state.cancelDisabled;
    elements.cancelButton.onclick = () => {
      void options.onCancelTask(task);
    };
  }

  return {
    render(input: ProjectContentActionStateInput) {
      const state = projectContentActionState(input, options.getLabels());
      renderFloatingAction(state);
      renderPanelActions(state, input.task);
    },
  };
}
