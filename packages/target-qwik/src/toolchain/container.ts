/**
 * The element Qwik's server renderer wraps the component in. A custom tag gives a fragment
 * container: the default (`html`) needs a `<head>`/`<body>` root and throws Q12 on a component.
 */
export const CONTAINER_TAG = "uf-qwik-container";

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;

/**
 * Returns the component's HTML from a Qwik server render: the container's inner HTML, without
 * the container data Qwik appends after the component (state, vnode data, sync functions, the
 * loader and its event registrations), and without the event registrations Qwik writes before
 * an element inside the component once a new event name has rendered (Qwik 2.0.0-rc.5,
 * `server.mjs` `emitNewQwikEvents(false, true)`), each of which removes itself when it runs.
 * Only that trailing run of Qwik's own scripts, and scripts of exactly that self-removing
 * form, are removed, so a `<script>` the component renders stays in the output. Throws when
 * the render is not a single container, rather than guessing which part is the component.
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
  return inner.slice(0, end).replace(SCRIPT, (script, attributes: string, body: string) =>
    isInlineRegistration(attributes, body) ? "" : script,
  );
}

/** The attributes Qwik gives its own inline scripts: none, or a CSP nonce. */
const QWIK_SCRIPT_ATTRIBUTES = /^(?:\s+nonce="[^"]*")?\s*$/;

/**
 * The body of an event registration Qwik writes inside the component: event names only, as
 * JSON strings, then the script removes itself, so it never reaches the browser's DOM.
 */
const INLINE_REGISTRATION =
  /^\(window\._qwikEv\|\|\(window\._qwikEv=\[\]\)\)\.push\("[^"\\]+"(?:,"[^"\\]+")*\);document\.currentScript\.remove\(\)$/;

/** Whether a script is an event registration Qwik writes before an element of the component. */
function isInlineRegistration(attributes: string, body: string): boolean {
  return QWIK_SCRIPT_ATTRIBUTES.test(attributes) && INLINE_REGISTRATION.test(body);
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
    (QWIK_SCRIPT_ATTRIBUTES.test(attributes) &&
      body.startsWith("(window._qwikEv||(window._qwikEv=[])).push("))
  );
}
