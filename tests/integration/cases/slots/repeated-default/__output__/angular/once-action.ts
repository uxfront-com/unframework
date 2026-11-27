import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import OnceSlot, { OnceSlotText } from "./once-slot";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-once-action",
  imports: [OnceSlot, OnceSlotText, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let label = this.label();
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
          <uf-once-slot [label]="label">
            <ng-template ufOnceSlotText let-shown>
              <span class="once-fill">
                <ng-content>{{ shown.label }}</ng-content>
              </span>
            </ng-template>
          </uf-once-slot>
        </a>
      } @case ("button") {
        <button
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          <uf-once-slot [label]="label">
            <ng-template ufOnceSlotText let-shown>
              <span class="once-fill">
                <ng-content>{{ shown.label }}</ng-content>
              </span>
            </ng-template>
          </uf-once-slot>
        </button>
      }
    }
  `,
})
export default class OnceAction {
  readonly href = input<string>();
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLAnchorElement | HTMLButtonElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
