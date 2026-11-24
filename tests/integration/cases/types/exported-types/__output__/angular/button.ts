import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export type ButtonTone = "primary" | "secondary";

export type ButtonSize = "small" | "large";

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
}

@Component({
  selector: "uf-button",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let tone = this.tone();
    <button
      type="button"
      [class]="['button button-' + tone, this.class()].join(' ')"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ label }}</button>
  `,
})
export default class Button {
  readonly label = input.required<string>();
  readonly tone = input<ButtonTone, ButtonTone | undefined>("primary", {
    transform: (value) => (value === undefined ? "primary" : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLButtonElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
