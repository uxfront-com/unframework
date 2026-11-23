import type { TOC } from "@ember/component/template-only";
import Names, { type NamesSignature } from "./Names.gts";

export interface RosterSignature {
  Args: { names: string[] } & { style?: unknown };
  Element: NamesSignature["Element"];
}

const Roster: TOC<RosterSignature> = <template><Names
    @names={{@names}}
    @style={{@style}}
    ...attributes
  ><:default as |defaultProps|><b>{{defaultProps.item}}!</b></:default></Names></template>;

export default Roster;
