import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  InjectionToken,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

const idCounter = new InjectionToken<{ next: number }>("idCounter", {
  factory: () => ({ next: 0 }),
});

@Component({
  selector: "uf-size-picker",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let legend = this.legend();
    @let sizes = this.sizes();
    @let picked = this.picked();
    <fieldset
      class="size-picker"
      [attr.aria-describedby]="'aria-describedby' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-describedby'] : hintId"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <legend>{{ legend }}</legend>
      <p [attr.id]="hintId">Pick one size.</p>
      @for (size of sizes; track size; let index = $index) {
        <div class="size">
          <input
            type="radio"
            [attr.id]="group + '-' + index"
            [attr.name]="group"
            [attr.value]="size"
            (change)="choose(size)"
          />
          <label [attr.for]="group + '-' + index">{{ size }}</label>
        </div>
      }
      <output>{{ picked || "none" }}</output>
    </fieldset>
  `,
})
export default class SizePicker {
  readonly legend = input.required<string>();
  readonly sizes = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLFieldSetElement>>("ufElement");
  protected readonly group = `uf-id-size-picker-${inject(idCounter).next++}`;
  protected readonly hintId = `uf-id-size-picker-${inject(idCounter).next++}`;
  protected readonly picked = signal("");

  protected choose(size: string) {
    this.picked.set(size);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
