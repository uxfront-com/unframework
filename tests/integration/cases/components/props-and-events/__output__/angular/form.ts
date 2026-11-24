import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Field from "./field";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-form",
  imports: [Field, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let city = this.city();
    @let cleared = this.cleared();
    <section
      aria-label="Address"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-field [label]="'Street'" (clear)="clear($event)" />
      <uf-field [label]="city" [tone]="'warn'" (clear)="onClear($event)" />
      <output>Cleared: {{ cleared }}</output>
    </section>
  `,
})
export default class Form {
  readonly city = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly cleared = signal("nothing");

  protected clear(label: string) {
    this.cleared.set(label);
  }

  protected onClear(label: string) {
    this.clear(label.toUpperCase());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
