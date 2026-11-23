import type { TOC } from "@ember/component/template-only";
import Panel, { type PanelSignature } from "./Panel.gts";

export interface GreetingSignature {
  Args: { name: string } & { style?: unknown };
  Element: PanelSignature["Element"];
}

const Greeting: TOC<GreetingSignature> = <template><Panel
    @title="Welcome"
    @style={{@style}}
    ...attributes
  ><p>Hello, <strong>{{@name}}</strong>!</p><p>Your children render in the panel.</p></Panel></template>;

export default Greeting;
