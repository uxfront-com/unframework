import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

/** A template of `Card`'s `header` slot (ADR-0056). */
@Directive({ selector: "ng-template[ufCardHeader]" })
export class CardHeader {}

/** A template of `Card`'s `footer` slot (ADR-0056). */
@Directive({ selector: "ng-template[ufCardFooter]" })
export class CardFooter {}

@Component({
  selector: "uf-card",
  imports: [NgTemplateOutlet],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <article class="card" [class]="this.class()" [style]="this.style()">
      <header>
        @if (headerTemplate(); as template) {
          <ng-container [ngTemplateOutlet]="template" />
        }
      </header>
      <div class="body">
        <ng-content />
      </div>
      <footer>
        @if (footerTemplate(); as template) {
          <ng-container [ngTemplateOutlet]="template" />
        }
      </footer>
    </article>
    <ng-content select="[ufCardHeader]" />
    <ng-content select="[ufCardFooter]" />
  `,
})
export default class Card {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly headerTemplate = contentChild(CardHeader, { read: TemplateRef });
  protected readonly footerTemplate = contentChild(CardFooter, { read: TemplateRef });
}
