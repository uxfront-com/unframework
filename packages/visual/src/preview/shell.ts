// The preview's shell (ADR-0088): one page, served by a plain HTTP server, that lists the examples
// and the components and shows the selection in one labelled iframe per target, each from that
// target's own server. It sends each frame the selection and the props over `postMessage`, and
// takes answers only from those frames, at their origins. The page is static: the catalogue is
// written into it as JSON, and its script is the function below, so no build serves it.
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { PreviewCatalogue } from "./catalogue.ts";
import { FRAME_PATH, PREVIEW_MESSAGE } from "./protocol.ts";
import { PREVIEW_HOST } from "./servers.ts";

/** What the shell page is given: the frames' origins and the catalogue, without file paths. */
export interface ShellData {
  frames: { target: string; origin: string }[];
  examples: { key: string; id: string }[];
  components: {
    key: string;
    id: string;
    name: string;
    controls: PreviewCatalogue["components"][number]["controls"];
    uncontrolled: PreviewCatalogue["components"][number]["uncontrolled"];
  }[];
}

/** The shell's data, from the catalogue and the target servers. */
export function shellData(
  catalogue: PreviewCatalogue,
  frames: readonly { target: string; origin: string }[],
): ShellData {
  return {
    frames: frames.map(({ target, origin }) => ({ target, origin })),
    examples: catalogue.examples.map(({ key, id }) => ({ key, id })),
    components: catalogue.components.map(({ key, id, name, controls, uncontrolled }) => ({
      key,
      id,
      name,
      controls,
      uncontrolled,
    })),
  };
}

