import { normalizeTranscript } from '../../domain/transcript/normalize.ts';
import type { TranscriptSegment } from '../../shared/contracts/index.ts';
import {
  findTranscriptPanel,
  getTranscriptSegmentElements,
  getTranscriptSegmentText,
  getTranscriptSegmentTimestamp,
} from './transcript-dom.ts';

interface ExtractTranscriptOptions {
  root?: ParentNode;
  waitForSegmentsMs?: number;
}

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function mapTranscriptSegments(panel: ParentNode | null) {
  const segmentElements = getTranscriptSegmentElements(panel);

  return segmentElements
    .map<TranscriptSegment>((element, index) => ({
      id: `segment-${index + 1}`,
      start: getTranscriptSegmentTimestamp(element),
      text: getTranscriptSegmentText(element),
    }))
    .filter((segment) => segment.text.trim() !== '');
}

export async function extractTranscriptSegments(
  options: ExtractTranscriptOptions = {},
) {
  const root = options.root ?? document;
  const waitForSegmentsMs = options.waitForSegmentsMs ?? 1000;
  const panel = findTranscriptPanel(root);

  if (!panel) {
    return [];
  }

  let segments = mapTranscriptSegments(panel);
  if (segments.length === 0 && waitForSegmentsMs > 0) {
    await sleep(waitForSegmentsMs);
    segments = mapTranscriptSegments(panel);
  }

  return segments;
}

export async function extractNormalizedTranscript(
  options: ExtractTranscriptOptions = {},
) {
  const segments = await extractTranscriptSegments(options);
  return normalizeTranscript(segments);
}
