// The document a spec file runs in, and the page around it. As under Vitest, the document is a frame
// of a host page, at Vitest's size. It is always the build's hidden runner story, which renders
// nothing: a test mounts into the frame's `<body>` itself, so no story's markup reaches a DOM, ARIA
// or axe check, and no test opens a corpus story.
import { VIEWPORT } from "../node/viewport.ts";

/** The path a static build's server answers with {@link HOST_HTML}. */
export const HOST_PATH = "/__uf-host.html";

/** The hidden story's id: `RUNNER_STORY` in `@unframework/visual`, which sits above this package. */
export const RUNNER_STORY_ID = "uf-runner--spec";

/** What the frame opens. A build that isn't a Storybook answers it with an `iframe.html` too. */
export const RUNNER_PATH: string = `/iframe.html?id=${RUNNER_STORY_ID}&viewMode=story`;

/** The global a runner document sets: `RUN_SPEC` in `@unframework/visual`. */
export const RUN_SPEC_GLOBAL = "__ufRunSpec";

/**
 * Vitest's name for its frame, which a Playwright timeout's call log prints and L8 records: the
 * host keeps it, so that text stays the same.
 */
export const FRAME_SELECTOR = '[data-vitest="true"]';

/** The host page: Vitest's orchestrator document and frame (`@vitest/browser`), with no script. */
export const HOST_HTML: string = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Spec host</title>
    <style>
      html { overflow: hidden; padding: 0; margin: 0; }
      body { padding: 0; margin: 0; }
      html, body, #uf-tester { width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="uf-tester"><iframe data-vitest="true" name="vitest-iframe" loading="eager" allowfullscreen allow="clipboard-write;" src="${RUNNER_PATH}" style="border: none; background-color: #fff; width: ${VIEWPORT.width}px; height: ${VIEWPORT.height}px"></iframe></div>
  </body>
</html>
`;

/** The part of a Playwright page opening the host needs. */
export interface HostPage {
  goto(url: string, options: { timeout: number }): Promise<unknown>;
}

/** Opens the host page, whose frame opens the runner story. */
export async function openHostPage(page: HostPage, origin: string, timeout: number): Promise<void> {
  await page.goto(`${origin}${HOST_PATH}`, { timeout });
}
