import { Component, input } from "@angular/core";

export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

@Component({
  selector: "uf-contact-card",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let jobTitle = this.jobTitle();
    @let team = this.team();
    @let pronouns = this.pronouns();
    @let phone = this.phone();
    <article class="contact-card" [attr.aria-label]="name" [attr.data-team]="team">
      <h2 [attr.title]="pronouns">{{ name }}</h2>
      <p>{{ jobTitle }}</p>
      <p>Phone: {{ phone ?? "not listed" }}</p>
    </article>
  `,
})
export default class ContactCard {
  readonly name = input.required<string>();
  readonly jobTitle = input<string>();
  readonly team = input<string>();
  readonly pronouns = input<string>();
  readonly phone = input<string | null>();
}
