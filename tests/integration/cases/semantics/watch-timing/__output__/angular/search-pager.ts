import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  type EffectRef,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

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
