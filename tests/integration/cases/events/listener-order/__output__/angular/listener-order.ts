import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  Renderer2,
  inject,
  output,
  signal,
} from "@angular/core";

@Directive({ selector: "[ufClickCapture]" })
export class ClickCapture {
  readonly ufClickCapture = output<PointerEvent>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const stop = inject(Renderer2).listen(
      element,
      "click",
      (event: PointerEvent) => this.ufClickCapture.emit(event),
      { capture: true },
    );
    inject(DestroyRef).onDestroy(stop);
  }
}

@Directive({ selector: "[ufClickOnce]" })
export class ClickOnce {
  readonly ufClickOnce = output<PointerEvent>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const stop = inject(Renderer2).listen(
      element,
      "click",
      (event: PointerEvent) => this.ufClickOnce.emit(event),
      { once: true },
    );
    inject(DestroyRef).onDestroy(stop);
  }
}

@Directive({ selector: "[ufWheelPassive]" })
export class WheelPassive {
  readonly ufWheelPassive = output<WheelEvent>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const stop = inject(Renderer2).listen(
      element,
      "wheel",
      (event: WheelEvent) => this.ufWheelPassive.emit(event),
      { passive: true },
    );
    inject(DestroyRef).onDestroy(stop);
  }
}

@Component({
  selector: "uf-listener-order",
  imports: [ClickCapture, ClickOnce, WheelPassive],
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let log = this.log();
    @let resets = this.resets();
    <section class="listener-order" aria-label="Listener order">
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
}
