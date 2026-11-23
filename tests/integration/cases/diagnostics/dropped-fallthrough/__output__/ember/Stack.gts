import type { TOC } from "@ember/component/template-only";

export interface StackSignature {
  Element: Element;
}

export const Stack: TOC<StackSignature> = <template><p>First</p
  ><p>Second</p></template>;
