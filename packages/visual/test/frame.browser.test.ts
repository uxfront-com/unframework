// The standalone frame's options in Chromium (ADR-0116), with a mount that records what it is
// given in place of a target's: the colour mode set before the first mount, the controls panel
// and the renders its fields ask for, a failed render shown in the example's area alone, the
// theme message taken from the parent window only, and a value the frame does not take.
import { afterEach, describe, expect, it, vi } from "vitest";

import { startFrame } from "../src/preview/frame.ts";
import type { ExampleControlGroup } from "../src/preview/instrument.ts";
import { EMBED_MESSAGE, STATIC_RENDER_MESSAGE } from "../src/preview/protocol.ts";
import type { FrameOptions } from "../src/preview/protocol.ts";

const PAGE = location.pathname + location.search;
const GROUPS: ExampleControlGroup[] = [
  {
    component: "src/Button",
    name: "Button",
    controls: [
      {
        name: "variant",
        optional: true,
        kind: "select",
        options: ["primary", "secondary"],
        initial: "primary",
        key: "ufControl0",
      },
    ],
    setByExample: ["size"],
    uncontrolled: [{ name: "icon", type: "Element", reason: "its type is not one" }],
  },
];

/** A fresh frame page at `?<query>`, as `framePage` writes it. */
function framePage(query: string): void {
  history.replaceState(null, "", `${location.pathname}?${query}`);
  const html = document.documentElement;
  delete html.dataset.theme;
  html.style.removeProperty("color-scheme");
  delete document.body.dataset.ufEmbed;
  const root = document.createElement("div");
  root.dataset.ufPreviewRoot = "";
  document.body.replaceChildren(root);
}

/** What each call of the mount and of its rerender saw. */
interface Calls {
  mounts: { theme: string | undefined; scheme: string; panel: boolean; props: unknown }[];
  rerenders: unknown[];
}

function frameOptions(calls: Calls, fail?: (props: unknown) => boolean): FrameOptions {
  return {
    target: "vue",
    serverRender: false,
    entries: { "example:examples/Buttons": () => Promise.resolve({ default: {} }) },
    controls: { "example:examples/Buttons": GROUPS },
    mount: (_component, container, options) => {
      calls.mounts.push({
        theme: document.documentElement.dataset.theme,
        scheme: getComputedStyle(document.documentElement).colorScheme,
        panel: document.querySelector("uf-embed-controls") !== null,
        props: options.props,
      });
      container.innerHTML = "<button>Save</button>";
      return Promise.resolve({
        rerender: (props) => {
          calls.rerenders.push(props);
          if (fail?.(props)) return Promise.reject(new Error(STATIC_RENDER_MESSAGE));
          container.innerHTML = `<button>${JSON.stringify(props)}</button>`;
          return Promise.resolve();
        },
        unmount: () => Promise.resolve(),
      });
    },
  };
}

const shadow = () => document.querySelector("uf-embed-controls")!.shadowRoot!;
const area = () => document.querySelector<HTMLElement>("[data-uf-embed-example]")!;

afterEach(() => {
  history.replaceState(null, "", PAGE);
  document.body.replaceChildren();
  delete document.body.dataset.ufEmbed;
  delete document.documentElement.dataset.theme;
  document.documentElement.style.removeProperty("color-scheme");
});

