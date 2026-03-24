import assert from 'node:assert/strict';
import test from 'node:test';

import { createPreviewController } from './preview-controller.ts';
import { getContentUiLabels } from '../shared/ui-copy.ts';

test('preview controller refreshes localized status messages after locale changes', async () => {
  let locale = 'en';
  const controller = createPreviewController({
    getLabels: () => getContentUiLabels(locale),
  });

  await controller.cancelActiveTask(null);
  assert.equal(
    controller.getState().statusMessage,
    'There is no active task to cancel.',
  );

  locale = 'ko';

  assert.equal(controller.refreshLocalizedStatusMessage(), true);
  assert.equal(controller.getState().statusMessage, '취소할 활성 작업이 없습니다.');
});
