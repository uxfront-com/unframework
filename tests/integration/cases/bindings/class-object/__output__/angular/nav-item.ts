import { Component, input } from "@angular/core";

export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

@Component({
  selector: "uf-nav-item",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let href = this.href();
    @let active = this.active();
    @let muted = this.muted();
    @let danger = this.danger();
    <a
      [attr.href]="href"
      [class]="[active ? 'active' : null, muted ? 'nav-item-muted' : null, danger ? 'nav-item-danger' : null, danger ? 'text-danger' : null, this.class()].join(' ')"
      [attr.aria-current]="active ? 'page' : undefined"
      [style]="this.style()"
    >{{ label }}</a>
  `,
})
export default class NavItem {
  readonly label = input.required<string>();
  readonly href = input.required<string>();
  readonly active = input.required<boolean>();
  readonly muted = input.required<boolean>();
  readonly danger = input<boolean, boolean | undefined>(false, {
    transform: (value) => (value === undefined ? false : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
