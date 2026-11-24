import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Field from "./field";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface SignupProps {
  name: string;
  email: string;
}

@Component({
  selector: "uf-signup",
  imports: [Field, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let email = this.email();
    <form
      class="signup"
      aria-label="Sign up"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-field [label]="name" [hint]="'As it appears on your card.'" />
      <uf-field [label]="email" [hint]="'We send the receipt here.'" />
    </form>
  `,
})
export default class Signup {
  readonly name = input.required<string>();
  readonly email = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLFormElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
