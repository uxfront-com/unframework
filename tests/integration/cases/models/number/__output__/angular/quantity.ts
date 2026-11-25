import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { modelText } from "./_unframework/modelText";
import { writeModelText } from "./_unframework/writeModelText";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-quantity",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    @let volume = this.volume();
    <section
      aria-label="Order"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <input
        type="number"
        aria-label="Count"
        min="0"
        #countField
        [value]="modelText(countField, this.count(), { number: true })"
        (input)="writeModelText(this.count, countField, { number: true })"
      />
      <input
        type="range"
        aria-label="Volume"
        min="0"
        max="10"
        #volumeField
        [value]="modelText(volumeField, this.volume(), { number: true })"
        (input)="writeModelText(this.volume, volumeField, { number: true })"
      />
      <output>Next: {{ count + 1 }}, volume {{ volume + 1 }}</output>
      <button type="button" (click)="onTen()">Ten</button>
    </section>
  `,
})
export default class Quantity {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly count = signal(2);
  protected readonly volume = signal(5);
  protected readonly modelText = modelText;
  protected readonly writeModelText = writeModelText;

  protected onTen() {
    this.count.set(10);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
