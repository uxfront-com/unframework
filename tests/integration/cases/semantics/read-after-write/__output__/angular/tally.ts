import { ClickCapture } from "./_unframework/ClickCapture";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  PLATFORM_ID,
  Renderer2,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
  }
}

@Component({
  selector: "uf-tally",
  imports: [ClickCapture, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    @let trail = this.trail();
    <section
      class="tally"
      aria-label="Tally"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">Count: {{ count }}</p>
      <button type="button" (click)="addTwice()">Add two</button>
      <button type="button" (click)="addFive()">Add five</button>
      <button type="button" (click)="countUp()">Count up three</button>
      <button type="button" (click)="addTenAndReport()">Add ten</button>
      <button
        type="button"
        (ufClickCapture)="logCapture()"
        (click)="logBubble()"
      >Log the phases</button>
      <p>Phases: {{ trail.join(" then ") }}</p>
    </section>
  `,
})
export default class Tally {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly total = output<number>();
  readonly steps = output<number[]>();
  readonly logged = output<string[]>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly count = signal(0);
  protected readonly trail = signal<string[]>([]);

  protected addTwice() {
    this.count.update((count) => count + 1);
    this.count.update((count) => count + 1);
    this.total.emit(this.count());
  }

  protected addFive() {
    this.count.update((count) => count + 5);
    this.total.emit(this.count());
  }

  protected countUp() {
    const seen: number[] = [];
    for (let step = 0; step < 3; step++) {
      this.count.update((count) => count + 1);
      seen.push(this.count());
    }
    this.steps.emit(seen);
  }

  private addTen() {
    this.count.update((count) => count + 10);
  }

  protected addTenAndReport() {
    this.addTen();
    this.total.emit(this.count());
  }

  protected logCapture() {
    this.trail.set([...this.trail(), "capture"]);
  }

  protected logBubble() {
    this.trail.set([...this.trail(), "bubble"]);
    this.logged.emit(this.trail());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
