import type { TOC } from "@ember/component/template-only";
import Level, { type LevelSignature } from "./Level.gts";

export interface OutlineSignature {
  Args: { style?: unknown };
  Element: LevelSignature["Element"];
}

const Outline: TOC<OutlineSignature> = <template><Level
    @title="Book"
    @style={{@style}}
    ...attributes
  ><Level @title="Part"><Level @title="Chapter" /></Level><Level @title="Appendix" /></Level></template>;

export default Outline;
