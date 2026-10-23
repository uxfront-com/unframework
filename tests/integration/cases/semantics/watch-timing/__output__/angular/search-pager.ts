import {
  Component,
  Directive,
  type EffectRef,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
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

@Component({
  selector: "uf-search-pager",
  imports: [ScopeAttributes],
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
      [ufScope]="this.host"
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
  readonly queryRun = output<[value: string, previous: string]>();
  readonly pageRun = output<[value: number, previous: number]>();
  readonly cleanedUp = output<string>();
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
