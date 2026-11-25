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
  signal,
  viewChild,
} from "@angular/core";

/** A template of `Choice`'s `body` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufChoiceBody]" })
export class ChoiceBody {
  static ngTemplateContextGuard(
    _directive: ChoiceBody,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-choice",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let first = this.first();
    <div
      class="choice"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @if (first) {
        <b>
          @if (this.bodyTemplate(); as template) {
            <ng-container [ngTemplateOutlet]="template" />
          }
        </b>
      } @else {
        <i>
          @if (this.bodyTemplate(); as template) {
            <ng-container [ngTemplateOutlet]="template" />
          }
        </i>
      }
      <button type="button" (click)="onSwitch()">Switch</button>
    </div>
    <ng-content select="[ufChoiceBody]" />
  `,
})
export default class Choice {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly bodyTemplate = contentChild(ChoiceBody, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly first = signal(true);

  protected onSwitch() {
    this.first.set(!this.first());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
