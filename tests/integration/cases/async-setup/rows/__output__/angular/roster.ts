import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Member from "./member";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-roster",
  imports: [Member, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let ids = this.ids();
    @let lead = this.lead();
    @let guest = this.guest();
    <section
      class="roster"
      aria-label="Roster"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button type="button" (click)="onSwitchLead()">Switch lead</button>
      <button type="button" (click)="onToggleGuest()">Toggle guest</button>
      <ul>
        @for (id of ids; track id) {
          <uf-member [id]="id" />
        }
        @if (lead) {
          <uf-member [id]="'ada'" />
        } @else {
          <uf-member [id]="'linus'" />
        }
        @if (guest) {
          <uf-member [id]="'hopper'" />
        }
      </ul>
    </section>
  `,
})
export default class Roster {
  readonly ids = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly lead = signal(true);
  protected readonly guest = signal(false);

  protected onSwitchLead() {
    this.lead.set(!this.lead());
  }

  protected onToggleGuest() {
    this.guest.set(!this.guest());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
