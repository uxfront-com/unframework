import type { TOC } from "@ember/component/template-only";

export interface StatusSignature {
  Args: { busy: boolean; text: string };
  Element: HTMLElementTagNameMap["span"] | HTMLElementTagNameMap["button"];
}

const Status: TOC<StatusSignature> = <template>{{#if @busy}}<span class="badge" role="status" ...attributes>Saving</span>{{else}}<button
    type="button"
    class="badge"
    ...attributes
  >{{@text}}</button>{{/if}}</template>;

export default Status;
