import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

/** A template of `Card`'s `title` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufCardTitle]" })
export class CardTitle {
  static ngTemplateContextGuard(
    _directive: CardTitle,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-card",
  imports: [NgTemplateOutlet],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div class="card" [class]="this.class()" [style]="this.style()">
      <h3>
        @if (this.titleTemplate(); as template) {<ng-container [ngTemplateOutlet]="template" />} @else {Untitled}
      </h3>
    </div>
    <ng-content select="[ufCardTitle]" />
  `,
})
export default class Card {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly titleTemplate = contentChild(CardTitle, { read: TemplateRef });
}
