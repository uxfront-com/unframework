import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

@Component({
  selector: "uf-contact-card",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let jobTitle = this.jobTitle();
    @let team = this.team();
    @let pronouns = this.pronouns();
    @let phone = this.phone();
    <article
      class="contact-card"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : name"
      [attr.data-team]="'data-team' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['data-team'] : team"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
