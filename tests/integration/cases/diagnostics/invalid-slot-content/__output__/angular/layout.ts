import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

/** A template of `Layout`'s `title` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufLayoutTitle]" })
export class LayoutTitle {
  static ngTemplateContextGuard(
    _directive: LayoutTitle,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-layout",
  imports: [NgTemplateOutlet],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <main [class]="this.class()" [style]="this.style()">
      <h1>
        @if (this.titleTemplate(); as template) {
          <ng-container [ngTemplateOutlet]="template" />
        }
      </h1>
      <ng-content />
    </main>
    <ng-content select="[ufLayoutTitle]" />
  `,
})
export class Layout {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly titleTemplate = contentChild(LayoutTitle, { read: TemplateRef });
}
