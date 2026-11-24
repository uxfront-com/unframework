import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Lead from "./lead";
import Member from "./member";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-team",
  imports: [Member, Lead, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let ids = this.ids();
    <section
      class="team"
      aria-label="Team"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>Team</h2>
      <button type="button" (click)="onReset()">Reset</button>
      <uf-member #first [id]="'ada'" />
      <ul>
        @for (id of ids; track id) {
          <li>
            <uf-member [id]="id" />
          </li>
        }
      </ul>
      <uf-lead [class]="'lead'" [id]="'hopper'" />
    </section>
  `,
})
export default class Team {
  readonly ids = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly first = viewChild<{ reset(): void }>("first");
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");

  protected onReset() {
    this.first()?.reset();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
