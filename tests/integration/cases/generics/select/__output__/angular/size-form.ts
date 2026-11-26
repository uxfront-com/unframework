import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Select from "./select";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

type Size = "s" | "m" | "l";

@Component({
  selector: "uf-size-form",
  imports: [Select, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let size = this.size();
    <section
      aria-label="Size"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-select [label]="'Size'" [options]="sizes" [(value)]="this.size" />
      <output>Chosen: {{ size }}</output>
    </section>
  `,
})
export default class SizeForm {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly sizes: Size[] = ["s", "m", "l"];
  protected readonly size = signal<Size>("m");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