describe("startFrame, standalone with an embed's options", () => {
  // First: the tests share one document, and a theme listener an earlier test added stays.
  it("takes no theme message without `theme` in its URL, and draws nothing extra", async () => {
    framePage("example=examples/Buttons");
    const calls: Calls = { mounts: [], rerenders: [] };
    startFrame(frameOptions(calls));
    await vi.waitFor(() => expect(calls.mounts).toHaveLength(1));
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: EMBED_MESSAGE, kind: "theme", theme: "dark" },
        source: window.parent,
      }),
    );
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.body.dataset.ufEmbed).toBeUndefined();
    expect(document.querySelector("uf-embed-controls, [data-uf-embed-example]")).toBeNull();
    const styles = [...document.querySelectorAll("style")].map((each) => each.textContent);
    expect(styles.filter((each) => each.includes("data-uf-embed"))).toEqual([]);
  });

  it("sets the colour mode, and draws the panel, before the first mount", async () => {
    framePage("example=examples/Buttons&theme=dark&controls=true");
    const calls: Calls = { mounts: [], rerenders: [] };
    startFrame(frameOptions(calls));
    await vi.waitFor(() => expect(calls.mounts).toHaveLength(1));
    expect(calls.mounts[0]).toEqual({ theme: "dark", scheme: "dark", panel: true, props: {} });
    expect(document.querySelector("uf-embed-controls")!.getAttribute("data-theme")).toBe("dark");
  });

  it("renders the example again on each change, and shows a failure in its area alone", async () => {
    framePage("example=examples/Buttons&controls=true");
    const calls: Calls = { mounts: [], rerenders: [] };
    startFrame(frameOptions(calls, (props) => JSON.stringify(props).includes("secondary")));
    await vi.waitFor(() => expect(calls.mounts).toHaveLength(1));
    // The shell's groups, fields and lists.
    expect(shadow().querySelector("h2")!.textContent).toBe("Controls");
    expect(shadow().querySelector("[data-uf-group]")!.getAttribute("aria-labelledby")).toBe(
      "uf-controls-0",
    );
    expect(
      [...shadow().querySelectorAll("h3, h4, label, li")].map((each) => each.textContent),
    ).toEqual([
      "Button",
      "variant",
      "Set by the example",
      "size",
      "Not controllable",
      "icon: its type is not one.",
    ]);
    const select = shadow().querySelector("select")!;
    const choose = (value: string) => {
      select.value = value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
    };

    choose("primary");
    await vi.waitFor(() => expect(calls.rerenders).toEqual([{ ufControl0: "primary" }]));
    expect(area().textContent).toBe('{"ufControl0":"primary"}');

    choose("secondary");
    await vi.waitFor(() => expect(area().dataset.failed).toBe(""));
    expect(area().querySelector("[data-uf-embed-failure]")!.textContent).toBe(
      STATIC_RENDER_MESSAGE,
    );
    expect(getComputedStyle(area().querySelector("[data-uf-preview-root]")!).display).toBe("none");
    expect(document.querySelector("uf-embed-controls")).not.toBeNull();

    // "(default)" sends no props, and the example comes back.
    choose("");
    await vi.waitFor(() => expect(area().dataset.failed).toBeUndefined());
    expect(calls.rerenders.at(-1)).toEqual({});
    expect(area().querySelector("[data-uf-embed-failure]")).toBeNull();
    expect(area().querySelector("[data-uf-preview-root]")!.textContent).toBe("{}");

    // A field's Enter submits its form, which must not load the page again.
    const submitted = new SubmitEvent("submit", { bubbles: true, cancelable: true });
    shadow().querySelector("form")!.dispatchEvent(submitted);
    expect(submitted.defaultPrevented).toBe(true);
  });

  it("says an example without controls has none, and renders it", async () => {
    framePage("example=examples/Buttons&controls=true");
    const calls: Calls = { mounts: [], rerenders: [] };
    startFrame({ ...frameOptions(calls), controls: {} });
    await vi.waitFor(() => expect(calls.mounts).toHaveLength(1));
    expect(shadow().querySelector("p")!.textContent).toBe("This example has no controls.");
    expect(shadow().querySelectorAll("[data-uf-group], input, select")).toHaveLength(0);
    expect(area().textContent).toBe("Save");
  });

  it("takes the theme message from its parent window only, in the documented shape", async () => {
    framePage("example=examples/Buttons&theme=light");
    const calls: Calls = { mounts: [], rerenders: [] };
    startFrame(frameOptions(calls));
    await vi.waitFor(() => expect(calls.mounts).toHaveLength(1));
    const html = document.documentElement;
    const post = (data: unknown, source: Window = window.parent) =>
      window.dispatchEvent(new MessageEvent("message", { data, source }));
    const ignored: [unknown, Window?][] = [
      [{ type: EMBED_MESSAGE, kind: "theme", theme: "dark" }, window],
      [{ type: EMBED_MESSAGE, kind: "theme", theme: "blue" }],
      [{ type: EMBED_MESSAGE, kind: "theme", theme: "dark", extra: 1 }],
      [{ type: "unframework:preview", kind: "theme", theme: "dark" }],
      [{ type: EMBED_MESSAGE, kind: "resize", theme: "dark" }],
      [[EMBED_MESSAGE, "theme", "dark"]],
      ["dark"],
      [null],
    ];
    for (const [data, source] of ignored) {
      post(data, source);
      expect(html.dataset.theme, JSON.stringify(data)).toBe("light");
    }
    post({ type: EMBED_MESSAGE, kind: "theme", theme: "dark" });
    expect(html.dataset.theme).toBe("dark");
    expect(html.style.colorScheme).toBe("dark");
    // The mode changes in place: the example rendered once.
    expect(calls.mounts).toHaveLength(1);
  });

  it("shows why for a value it does not take, and mounts nothing", () => {
    for (const [query, message] of [
      ["controls=yes", 'The controls parameter takes true, not "yes".'],
      ["theme=blue", 'The theme parameter takes light or dark, not "blue".'],
      ["resize=1", 'The resize parameter takes true, not "1".'],
    ]) {
      framePage(`example=examples/Buttons&${query}`);
      const calls: Calls = { mounts: [], rerenders: [] };
      startFrame(frameOptions(calls));
      expect(document.body.textContent, query).toBe(message);
      expect(calls.mounts, query).toEqual([]);
    }
  });
});
