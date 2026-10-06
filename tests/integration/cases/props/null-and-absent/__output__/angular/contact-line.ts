import { Component, input } from "@angular/core";

export interface ContactLineProps {
  name: string;
  phone?: string | null;
  verified?: boolean | null;
}

@Component({
  selector: "uf-contact-line",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let phone = this.phone();
    @let verified = this.verified();
    <section class="contact-line" [attr.aria-label]="name">
      <p
        [attr.data-phone]="phone === null ? 'withheld' : phone"
      >Phone: {{ phone === null ? "withheld" : (phone ?? "not given yet") }}</p>
      <p>{{ verified === null ? "Verification pending" : verified ? "Verified" : "Not verified" }}</p>
    </section>
  `,
})
export default class ContactLine {
  readonly name = input.required<string>();
  readonly phone = input<string | null>();
  readonly verified = input<boolean | null>();
}
