import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface PlanProps {
  name: string;
  price: number;
  href: string;
  featured?: boolean;
  note?: string;
}

@Component({
  selector: "uf-plan",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let price = this.price();
    @let href = this.href();
    @let featured = this.featured();
    @let note = this.note();
    <article
      [class]="[featured ? 'plan featured' : 'plan', this.class()].join(' ')"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : name"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ name }}</h2>
      <p>{{ price }} EUR a month</p>
      @if (note) {
        <p class="note">{{ note }}</p>
      } @else {
        <p class="note">No commitment.</p>
      }
      <a [attr.href]="href">Choose {{ name }}</a>
    </article>
  `,
})
export default class Plan {
  readonly name = input.required<string>();
  readonly price = input.required<number>();
  readonly href = input.required<string>();
  readonly featured = input<boolean, boolean | undefined>(false, {
    transform: (value) => (value === undefined ? false : value),
  });
  readonly note = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
