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

/** What a template of `OnceSlot`'s `text` slot reads: the slot's props. */
export type OnceSlotTextContext = { label: string };

/** A template of `OnceSlot`'s `text` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufOnceSlotText]" })
export class OnceSlotText {
  static ngTemplateContextGuard(
    _directive: OnceSlotText,
    _context: unknown,
  ): _context is OnceSlotTextContext & { $implicit: OnceSlotTextContext } {
    return true;
  }
}

@Component({
  selector: "uf-once-slot",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <span
      class="once-slot"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @if (this.textTemplate(); as template) {
        <ng-container
          [ngTemplateOutlet]="template"
          [ngTemplateOutletContext]="{ $implicit: { label: label }, label: label }"
        />
      }
    </span>
    <ng-content select="[ufOnceSlotText]" />
  `,
})
export default class OnceSlot {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly textTemplate = contentChild(OnceSlotText, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLSpanElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
