import { ClickCapture } from "./_unframework/ClickCapture";
import { ClickOnce } from "./_unframework/ClickOnce";
import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { WheelPassive } from "./_unframework/WheelPassive";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-listener-order",
  imports: [ClickCapture, ClickOnce, WheelPassive, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let log = this.log();
    @let resets = this.resets();
    <section
      class="listener-order"
      aria-label="Listener order"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <div class="toolbar" role="presentation" (click)="record('toolbar')">
        <button
          type="button"
          (click)="record('save'); void (once(clickOnce, $event) && record('first save'))"
        >Save</button>
        <button
          type="button"
          (click)="once(clickOnce, $event) && record('first send'); record('send')"
        >Send</button>
        <button
          type="button"
          (click)="record('reset'); void (once(clickOnce, $event) && onResetOnce())"
        >Reset</button>
      </div>
      <div
        class="panel"
        role="presentation"
        (ufClickCapture)="record('panel capture')"
        (click)="onClick($event)"
      >
        <button type="button" (click)="record('inside')">Inside</button>
      </div>
      <button type="button" (click)="record('outside')">Outside</button>
      <div class="claim" role="presentation" (ufClickOnce)="record('claim once')">
        <button type="button" (click)="onStop($event)">Stop</button>
        <button type="button" (click)="record('pass')">Pass</button>
      </div>
      <div class="outer-zone" role="group" aria-label="Outer zone" (wheel)="record('outer wheel')">
        <div
          class="inner-zone"
          role="group"
          aria-label="Inner zone"
          (ufWheelPassive)="record('inner wheel')"
        >Scroll here</div>
      </div>
      <p>Resets: {{ resets }}</p>
      <ol aria-label="Log">
        @for (entry of log; track index; let index = $index) {
          <li>{{ entry }}</li>
        }
      </ol>
    </section>
  `,
})
export default class ListenerOrder {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly log = signal<string[]>([]);
  protected readonly resets = signal(0);
  protected readonly clickOnce = new WeakSet<EventTarget>();

  protected record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected onResetOnce() {
    this.resets.update((resets) => resets + 1);
  }

  protected onClick(event: PointerEvent) {
    event.stopPropagation();
    this.record("panel bubble");
  }

  protected onStop(event: PointerEvent) {
    event.stopPropagation();
    this.record("stopped");
  }

  protected once(elements: WeakSet<EventTarget>, event: Event): boolean {
    const element = event.currentTarget;
    if (element === null || elements.has(element)) return false;
    elements.add(element);
    return true;
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
