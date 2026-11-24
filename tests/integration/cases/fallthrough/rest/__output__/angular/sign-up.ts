import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Field from "./field";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-sign-up",
  imports: [Field, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let focuses = this.focuses();
    <form
      aria-label="Sign up"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p id="email-hint">We never share it.</p>
      <uf-field
        [label]="'Email'"
        [class]="'wide'"
        [style]="{ 'margin-top': '4px' }"
        [ufAttributes]="{ id: 'email', 'aria-describedby': 'email-hint', placeholder: 'you@example.com' }"
        [ufListeners]="{ focus: () => onFocus() }"
      />
      <p>Focuses: {{ focuses }}</p>
    </form>
  `,
})
export default class SignUp {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLFormElement>>("ufElement");
  protected readonly focuses = signal(0);

  protected onFocus() {
    this.focuses.update((focuses) => focuses + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
