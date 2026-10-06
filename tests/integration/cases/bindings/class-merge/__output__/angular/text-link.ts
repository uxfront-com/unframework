import { Component, input } from "@angular/core";

interface LinkAttributes {
  class?: string;
  title?: string;
  rel?: string;
}

interface RowAttributes {
  class: string;
  id?: string;
}

export interface TextLinkProps {
  href: string;
  label: string;
  strong: boolean;
  link: LinkAttributes;
  row: RowAttributes;
}

@Component({
  selector: "uf-text-link",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let label = this.label();
    @let strong = this.strong();
    @let link = this.link();
    @let row = this.row();
    <p
      class="link-row"
      [class]="[row.class, strong ? 'link-row-strong' : null].join(' ')"
      [attr.id]="row.id"
    >
      <a
        [attr.href]="href"
        class="text-link"
        [class]="link.class"
        [attr.title]="link.title"
        [attr.rel]="link.rel"
      >{{ label }}</a>
    </p>
  `,
})
export default class TextLink {
  readonly href = input.required<string>();
  readonly label = input.required<string>();
  readonly strong = input.required<boolean>();
  readonly link = input.required<LinkAttributes>();
  readonly row = input.required<RowAttributes>();
}
