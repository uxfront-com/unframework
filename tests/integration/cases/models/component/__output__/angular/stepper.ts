import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, model, viewChild } from "@angular/core";

@Component({
  selector: "uf-stepper",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let value = this.value();
    <div
      class="stepper"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button type="button" [attr.aria-label]="'Fewer ' + label" (click)="onClick()">-</button>
      <span>{{ label }}: {{ value }}</span>
      <button type="button" [attr.aria-label]="'More ' + label" (click)="onClick_1()">+</button>
    </div>
  `,
})
export default class Stepper {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly value = model<number>(0);
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");

  protected onClick() {
    this.value.update((value) => value - 1);
  }

  protected onClick_1() {
    this.value.update((value) => value + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
