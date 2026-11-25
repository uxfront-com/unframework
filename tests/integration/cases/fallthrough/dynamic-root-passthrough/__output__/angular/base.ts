import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-base",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let disabled = this.disabled();
    @let text = this.text();
    @switch (href ? "a" : "button") {
      @case ("a") {
        <a
          [attr.href]="'href' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['href'] : href"
          class="base"
          title="Base"
          (click)="press($event)"
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >{{ text }}</a>
      } @case ("button") {
        <button
          [attr.disabled]="'disabled' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['disabled'] : disabled ? '' : null"
          class="base"
          title="Base"
          (click)="press($event)"
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >{{ text }}</button>
      }
    }
  `,
})
export default class Base {
  readonly href = input<string>();
  readonly disabled = input<boolean>();
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLAnchorElement | HTMLButtonElement>>("ufElement");

  protected press(event: MouseEvent) {
    event.preventDefault();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
