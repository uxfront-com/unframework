import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { VRecord } from "./v-record";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-meter",
  imports: [ScopeAttributes, Fallthrough, VRecord],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let level = this.level();
    @let renders = this.renders();
    <section
      class="meter"
      aria-label="Meter"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <output class="level" [vRecord]="level">Level {{ level }}</output>
      <p>Rendered again {{ renders }} times</p>
      <button type="button" (click)="onRaise()">Raise</button>
      <button type="button" (click)="onRenderAgain()">Render again</button>
    </section>
  `,
})
export default class Meter {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly level = signal(1);
  protected readonly renders = signal(0);

  protected onRaise() {
    this.level.update((level) => level + 1);
  }

  protected onRenderAgain() {
    this.renders.update((renders) => renders + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
