import type { TOC } from "@ember/component/template-only";
import Picker, { type PickerSignature } from "./Picker.gts";

interface Fruit {
  name: string;
  count: number;
}

export interface FruitsSignature {
  Args: { fruits: Fruit[] } & { style?: unknown };
  Element: PickerSignature<never>["Element"];
}

const Fruits: TOC<FruitsSignature> = <template><Picker
    @items={{@fruits}}
    @style={{@style}}
    ...attributes
  ><:item as |itemProps|><span>{{itemProps.item.name}} × {{itemProps.item.count}}</span></:item></Picker></template>;

export default Fruits;
