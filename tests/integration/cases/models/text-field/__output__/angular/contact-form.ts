import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-contact-form",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let email = this.email();
    <form
      aria-label="Contact"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Name <input
        #nameField
        [value]="this.name()"
        (input)="this.name.set(nameField.value)"
      /></label>
      <label>Email <input
        type="email"
        #emailField
        [value]="this.email()"
        (input)="this.email.set(emailField.value)"
      /></label>
      <output>{{ name }} at {{ email || "no address" }}</output>
      <button type="button" (click)="onUseGrace()">Use Grace</button>
    </form>
  `,
})
export default class ContactForm {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLFormElement>>("ufElement");
  protected readonly name = signal("Ada");
  protected readonly email = signal("");

  protected onUseGrace() {
    this.name.set("Grace");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
