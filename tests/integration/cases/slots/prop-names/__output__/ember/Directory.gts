import Component from "@glimmer/component";
import Table, { type TableSignature } from "./Table.gts";

export interface Person {
  id: string;
  name: string;
}

export interface DirectorySignature {
  Args: { people: Person[] } & { style?: unknown };
  Element: TableSignature["Element"];
}

export default class Directory extends Component<DirectorySignature> {
  value1 = (rowProps: TableSignature["Blocks"]["row"][0]) => rowProps.index + 1;

  value2 = (rowProps: TableSignature["Blocks"]["row"][0]) => rowProps["data-id"];

  <template><Table
      @people={{@people}}
      @style={{@style}}
      ...attributes
    ><:row as |rowProps|><span>{{this.value1 rowProps}}: {{rowProps.name}} ({{this.value2 rowProps}})</span></:row></Table></template>
}
