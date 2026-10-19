import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

/** A template of `Panel`'s `title` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufPanelTitle]" })
export class PanelTitle {
  static ngTemplateContextGuard(
    _directive: PanelTitle,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-panel",
  imports: [NgTemplateOutlet],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div class="panel" [class]="this.class()" [style]="this.style()">
      <h4>
        @if (this.titleTemplate(); as template) {<ng-container [ngTemplateOutlet]="template" />} @else {Untitled}
      </h4>
    </div>
    <ng-content select="[ufPanelTitle]" />
  `,
})
export default class Panel {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly titleTemplate = contentChild(PanelTitle, { read: TemplateRef });
}
