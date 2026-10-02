/**
 * The element Qwik's server renderer wraps the component in. A custom tag gives a fragment
 * container: the default (`html`) needs a `<head>`/`<body>` root and throws Q12 on a component.
 */
export const CONTAINER_TAG = "uf-qwik-container";

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;

/**
 * Returns the component's HTML from a Qwik server render: the container's inner HTML, without
 * the container data Qwik appends after the component (state, vnode data, sync functions, the
 * loader and its event registrations). Only that trailing run of Qwik's own scripts is
 * removed, so a `<script>` the component renders stays in the output. Throws when the render
 * is not a single container, rather than guessing which part is the component.
 */
export function componentHtml(render: string): string {
  const html = render.trim();
  const open = new RegExp(`^<${CONTAINER_TAG}(?:\\s[^>]*)?>`).exec(html);
  const close = `</${CONTAINER_TAG}>`;
  if (!open || !html.endsWith(close) || html.indexOf(close) !== html.length - close.length) {
    throw new Error(`Qwik's server render is not one <${CONTAINER_TAG}> container:\n${render}`);
  }
  const inner = html.slice(open[0].length, -close.length);
  let end = inner.length;
  const scripts = [...inner.matchAll(SCRIPT)];
  for (let index = scripts.length - 1; index >= 0; index--) {
    const script = scripts[index]!;
    if (script.index + script[0].length !== end || !isContainerScript(script[1]!, script[2]!)) {
      break;
    }
    end = script.index;
  }
  return inner.slice(0, end);
}

/** Whether a script is one of the container-level scripts Qwik's server renderer writes. */
function isContainerScript(attributes: string, body: string): boolean {
  return (
    // State, vnode data and attribute back-patches: type="qwik/state|vnode|backpatch".
    /\btype="qwik\//.test(attributes) ||
    // Sync functions (`document["qFuncs_<instance>"]=…`).
    /\bq:func="qwik\/json"/.test(attributes) ||
    // The inlined loader, which `qwikLoader: "never"` should already leave out.
    /\bid="qwikloader"/.test(attributes) ||
    // Event registrations, written even with `qwikLoader: "never"` once a handler exists.
    (/^(?:\s+nonce="[^"]*")?\s*$/.test(attributes) &&
      body.startsWith("(window._qwikEv||(window._qwikEv=[])).push("))
  );
}
