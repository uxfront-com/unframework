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

export interface ReadingListProps {
  shelves: string[];
}

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
  selector: "uf-reading-list",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let shelves = this.shelves();
    @let books = this.books();
    @let searching = this.searching();
    @let failure = this.failure();
    @let shelf = this.shelf();
    @let checking = this.checking();
    @let checks = this.checks();
    @let counts = this.counts();
    @let refreshing = this.refreshing();
    <section
      class="reading-list"
      aria-label="Reading list"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Search<input type="search" name="query" (input)="onQueryInput($event)" /></label>
      <p
        role="status"
      >{{ searching ? "Searching" : books.length + " found" }}{{ failure === "" ? "" : ": " + failure }}</p>
      <ul aria-label="Books">
        @for (book of books; track book) {
          <li>{{ book }}</li>
        }
      </ul>
      <div role="group" aria-label="Shelf">
        <button type="button" [attr.aria-pressed]="shelf === 'all'" (click)="onAll()">All</button>
        <button
          type="button"
          [attr.aria-pressed]="shelf === 'unread'"
          (click)="onUnread()"
        >Unread</button>
      </div>
      <button
        type="button"
        [attr.aria-pressed]="checking"
        (click)="onCheckForNewBooks()"
      >Check for new books</button>
      <p>Checks: {{ checks }}</p>
      <button type="button" (click)="refreshAll()">Refresh shelves</button>
      <ul aria-label="Shelves">
        @for (name of shelves; track name) {
          <li>{{ name }}: {{ counts[name] ?? "not counted" }}</li>
        }
      </ul>
      <p>{{ refreshing ? "Refreshing" : "Up to date" }}</p>
    </section>
  `,
})
export default class ReadingList implements OnInit, OnDestroy {
  readonly shelves = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly requested = output<string>();
  readonly cancelled = output<string>();
  readonly found = output<[query: string, count: number]>();
  readonly started = output<void>();
  readonly checked = output<number>();
  readonly refreshed = output<number>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly countShelf = async (name: string) => {
    const response = await fetch(`/api/shelves?${new URLSearchParams({ name })}`);
    const list = (await response.json()) as string[];
    this.counts.set({ ...this.counts(), [name]: list.length });
  };
  private readonly query = signal("");
  protected readonly books = signal<string[]>([]);
  protected readonly searching = signal(false);
  protected readonly failure = signal("");
  protected readonly shelf = signal("all");
  protected readonly checking = signal(false);
  protected readonly checks = signal(0);
  protected readonly counts = signal<Record<string, number>>({});
  protected readonly refreshing = signal(false);
  private checker: ReturnType<typeof setInterval> | undefined;
  private queryWatcher?: EffectRef;
  private readonly renderEffect: AfterRenderRef;

  constructor() {
    this.renderEffect = afterRenderEffect((onCleanup) => {
      if (!this.checking()) return;
      const check = () => {
        this.checks.update((checks) => checks + 1);
        this.checked.emit(this.checks());
      };
      this.checker = setInterval(check, 1000);
      this.started.emit();
      onCleanup(() => clearInterval(this.checker));
    });
  }

  ngOnInit(): void {
    const currentShelf = computed(() => this.shelf());
    let lastShelf = currentShelf();
    effect(
      () => {
        const value = currentShelf();
        if (Object.is(value, lastShelf)) return;
        lastShelf = value;
        untracked(() => {
          localStorage.setItem("reading-list:shelf", value);
        });
      },
      { injector: this.injector },
    );

    const currentQuery = computed(() => this.query());
    let lastQuery = currentQuery();
    this.queryWatcher = effect(
      (onCleanup) => {
        const value = currentQuery();
        if (Object.is(value, lastQuery)) return;
        lastQuery = value;
        untracked(async () => {
          const controller = new AbortController();
          onCleanup(() => controller.abort());
          if (value === "") {
            this.books.set([]);
            this.searching.set(false);
            return;
          }
          const url = `/api/books?${new URLSearchParams({ q: value, shelf: this.shelf() })}`;
          this.searching.set(true);
          this.failure.set("");
          this.requested.emit(url);
          try {
            const response = await fetch(url, { signal: controller.signal });
            const found = (await response.json()) as string[];
            this.books.set(found);
            this.searching.set(false);
            this.found.emit([value, found.length]);
          } catch (error) {
            if (controller.signal.aborted) {
              this.cancelled.emit(value);
              return;
            }
            this.searching.set(false);
            this.failure.set(error instanceof Error ? error.message : "The search failed");
          }
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    // Before Angular stops the outputs: a cleanup may still emit, as on every target.
    this.queryWatcher?.destroy();
    this.renderEffect.destroy();
  }

  protected async refreshAll() {
    this.refreshing.set(true);
    await Promise.all(this.shelves().map(this.countShelf));
    this.refreshing.set(false);
    this.refreshed.emit(
      this.shelves().reduce((total, name) => total + (this.counts()[name] ?? 0), 0),
    );
  }

  protected onQueryInput(event: InputEvent) {
    this.query.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onAll() {
    this.shelf.set("all");
  }

  protected onUnread() {
    this.shelf.set("unread");
  }

  protected onCheckForNewBooks() {
    this.checking.set(!this.checking());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
