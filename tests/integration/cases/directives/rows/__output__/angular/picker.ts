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

/** What a template of `Picker`'s `option` slot reads: the slot's props. */
export type PickerOptionContext = { option: { id: string; label: string } };

/** A template of `Picker`'s `option` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufPickerOption]" })
export class PickerOption {
  static ngTemplateContextGuard(
    _directive: PickerOption,
    _context: unknown,
  ): _context is PickerOptionContext & { $implicit: PickerOptionContext } {
    return true;
  }
}

@Component({
  selector: "uf-picker",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let options = this.options();
    <div
      class="picker"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <ul aria-label="Options">
        @for (option of options; track option.id) {
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
      <button type="button" (click)="onReverseOptions()">Reverse options</button>
      <button type="button" (click)="onRemoveOption()">Remove option</button>
    </div>
    <ng-content select="[ufPickerOption]" />
  `,
})
export default class Picker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly optionTemplate = contentChild(PickerOption, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly options = signal([
    { id: "x", label: "Xray" },
    { id: "y", label: "Yankee" },
  ]);

  protected onReverseOptions() {
    this.options.set([...this.options()].reverse());
  }

  protected onRemoveOption() {
    this.options.set(this.options().filter((option) => option.id !== "y"));
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
