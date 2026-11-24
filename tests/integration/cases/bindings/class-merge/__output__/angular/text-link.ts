import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

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
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let label = this.label();
    @let strong = this.strong();
    @let link = this.link();
    @let row = this.row();
    <p
      class="link-row"
      [class]="[row.class, strong ? 'link-row-strong' : null, this.class()].join(' ')"
      [attr.id]="'id' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['id'] : row.id"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLParagraphElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
