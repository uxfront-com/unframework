import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

/** A template of `Steps`'s `marker` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufStepsMarker]" })
export class StepsMarker {
  static ngTemplateContextGuard(
    _directive: StepsMarker,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-steps",
  imports: [NgTemplateOutlet],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let steps = this.steps();
    <ol class="steps" [class]="this.class()" [style]="this.style()">
      @for (step of steps; track step) {
        <li>@if (this.markerTemplate(); as template) {<ng-container [ngTemplateOutlet]="template" />}{{ step }}</li>
      }
    </ol>
    <ng-content select="[ufStepsMarker]" />
  `,
})
export default class Steps {
  readonly steps = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly markerTemplate = contentChild(StepsMarker, { read: TemplateRef });
}
