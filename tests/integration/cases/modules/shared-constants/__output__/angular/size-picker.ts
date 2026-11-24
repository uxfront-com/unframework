import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-size-picker",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let size = this.size();
    <fieldset
      class="size-picker"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <legend>Size</legend>
      <p role="status">Picked: {{ SIZES[size] }}</p>
      <ul>
        @for (each of SIZE_ORDER; track each) {
          <li>
            <button
              type="button"
              [attr.aria-pressed]="size === each"
              (click)="pick(each)"
            >{{ SIZES[each] }}</button>
          </li>
        }
      </ul>
    </fieldset>
  `,
})
export default class SizePicker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLFieldSetElement>>("ufElement");
  protected readonly size = signal<Size>(DEFAULT_SIZE);
  protected readonly SIZES = SIZES;
  protected readonly SIZE_ORDER = SIZE_ORDER;

  protected pick(next: Size) {
    this.size.set(next);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