/** JSON safe inside a `<script>` element: no `</script>` or `<!--` can close it. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** The shell page. */
export function shellPage(data: ShellData): string {
  const constants = { frame: FRAME_PATH, message: PREVIEW_MESSAGE };
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>unframework preview</title>
    <style>
      body { margin: 0; font: 14px/1.4 system-ui, sans-serif; display: grid; grid-template-columns: 16rem 1fr; min-height: 100vh; }
      nav { border-inline-end: 1px solid #ddd; padding: 1rem; overflow: auto; }
      nav h2 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin: 1rem 0 0.25rem; }
      nav ul { list-style: none; margin: 0; padding: 0; }
      nav button { all: unset; display: block; width: 100%; box-sizing: border-box; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; }
      nav button:focus-visible { outline: 2px solid #2563eb; }
      nav button[aria-current="true"] { background: #e0e7ff; }
      main { padding: 1rem; display: grid; gap: 1rem; align-content: start; }
      form { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; align-items: end; }
      form label { display: grid; gap: 0.25rem; }
      .frames { display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); gap: 1rem; }
      figure { margin: 0; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
      figcaption { display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.25rem 0.5rem; background: #f5f5f5; font-weight: 600; }
      figcaption output { font-weight: 400; color: #555; }
      figcaption output[data-state="failed"] { color: #b91c1c; }
      iframe { display: block; width: 100%; height: 12rem; border: 0; resize: vertical; }
    </style>
  </head>
  <body>
    <nav aria-label="Examples and components"></nav>
    <main>
      <h1 data-uf-selection>Select an example or a component</h1>
      <form data-uf-controls aria-label="Props" hidden></form>
      <p data-uf-uncontrolled hidden></p>
      <div class="frames"></div>
    </main>
    <script type="application/json" id="uf-preview-data">${scriptJson(data)}</script>
    <script>(${shellScript.toString()})(${scriptJson(constants)});</script>
  </body>
</html>
`;
}

/**
 * The shell page's script, run in the browser as written. It keeps the selection and the props,
 * sends them to every frame on each change and whenever a frame says it is ready (a frame reloads
 * when Vite optimises a dependency it found), and shows each frame's last answer.
 */
function shellScript(constants: { frame: string; message: string }): void {
  type Control = ShellData["components"][number]["controls"][number];
  const data = JSON.parse(document.getElementById("uf-preview-data")!.textContent!) as ShellData;
  const nav = document.querySelector("nav")!;
  const heading = document.querySelector("[data-uf-selection]")!;
  const form = document.querySelector<HTMLFormElement>("[data-uf-controls]")!;
  const uncontrolled = document.querySelector<HTMLElement>("[data-uf-uncontrolled]")!;
  const grid = document.querySelector(".frames")!;
  let selected: string | undefined;
  // The component whose controls the form shows: one listener reads it on each input.
  let current: ShellData["components"][number] | undefined;
  let props: Record<string, unknown> = {};
  let seq = 0;

  const frames = data.frames.map(({ target, origin }) => {
    const figure = document.createElement("figure");
    figure.dataset.target = target;
    const caption = document.createElement("figcaption");
    const label = document.createElement("span");
    label.textContent = target;
    const status = document.createElement("output");
    caption.append(label, status);
    const iframe = document.createElement("iframe");
    iframe.title = `${target} preview`;
    iframe.src = `${origin}${constants.frame}?shell=${encodeURIComponent(location.origin)}`;
    figure.append(caption, iframe);
    grid.append(figure);
    return { target, origin, iframe, status };
  });

  const send = (frame: (typeof frames)[number]) => {
    if (selected === undefined) return;
    frame.status.dataset.state = "rendering";
    frame.status.textContent = "rendering…";
    frame.iframe.contentWindow?.postMessage(
      { type: constants.message, kind: "render", seq, entry: selected, props },
      frame.origin,
    );
  };
  const sendAll = () => {
    seq += 1;
    for (const frame of frames) send(frame);
  };

  window.addEventListener("message", (event) => {
    const frame = frames.find(
      (each) => each.origin === event.origin && each.iframe.contentWindow === event.source,
    );
    const message = event.data as {
      type?: unknown;
      kind?: unknown;
      seq?: unknown;
      message?: unknown;
    };
    if (!frame || message?.type !== constants.message) return;
    if (message.kind === "ready") send(frame);
    if ((message.kind === "rendered" || message.kind === "failed") && message.seq === seq) {
      frame.status.dataset.state = message.kind;
      frame.status.textContent =
        message.kind === "rendered" ? "rendered" : `failed: ${String(message.message)}`;
    }
  });

  const propsOf = (controls: readonly Control[]): Record<string, unknown> => {
    const next: Record<string, unknown> = {};
    for (const control of controls) {
      const field = form.elements.namedItem(control.name) as HTMLInputElement | HTMLSelectElement;
      // An optional prop left at "(default)", or blank, is left out, so its default applies.
      if (control.kind === "boolean" && !control.optional) {
        next[control.name] = (field as HTMLInputElement).checked;
      } else if (control.kind === "boolean") {
        if (field.value !== "") next[control.name] = field.value === "true";
      } else if (control.kind === "number") {
        if (field.value !== "") next[control.name] = Number(field.value);
        else if (!control.optional) next[control.name] = control.initial;
      } else if (field.value !== "" || !control.optional) {
        next[control.name] = field.value;
      }
    }
    return next;
  };

  const option = (value: string, text: string) => {
    const element = document.createElement("option");
    element.value = value;
    element.textContent = text;
    return element;
  };

  form.addEventListener("input", () => {
    if (!current) return;
    props = propsOf(current.controls);
    sendAll();
  });

  const showControls = (component: ShellData["components"][number] | undefined) => {
    current = component;
    form.replaceChildren();
    form.hidden = !component?.controls.length;
    uncontrolled.hidden = !component?.uncontrolled.length;
    uncontrolled.textContent = component?.uncontrolled.length
      ? `Not controllable: ${component.uncontrolled.map((each) => `${each.name} (${each.reason})`).join("; ")}.`
      : "";
    if (!component) return;
    for (const control of component.controls) {
      const label = document.createElement("label");
      label.append(control.name);
      let field: HTMLInputElement | HTMLSelectElement;
      if (control.kind === "select" || (control.kind === "boolean" && control.optional)) {
        const select = document.createElement("select");
        if (control.optional) select.append(option("", "(default)"));
        const values = control.kind === "select" ? control.options : ["true", "false"];
        for (const value of values) select.append(option(value, value));
        field = select;
      } else {
        const input = document.createElement("input");
        input.type =
          control.kind === "boolean" ? "checkbox" : control.kind === "number" ? "number" : "text";
        if (control.kind === "boolean") input.checked = control.initial;
        else if (!control.optional) input.value = String(control.initial);
        field = input;
      }
      field.name = control.name;
      label.append(field);
      form.append(label);
    }
  };

  // An entry by its key, `example:<id>` or `component:<id>`: an example beside its component
  // shares its id.
  const select = (key: string) => {
    const component = data.components.find((each) => each.key === key);
    const example = data.examples.find((each) => each.key === key);
    if (!component && !example) return;
    selected = key;
    heading.textContent = component ? `${component.name} (${component.id})` : example!.id;
    for (const button of nav.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute("aria-current", String(button.dataset.entry === key));
    }
    showControls(component);
    props = component ? propsOf(component.controls) : {};
    if (location.hash !== `#${key}`) history.replaceState(null, "", `#${key}`);
    sendAll();
  };

  const section = (title: string, entries: { key: string; id: string }[]) => {
    const label = document.createElement("h2");
    label.textContent = title;
    const list = document.createElement("ul");
    for (const { key, id } of entries) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.entry = key;
      button.textContent = id;
      button.addEventListener("click", () => select(key));
      item.append(button);
      list.append(item);
    }
    nav.append(label, list);
  };
  section("Examples", data.examples);
  section("Components", data.components);
  const first = decodeURIComponent(location.hash.slice(1));
  select(first || data.examples[0]?.key || data.components[0]?.key || "");
  // A link to another entry on this page, or the browser's back and forward, changes the hash.
  window.addEventListener("hashchange", () => select(decodeURIComponent(location.hash.slice(1))));
}

/** The running shell server. */
export interface ShellServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

/** Serves the shell page at `/` on `port` (0 for any free one), and resolves once it listens. */
export function startShellServer(page: string, port: number): Promise<ShellServer> {
  const server: Server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://preview").pathname;
    if (path !== "/" || (request.method !== "GET" && request.method !== "HEAD")) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found: the preview serves its page at /.");
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(request.method === "HEAD" ? undefined : page);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, PREVIEW_HOST, () => {
      server.off("error", reject);
      const actual = (server.address() as AddressInfo).port;
      resolve({
        url: `http://${PREVIEW_HOST}:${actual}/`,
        port: actual,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            server.closeAllConnections();
          }),
      });
    });
  });
}
