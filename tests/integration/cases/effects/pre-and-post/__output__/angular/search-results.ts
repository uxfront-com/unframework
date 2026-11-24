import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  ApplicationRef,
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
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
  selector: "uf-search-results",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let status = this.status();
    @let results = this.results();
    @let doubled = this.doubled();
    <section
      class="search-results"
      aria-label="Search"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p #banner>{{ status }}</p>
      <label>Query<input name="query" (input)="onQueryInput($event)" /></label>
      <ul #list aria-label="Results">
        @for (result of results; track result) {
          <li>{{ result }}</li>
        }
      </ul>
      <output #total>{{ doubled }}</output>
      <button type="button" (click)="addOne()">Add one</button>
    </section>
  `,
})
export default class SearchResults implements OnInit {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ready = output<string>();
  readonly rendered = output<number>();
  readonly shown = output<string>();
  private readonly banner = viewChild<ElementRef<HTMLParagraphElement>>("banner");
  private readonly list = viewChild<ElementRef<HTMLUListElement>>("list");
  private readonly total = viewChild<ElementRef<HTMLOutputElement>>("total");
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly appRef = inject(ApplicationRef);
  protected readonly status = signal("Loading");
  private readonly query = signal("");
  protected readonly results = signal<string[]>([]);
  private readonly count = signal(0);
  protected readonly doubled = signal(0);

  constructor() {
    afterNextRender(async () => {
      this.status.set("Ready");
      await this.nextTick();
      this.ready.emit(this.banner()?.nativeElement.textContent ?? "");
    });
  }

  ngOnInit(): void {
    const currentQuery = computed(() => this.query());
    let lastQuery = currentQuery();
    effect(
      () => {
        const value = currentQuery();
        if (Object.is(value, lastQuery)) return;
        lastQuery = value;
        untracked(() => {
          this.results.set(value === "" ? [] : [value, `${value} docs`]);
        });
      },
      { injector: this.injector },
    );

    const currentQuery_1 = computed(() => this.query());
    let lastQuery_1 = currentQuery_1();
    afterRenderEffect(
      () => {
        const value = currentQuery_1();
        if (Object.is(value, lastQuery_1)) return;
        lastQuery_1 = value;
        untracked(() => {
          this.rendered.emit(this.list()?.nativeElement.childElementCount ?? -1);
        });
      },
      { injector: this.injector },
    );

    const currentCount = computed(() => this.count());
    let lastCount = currentCount();
    effect(
      () => {
        const value = currentCount();
        if (Object.is(value, lastCount)) return;
        lastCount = value;
        untracked(() => {
          this.doubled.set(value * 2);
        });
      },
      { injector: this.injector },
    );
  }

  protected async addOne() {
    this.count.update((count) => count + 1);
    await this.nextTick();
    this.shown.emit(this.total()?.nativeElement.textContent ?? "");
  }

  protected onQueryInput(event: InputEvent) {
    this.query.set((event.currentTarget as HTMLInputElement).value);
  }

  private async nextTick(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
