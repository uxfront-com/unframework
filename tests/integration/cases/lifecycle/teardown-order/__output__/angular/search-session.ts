import { isPlatformBrowser } from "@angular/common";
import {
  type AfterRenderRef,
  Component,
  Directive,
  type EffectRef,
  ElementRef,
  Injector,
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
  selector: "uf-search-session",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let results = this.results();
    <section
      class="search-session"
      aria-label="Search"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
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
  readonly unmounted = output<void>();
  readonly effectCleaned = output<string>();
  readonly watchCleaned = output<string>();
  readonly searched = output<[query: string, count: number]>();
  readonly searchCleaned = output<string>();
  readonly summary = output<string>();
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
