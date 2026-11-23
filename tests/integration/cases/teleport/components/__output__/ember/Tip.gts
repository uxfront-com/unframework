import type { TOC } from "@ember/component/template-only";

export interface TipProps {
  label: string;
}

export interface TipSignature {
  Args: TipProps;
  Element: Element;
}

const Tip: TOC<TipSignature> = <template>{{#let (teleportTarget "body") as |target|}}{{#if target}}{{#in-element target insertBefore=null}}<p
    data-teleported="true"
    class="tip"
    role="note"
  >{{@label}} tip</p>{{/in-element}}{{/if}}{{/let}}</template>;

export default Tip;

/** The element a `<Teleport to>` selects, in the browser only: the server renders no teleport. */
function teleportTarget(to: string): Element | undefined {
  return import.meta.env.SSR ? undefined : (document.querySelector(to) ?? undefined);
}
