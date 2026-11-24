import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  type AfterRenderRef,
  Component,
  Directive,
  type EffectRef,
  ElementRef,
  Injector,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
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
  selector: "uf-search-session",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let results = this.results();
    <section
      class="search-session"
      aria-label="Search"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Query<input name="query" (input)="onQueryInput($event)" /></label>
      <ul aria-label="Results">
        @for (result of results; track result) {
          <li>{{ result }}</li>
        }
      </ul>
      <button type="button" (click)="onClearResults()">Clear results</button>
    </section>
  `,
})
export default class SearchSession implements OnInit, OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly unmounted = output<void>();
  readonly effectCleaned = output<string>();
  readonly watchCleaned = output<string>();
  readonly searched = output<[query: string, count: number]>();
  readonly searchCleaned = output<string>();
  readonly summary = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly query = signal("");
  protected readonly results = signal<string[]>([]);
  private readonly renderEffect: AfterRenderRef;
  private queryWatcher?: EffectRef;
  private queryWatcher_1?: AfterRenderRef;

  constructor() {
    this.renderEffect = afterRenderEffect((onCleanup) => {
      const value = this.query();
      onCleanup(() => {
        this.effectCleaned.emit(value);
      });
    });

    afterRenderEffect(() => {
      this.summary.emit(`${this.results().length} results for "${this.query()}"`);
    });
  }

  ngOnInit(): void {
    const currentQuery = computed(() => this.query());
    this.queryWatcher = effect(
      (onCleanup) => {
        const value = currentQuery();
        if (!isPlatformBrowser(this.platformId)) return;
        untracked(() => {
          onCleanup(() => {
            this.watchCleaned.emit(value);
          });
        });
      },
      { injector: this.injector },
    );

    const currentQuery_1 = computed(() => this.query());
    let lastQuery = currentQuery_1();
    effect(
      () => {
        const value = currentQuery_1();
        if (Object.is(value, lastQuery)) return;
        lastQuery = value;
        untracked(() => {
          this.results.set(value === "" ? [] : [value, `${value} docs`]);
        });
      },
      { injector: this.injector },
    );

    const currentQuery_2 = computed(() => this.query());
    let lastQuery_1 = currentQuery_2();
    this.queryWatcher_1 = afterRenderEffect(
      (onCleanup) => {
        const value = currentQuery_2();
        if (Object.is(value, lastQuery_1)) return;
        lastQuery_1 = value;
        untracked(() => {
          this.searched.emit([value, this.results().length]);
          onCleanup(() => {
            this.searchCleaned.emit(value);
          });
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    // Before Angular stops the outputs: a cleanup may still emit, as on every target.
    this.renderEffect.destroy();
    this.queryWatcher?.destroy();
    this.queryWatcher_1?.destroy();
    if (isPlatformBrowser(this.platformId)) {
      this.unmounted.emit();
    }
  }

  protected onQueryInput(event: InputEvent) {
    this.query.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onClearResults() {
    this.results.set([]);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
