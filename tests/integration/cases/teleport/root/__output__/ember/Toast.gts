import type { TOC } from "@ember/component/template-only";
import "./Toast.uf.tsx.css";

export interface ToastProps {
  message: string;
}

export interface ToastSignature {
  Args: ToastProps;
  Element: Element;
}

const Toast: TOC<ToastSignature> = <template>{{#let (teleportTarget "body") as |target|}}{{#if target}}{{#in-element target insertBefore=null}}<div
    data-teleported="true"
    class="toast"
    role="alert"
    data-uf-416dbabb=""
  ><p data-uf-416dbabb="">{{@message}}</p></div>{{/in-element}}{{/if}}{{/let}}</template>;

export default Toast;

/** The element a `<Teleport to>` selects, in the browser only: the server renders no teleport. */
function teleportTarget(to: string): Element | undefined {
  return import.meta.env.SSR ? undefined : (document.querySelector(to) ?? undefined);
}
