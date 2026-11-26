import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

@Component({
  selector: "uf-nav-item",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let href = this.href();
    @let active = this.active();
    @let muted = this.muted();
    @let danger = this.danger();
    <a
      [attr.href]="'href' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['href'] : href"
      [class]="[active ? 'active' : null, muted ? 'nav-item-muted' : null, danger ? 'nav-item-danger' : null, danger ? 'text-danger' : null, this.class()].join(' ')"
      [attr.aria-current]="'aria-current' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-current'] : active ? 'page' : undefined"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLAnchorElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
