import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
}

@Component({
  selector: "uf-list",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let items = this.items();
    @let selected = this.selected();
    <ul
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @for (item of items; track index; let index = $index) {
        <li [attr.aria-current]="item === selected ? 'true' : undefined">{{ String(item) }}</li>
      }
    </ul>
  `,
})
export default class List<T> {
  readonly label = input.required<string>();
  readonly items = input.required<T[]>();
  readonly selected = input<T>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLUListElement>>("ufElement");
  protected readonly String = String;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
