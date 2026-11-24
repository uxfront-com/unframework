import { ClickCapture } from "./_unframework/ClickCapture";
import { ClickOnce } from "./_unframework/ClickOnce";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { WheelPassive } from "./_unframework/WheelPassive";
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
  selector: "uf-event-log",
  imports: [ClickCapture, ClickOnce, WheelPassive, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let log = this.log();
    @let volume = this.volume();
    <section
      class="event-log"
      aria-label="Event options"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <div
        class="panel"
        role="presentation"
        (ufClickCapture)="record('panel capture')"
        (click)="record('panel bubble')"
      >
        <button type="button" (click)="record('button')">Inside</button>
        <button type="button" (click)="onStopHere($event)">Stop here</button>
      </div>
      <button type="button" (ufClickOnce)="record('once')">Only once</button>
      <div class="reward" role="presentation" (click)="record('outer')">
        <button type="button" (ufClickOnce)="onClaimTheReward($event)">Claim the reward</button>
      </div>
      <div class="volume" role="group" aria-label="Volume" (ufWheelPassive)="changeVolume($event)">
        <output>{{ volume }}</output>
      </div>
      <ol aria-label="Log">
        @for (entry of log; track index; let index = $index) {
          <li>{{ entry }}</li>
        }
      </ol>
    </section>
  `,
})
export default class EventLog {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly log = signal<string[]>([]);
  protected readonly volume = signal(5);

  protected record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected changeVolume(event: WheelEvent) {
    if (event.deltaY < 0) {
      this.volume.update((volume) => volume + 1);
    } else {
      this.volume.update((volume) => volume - 1);
    }
  }

  protected onStopHere(event: PointerEvent) {
    event.stopPropagation();
    this.record("stopped");
  }

  protected onClaimTheReward(event: PointerEvent) {
    event.stopPropagation();
    this.record("claimed");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
