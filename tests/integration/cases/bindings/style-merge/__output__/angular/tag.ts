import { Component, input } from "@angular/core";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

@Component({
  selector: "uf-tag",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let colour = this.colour();
    @let weight = this.weight();
    @let indent = this.indent();
    <span
      class="tag"
      style="display: inline-block; padding: 2px 8px; border-style: solid; border-width: 1px"
      [style.border-color]="colour ?? '#5a5a5a'"
      [style.color]="colour"
      [style.font-weight]="weight"
      [style.margin-left]="indent"
    >{{ label }}</span>
  `,
})
export default class Tag {
  readonly label = input.required<string>();
  readonly colour = input<string>();
  readonly weight = input<number>();
  readonly indent = input<string>();
}
