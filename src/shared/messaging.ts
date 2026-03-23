import type {
  CommandFailure,
  CommandSuccess,
  RebuildPageMessage,
  RuntimeCommand,
  RuntimeCommandMap,
  RuntimeCommandResult,
  RuntimeCommandType,
} from './contracts/index.ts';

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export function isRebuildCommand(value: unknown): value is RuntimeCommand {
  return (
    isObject(value) &&
    value.kind === 'rebuild.command' &&
    typeof value.type === 'string'
  );
}

export function isRebuildPageMessage(value: unknown): value is RebuildPageMessage {
  if (
    !isObject(value) ||
    value.kind !== 'rebuild.page' ||
    typeof value.type !== 'string'
  ) {
    return false;
  }

  if (value.type === 'cache.clear') {
    return true;
  }

  return (
    value.type === 'cache.delete' &&
    isObject(value.payload) &&
    typeof value.payload.cacheKey === 'string'
  );
}

export function createSuccess<T extends RuntimeCommandType>(
  type: T,
  data: RuntimeCommandMap[T]['response'],
): CommandSuccess<T> {
  return {
    ok: true,
    kind: 'rebuild.command.result',
    type,
    data,
  };
}

export function createFailure<T extends RuntimeCommandType>(
  type: T,
  code: string,
  message: string,
): CommandFailure<T> {
  return {
    ok: false,
    kind: 'rebuild.command.result',
    type,
    error: {
      code,
      message,
    },
  };
}

export async function sendCommand<T extends RuntimeCommandType>(
  command: RuntimeCommand<T>,
): Promise<RuntimeCommandResult<T>> {
  const response = await chrome.runtime.sendMessage(command);

  if (
    !isObject(response) ||
    response.kind !== 'rebuild.command.result' ||
    response.type !== command.type ||
    typeof response.ok !== 'boolean'
  ) {
    throw new Error(`Unexpected response for ${command.type}`);
  }

  return response as unknown as RuntimeCommandResult<T>;
}
