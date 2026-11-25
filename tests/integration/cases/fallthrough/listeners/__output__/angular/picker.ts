import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Chip from "./chip";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-picker",
  imports: [Chip, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let log = this.log();
    <section
      aria-label="Picker"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-chip
        [label]="'Ada'"
        (pick)="onPick($event)"
        [ufListeners]="{ click: ($event) => onClick($event), focus: ($event) => onFocus($event), keydown: ($event) => onKeydown($event) }"
      />
      <ol aria-label="Log">
        @for (entry of log; track index; let index = $index) {
          <li>{{ entry }}</li>
        }
      </ol>
    </section>
  `,
})
export default class Picker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly log = signal<string[]>([]);

  private record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected onPick(label: string) {
    this.record(`pick ${label}`);
  }

  protected onClick(event: PointerEvent) {
    this.record(`click on ${(event.currentTarget as Element).localName}`);
  }

  protected onFocus(event: FocusEvent) {
    this.record(`focus on ${(event.currentTarget as Element).localName}`);
  }

  protected onKeydown(event: KeyboardEvent) {
    this.record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
