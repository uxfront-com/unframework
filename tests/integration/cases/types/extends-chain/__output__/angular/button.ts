import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import type { ButtonProps } from "./types";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-button",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let disabled = this.disabled();
    @let label = this.label();
    @let id = this.id();
    <button
      [attr.id]="'id' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['id'] : id"
      type="button"
      [attr.disabled]="'disabled' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['disabled'] : disabled ? '' : null"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ label }}</button>
  `,
})
export default class Button {
  readonly disabled = input<Exclude<ButtonProps["disabled"], undefined>, ButtonProps["disabled"]>(
    false,
    { transform: (value) => (value === undefined ? false : value) },
  );
  readonly label = input.required<ButtonProps["label"]>();
  readonly id = input.required<ButtonProps["id"]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLButtonElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
