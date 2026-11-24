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
  selector: "uf-star-rating",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let stars = this.stars();
    <div
      class="star-rating"
      role="group"
      aria-label="Rating"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <ul>
        @for (choice of choices; track choice) {
          <li>
            <button
              type="button"
              [attr.aria-pressed]="stars >= choice"
              (click)="choose(choice)"
            >{{ choice }}&ngsp;{{ choice === 1 ? "star" : "stars" }}</button>
          </li>
        }
      </ul>
      <p role="status">{{ stars }} of 5</p>
      <button type="button" (click)="clear()">Clear</button>
    </div>
  `,
})
export default class StarRating {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly preview = output<number>();
  readonly rate = output<[stars: number, previous: number]>();
  readonly cleared = output<void>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly choices = [1, 2, 3, 4, 5];
  protected readonly stars = signal(0);

  protected choose(next: number) {
    const previous = this.stars();
    this.preview.emit(next);
    this.stars.set(next);
    this.rate.emit([this.stars(), previous]);
  }

  protected clear() {
    for (let star = this.stars() - 1; star >= 0; star--) {
      this.preview.emit(star);
    }
    this.stars.set(0);
    this.cleared.emit();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
