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

/** What a template of `Options`'s `option` slot reads: the slot's props. */
export type OptionsOptionContext = { option: { value: string } };

/** A template of `Options`'s `option` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufOptionsOption]" })
export class OptionsOption {
  static ngTemplateContextGuard(
    _directive: OptionsOption,
    _context: unknown,
  ): _context is OptionsOptionContext & { $implicit: OptionsOptionContext } {
    return true;
  }
}

@Component({
  selector: "uf-options",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let options = this.options();
    <ul
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @for (option of options; track option.value) {
        <li>
          @if (this.optionTemplate(); as template) {
            <ng-container
              [ngTemplateOutlet]="template"
              [ngTemplateOutletContext]="{ $implicit: { option: option }, option: option }"
            />
          }
        </li>
      }
    </ul>
    <ng-content select="[ufOptionsOption]" />
  `,
})
export default class Options<T extends { value: string }> {
  readonly options = input.required<T[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly optionTemplate = contentChild(OptionsOption, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLUListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
