import type { MountAdapter } from "@unframework/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPreview, NO_OUTPUT_ATTRIBUTE } from "../src/preview.ts";
import type { StoryRenderContext } from "../src/preview.ts";

/** The part of an element the preview touches. */
class FakeElement {
  children: FakeElement[] = [];
  attributes = new Map<string, string>();
  textContent = "";
  append(child: FakeElement) {
    this.children.push(child);
  }
  replaceChildren() {
    this.children = [];
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

const Component = { name: "Component" };

function setup() {
  const instance = {
    settle: vi.fn(() => Promise.resolve()),
    rerender: vi.fn((_props: Readonly<Record<string, unknown>>) => Promise.resolve()),
    unmount: vi.fn(() => Promise.resolve()),
  };
  const mount = vi.fn(() => Promise.resolve(instance));
  const preview = createPreview(mount as unknown as MountAdapter);
  const canvas = new FakeElement();
  const showMain = vi.fn();
  const render = (
    id: string,
    args: Record<string, unknown>,
    options: {
      forceRemount?: boolean;
      parameters?: StoryRenderContext["storyContext"]["parameters"];
    } = {},
  ) =>
    preview.renderToCanvas(
      {
        storyContext: { id, args, component: Component, parameters: options.parameters ?? {} },
        showMain,
        forceRemount: options.forceRemount ?? false,
      },
      canvas as unknown as HTMLElement,
    );
  return { instance, mount, canvas, showMain, render, preview };
}

beforeEach(() => {
  vi.stubGlobal("document", { createElement: () => new FakeElement() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createPreview", () => {
  it("fills the page, with no decorator of its own", () => {
    const { preview } = setup();
    expect(preview.parameters).toEqual({ layout: "fullscreen" });
    expect(Object.keys(preview).toSorted()).toEqual(["parameters", "renderToCanvas"]);
  });

  it("mounts a story's component with its args, through the adapter", async () => {
    const { mount, render, canvas, showMain } = setup();
    await render("a--one", { step: 3 }, { forceRemount: true });
    expect(mount).toHaveBeenCalledWith(Component, canvas, { props: { step: 3 } });
    expect(showMain).toHaveBeenCalledOnce();
  });

  it("rerenders the same story on an args update, without mounting again", async () => {
    const { instance, mount, render } = setup();
    await render("a--one", { step: 3 }, { forceRemount: true });
    await render("a--one", { step: 4 });
    expect(mount).toHaveBeenCalledOnce();
    expect(instance.rerender).toHaveBeenCalledWith({ step: 4 });
    expect(instance.unmount).not.toHaveBeenCalled();
  });

  it("mounts again when Storybook forces a remount of the same story", async () => {
    const { instance, mount, render } = setup();
    await render("a--one", {}, { forceRemount: true });
    await render("a--one", {}, { forceRemount: true });
    expect(mount).toHaveBeenCalledTimes(2);
    expect(instance.unmount).toHaveBeenCalledOnce();
    expect(instance.rerender).not.toHaveBeenCalled();
  });

  it("unmounts the last story before it mounts another", async () => {
    const { instance, mount, render } = setup();
    await render("a--one", {}, { forceRemount: true });
    await render("a--two", {});
    expect(instance.unmount).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledTimes(2);
  });

  it("unmounts and empties the canvas on its teardown", async () => {
    const { instance, render, canvas } = setup();
    const teardown = await render("a--one", {}, { forceRemount: true });
    canvas.append(new FakeElement());
    await teardown();
    expect(instance.unmount).toHaveBeenCalledOnce();
    expect(canvas.children).toEqual([]);
  });

  it("shows a story's reason as text, and calls no adapter, for a case without output", async () => {
    const { mount, render, canvas } = setup();
    await render("a--one", { step: 3 }, { parameters: { ufNoOutput: "no output: UF4001" } });
    expect(mount).not.toHaveBeenCalled();
    expect(canvas.children).toHaveLength(1);
    expect(canvas.children[0]!.textContent).toBe("no output: UF4001");
    expect(canvas.children[0]!.attributes.has(NO_OUTPUT_ATTRIBUTE)).toBe(true);
  });

  it("clears a story without output when the next one renders", async () => {
    const { render, canvas } = setup();
    await render("a--one", {}, { parameters: { ufNoOutput: "no output" } });
    await render("a--two", {}, { parameters: { ufRunner: true } });
    expect(canvas.children).toEqual([]);
  });

  it("renders nothing for the runner story", async () => {
    const { mount, render, canvas, showMain } = setup();
    await render("uf-runner--spec", {}, { parameters: { ufRunner: true } });
    expect(mount).not.toHaveBeenCalled();
    expect(canvas.children).toEqual([]);
    expect(showMain).toHaveBeenCalledOnce();
  });

  it("empties the canvas when a mount throws, so the error display is all that shows", async () => {
    const { mount, render } = setup();
    mount.mockRejectedValueOnce(new Error("boom"));
    await expect(render("a--one", {}, { forceRemount: true })).rejects.toThrow("boom");
    // Nothing is left to unmount: the next story mounts on a clean slate.
    await render("a--two", {});
    expect(mount).toHaveBeenCalledTimes(2);
  });
});
