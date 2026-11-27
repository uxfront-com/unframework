import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { NgTemplateOutlet } from "@angular/common";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-switch-action",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    <ng-template #defaultSlot>
      <ng-content />
    </ng-template>
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
          @if (href) {
            <b>
              <ng-container [ngTemplateOutlet]="defaultSlot" />
            </b>
          } @else {
            <i>
              <ng-container [ngTemplateOutlet]="defaultSlot" />
            </i>
          }
        </a>
      } @case ("button") {
        <button
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          @if (href) {
            <b>
              <ng-container [ngTemplateOutlet]="defaultSlot" />
            </b>
          } @else {
            <i>
              <ng-container [ngTemplateOutlet]="defaultSlot" />
            </i>
          }
        </button>
      }
    }
  `,
})
export default class SwitchAction {
  readonly href = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLAnchorElement | HTMLButtonElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
