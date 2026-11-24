import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Panel from "./panel";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-board",
  imports: [Panel, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let showA = this.showA();
    @let showB = this.showB();
    @let entries = this.entries();
    <div
      class="board"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @if (showA) {
        <uf-panel [name]="'a'" (closed)="record($event)" />
      }
      @if (showB) {
        <uf-panel [name]="'b'" (closed)="record($event)" />
      }
      <button type="button" (click)="onHideA()">Hide a</button>
      <button type="button" (click)="onHideB()">Hide b</button>
      <output>{{ entries.join(", ") }}</output>
    </div>
  `,
})
export default class Board {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly showA = signal(true);
  protected readonly showB = signal(true);
  protected readonly entries = signal<string[]>([]);

  protected record(entry: string) {
    this.entries.set([...this.entries(), entry]);
  }

  protected onHideA() {
    this.showA.set(false);
  }

  protected onHideB() {
    this.showB.set(false);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
