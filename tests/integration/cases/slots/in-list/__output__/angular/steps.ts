import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  TemplateRef,
  contentChild,
  inject,
  input,
  viewChild,
} from "@angular/core";

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
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let steps = this.steps();
    <ol
      class="steps"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly markerTemplate = contentChild(StepsMarker, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLOListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
