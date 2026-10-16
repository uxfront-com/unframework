import { Component, input } from "@angular/core";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

@Component({
  selector: "uf-tag",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let colour = this.colour();
    @let weight = this.weight();
    @let indent = this.indent();
    <span
      class="tag"
      [style]="{ display: 'inline-block', padding: '2px 8px', 'border-style': 'solid', 'border-width': '1px', 'border-color': colour ?? '#5a5a5a', color: colour, 'font-weight': weight, 'margin-left': indent, ...this.style() }"
      [class]="this.class()"
    >{{ label }}</span>
  `,
})
export default class Tag {
  readonly label = input.required<string>();
  readonly colour = input<string>();
  readonly weight = input<number>();
  readonly indent = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
