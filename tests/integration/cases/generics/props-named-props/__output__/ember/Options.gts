import Component from "@glimmer/component";

interface Props<T> {
  heading: string;
  options: T[];
  selected?: T;
}

export interface OptionsSignature<T> {
  Args: Props<T>;
  Element: Element;
}

export default class Options<T> extends Component<OptionsSignature<T>> {
  value1 = (option: NonNullable<this["args"]["options"]>[number]) => String(option);

  value2 = (option: NonNullable<this["args"]["options"]>[number]) =>
    option === this.args.selected ? "true" : undefined;

  <template><h2>{{@heading}}</h2
    ><ul
      aria-label={{@heading}}
    >{{#each @options key="@index" as |option|}}<li
      aria-current={{enumeratedValue (this.value2 option)}}
    >{{this.value1 option}}</li>{{/each}}</ul></template>
}

/** An enumerated attribute's value: a boolean as its name, any other value as it is. */
function enumeratedValue<T>(value: T): Exclude<T, boolean> | "true" | "false" {
  return typeof value === "boolean"
    ? (String(value) as "true" | "false")
    : (value as Exclude<T, boolean>);
}
