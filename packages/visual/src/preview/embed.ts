// The preview's embed page (ADR-0112): `embed.html?example=<id>&target=<target>` opens one example
// on one target by its own URL, which any page may put in an iframe. The page is static, like the
// shell: its data is written into it as JSON and its script is the function below. It checks the
// example and the target against its own lists, then replaces itself with that target's frame page
// in standalone mode, so it only ever sends the browser to one of the preview's own frames. A
// missing or unknown value shows a message instead, since a static host's own 404 page for a frame
// that isn't there can be blank.
import type { PreviewCatalogue } from "./catalogue.ts";
import { EMBED_FILE, EXAMPLE_PARAM, TARGET_PARAM } from "./protocol.ts";
import { scriptJson } from "./shell.ts";

/**
 * What the embed page is given: each frame page's URL, as the shell gets it (absolute in
 * development, relative in a static preview), and the examples' ids, in the catalogue's order.
 */
export interface EmbedData {
  frames: { target: string; src: string }[];
  examples: string[];
}

/** The embed page's data, from the catalogue and the frame pages' URLs. */
export function embedData(
  catalogue: Pick<PreviewCatalogue, "examples">,
  frames: readonly { target: string; src: string }[],
): EmbedData {
  return {
    frames: frames.map(({ target, src }) => ({ target, src })),
    examples: catalogue.examples.map((example) => example.id),
  };
}

/** The embed page. */
export function embedPage(data: EmbedData): string {
  const constants = { file: EMBED_FILE, example: EXAMPLE_PARAM, target: TARGET_PARAM };
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>unframework preview</title>
    <style>:root { color-scheme: light dark; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; } body { margin: 16px; overflow-wrap: anywhere; }</style>
  </head>
  <body>
    <script type="application/json" id="uf-embed-data">${scriptJson(data)}</script>
    <script>(${embedScript.toString()})(${scriptJson(constants)});</script>
  </body>
</html>
`;
}

/**
 * The embed page's script, run in the browser as written: the frame for the URL's example and
 * target, with `location.replace` so Back skips this page, or a message, written as text.
 */
function embedScript(constants: { file: string; example: string; target: string }): void {
  const data = JSON.parse(document.getElementById("uf-embed-data")!.textContent!) as EmbedData;
  const params = new URLSearchParams(location.search);
  const example = params.get(constants.example);
  const target = params.get(constants.target);
  const targets = data.frames.map((frame) => frame.target).join(", ");
  const say = (text: string) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    document.body.replaceChildren(paragraph);
  };
  if (!example || !target) {
    say(
      `Open an example with ${constants.file}?${constants.example}=<id>&${constants.target}=<target>. The targets are ${targets}.`,
    );
    return;
  }
  const frame = data.frames.find((each) => each.target === target);
  if (!frame) {
    say(`This preview has no target ${JSON.stringify(target)}. Its targets are ${targets}.`);
    return;
  }
  if (!data.examples.includes(example)) {
    say(`This preview has no example ${JSON.stringify(example)}.`);
    return;
  }
  const url = new URL(frame.src, location.href);
  url.searchParams.set(constants.example, example);
  location.replace(url.href);
}
