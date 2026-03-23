import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

const FIXTURE_DIRECTORY = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '__fixtures__',
);

const DOM_GLOBAL_KEYS = [
  'window',
  'document',
  'Node',
  'Element',
  'HTMLElement',
  'MutationObserver',
  'Document',
];

function installDomGlobals(window) {
  const previous = new Map();
  const existingKeys = new Set();

  DOM_GLOBAL_KEYS.forEach((key) => {
    if (key in globalThis) {
      existingKeys.add(key);
      previous.set(key, globalThis[key]);
    }
  });

  Object.assign(globalThis, {
    window,
    document: window.document,
    Node: window.Node,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    MutationObserver: window.MutationObserver,
    Document: window.Document,
  });

  return () => {
    DOM_GLOBAL_KEYS.forEach((key) => {
      if (existingKeys.has(key)) {
        globalThis[key] = previous.get(key);
        return;
      }

      delete globalThis[key];
    });
  };
}

export function setElementOffsetHeight(element, height) {
  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    get() {
      return height;
    },
  });
}

export async function createTranscriptFixtureEnvironment(fixtureName) {
  const html = await readFile(
    path.join(FIXTURE_DIRECTORY, fixtureName),
    'utf8',
  );
  const dom = new JSDOM(html, {
    url: 'https://www.youtube.com/watch?v=fixture-video',
  });
  const restore = installDomGlobals(dom.window);

  return {
    window: dom.window,
    document: dom.window.document,
    cleanup() {
      restore();
      dom.window.close();
    },
  };
}
