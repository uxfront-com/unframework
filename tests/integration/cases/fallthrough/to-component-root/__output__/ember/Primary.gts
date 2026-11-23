import type { TOC } from "@ember/component/template-only";
import Base, { type BaseSignature } from "./Base.gts";

export interface PrimarySignature {
  Args: { text: string } & { style?: unknown };
  Element: BaseSignature["Element"];
}

const Primary: TOC<PrimarySignature> = <template><Base @text={{@text}} class="primary" @style={{@style}} ...attributes /></template>;

export default Primary;
