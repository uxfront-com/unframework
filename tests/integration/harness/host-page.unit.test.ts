// Storybook's markup stays out of the checks, since no test opens a corpus story. Static, with
// no browser, since the `harness` project runs in `Integration: compile`: every URL the driver goes
// to, and the one the host page's frame opens. The stub spec `stub/match` asserts at run time that
// a view's root sits directly in the `<body>`, and `matrix-diff` compares DOM, ARIA and axe on a
// real run.
import {
  FRAME_SELECTOR,
  HOST_HTML,
  HOST_PATH,
  openHostPage,
  RUN_SPEC_GLOBAL,
  RUNNER_PATH,
  RUNNER_STORY_ID,
} from "@unframework/testing/driver/host";
import { RUN_SPEC, RUNNER_STORY } from "@unframework/visual";
import { describe, expect, it } from "vitest";

import { listCases } from "./cases.ts";
import { targetStories } from "./storybook.ts";

/** Every URL in the host page's text. */
function framedUrls(html: string): string[] {
  return [...html.matchAll(/\bsrc="([^"]*)"/g)].map((match) => match[1]!);
}

describe("the document a spec runs in", () => {
  it("is the hidden runner story of `@unframework/visual`, under the same names", () => {
    expect(RUNNER_STORY_ID).toBe(RUNNER_STORY);
    expect(RUN_SPEC_GLOBAL).toBe(RUN_SPEC);
  });

  it("is what the host page's only frame opens", () => {
    expect(framedUrls(HOST_HTML)).toEqual([RUNNER_PATH]);
    expect(new URL(RUNNER_PATH, "http://uf.test").searchParams.get("id")).toBe(RUNNER_STORY);
    expect(HOST_HTML).not.toContain("<script");
    expect(HOST_HTML.match(/<iframe/g)).toHaveLength(1);
    expect(FRAME_SELECTOR).toBe('[data-vitest="true"]');
  });

  it("is what a driver opens, through a stub page", async () => {
    const urls: string[] = [];
    await openHostPage(
      {
        goto: (url) => {
          urls.push(url);
          return Promise.resolve();
        },
      },
      "http://uf.test",
      1_000,
    );
    expect(urls).toEqual([`http://uf.test${HOST_PATH}`]);
  });

  it("opens no corpus story", () => {
    const ids = new Set(targetStories(listCases(), "vue").map(({ id }) => id));
    expect(ids.size).toBeGreaterThan(300);
    for (const url of [HOST_PATH, ...framedUrls(HOST_HTML)]) {
      const id = new URL(url, "http://uf.test").searchParams.get("id");
      expect(id === null || !ids.has(id), url).toBe(true);
    }
    expect(ids.has(RUNNER_STORY)).toBe(false);
  });
});
