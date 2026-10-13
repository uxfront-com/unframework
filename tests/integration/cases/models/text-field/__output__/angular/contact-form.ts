import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-contact-form",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let email = this.email();
    <form aria-label="Contact" [class]="this.class()" [style]="this.style()">
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
  protected readonly name = signal("Ada");
  protected readonly email = signal("");

  protected onUseGrace() {
    this.name.set("Grace");
  }
}
