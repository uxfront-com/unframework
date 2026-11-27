import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import EachSlot, { EachSlotRow } from "./each-slot";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-each-action",
  imports: [EachSlot, EachSlotRow, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let items = this.items();
    @switch (href ? "a" : "button") {
      @case ("a") {
        <a
          [attr.href]="'href' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['href'] : href"
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          <uf-each-slot [items]="items">
            <ng-template ufEachSlotRow let-item="item">
              <span class="each-fill">
                <ng-content>{{ item }}</ng-content>
              </span>
            </ng-template>
          </uf-each-slot>
        </a>
      } @case ("button") {
        <button
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          <uf-each-slot [items]="items">
            <ng-template ufEachSlotRow let-item="item">
              <span class="each-fill">
                <ng-content>{{ item }}</ng-content>
              </span>
            </ng-template>
          </uf-each-slot>
        </button>
      }
    }
  `,
})
export default class EachAction {
  readonly href = input<string>();
  readonly items = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLAnchorElement | HTMLButtonElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
