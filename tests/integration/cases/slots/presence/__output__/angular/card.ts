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
    @let label = this.label();
    <section class="card" [attr.aria-label]="label" [class]="this.class()" [style]="this.style()">
      @if (titleTemplate()) {
        <header class="title">
          @if (titleTemplate(); as template) {
            <ng-container [ngTemplateOutlet]="template" />
          }
        </header>
      }
      @if (true) {
        <div class="body">
          <ng-content />
        </div>
      } @else {
        <p>Empty card</p>
      }
    </section>
    <ng-content select="[ufCardTitle]" />
  `,
})
export default class Card {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly titleTemplate = contentChild(CardTitle, { read: TemplateRef });
}
