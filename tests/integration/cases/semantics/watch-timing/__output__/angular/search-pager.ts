import { isPlatformBrowser } from "@angular/common";
import {
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
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
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
  selector: "uf-search-pager",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let query = this.query();
    @let page = this.page();
    <section
      class="search-pager"
      aria-label="Search"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p
        role="status"
      >{{ query === "" ? "All results" : "Results for " + query }}, page {{ page }}</p>
      <button type="button" (click)="search('Boots')">Search boots</button>
      <button type="button" (click)="search('Sandals')">Search sandals</button>
      <button type="button" (click)="nextPage()">Next page</button>
      <button type="button" (click)="skipTwoPages()">Skip two pages</button>
    </section>
  `,
})
export default class SearchPager implements OnInit, OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly queryRun = output<[value: string, previous: string]>();
  readonly pageRun = output<[value: number, previous: number]>();
  readonly cleanedUp = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  protected readonly query = signal("");
  protected readonly page = signal(1);
  private queryWatcher?: EffectRef;

  ngOnInit(): void {
    const currentQuery = computed(() => this.query());
    let lastQuery = currentQuery();
    this.queryWatcher = effect(
      (onCleanup) => {
        const value = currentQuery();
        if (Object.is(value, lastQuery)) return;
        const previous = lastQuery;
        lastQuery = value;
        untracked(() => {
          this.queryRun.emit([value, previous]);
          onCleanup(() => {
            this.cleanedUp.emit("query");
          });
        });
      },
      { injector: this.injector },
    );

    const currentPage = computed(() => this.page());
    let lastPage = currentPage();
    effect(
      () => {
        const value = currentPage();
        if (Object.is(value, lastPage)) return;
        const previous = lastPage;
        lastPage = value;
        untracked(() => {
          this.pageRun.emit([value, previous]);
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    // Before Angular stops the outputs: a cleanup may still emit, as on every target.
    this.queryWatcher?.destroy();
  }

  protected search(term: string) {
    this.query.set(term);
    this.query.set(this.query().toLowerCase());
    this.page.set(1);
  }

  protected nextPage() {
    this.page.update((page) => page + 1);
  }

  protected skipTwoPages() {
    this.page.update((page) => page + 1);
    this.page.update((page) => page + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
