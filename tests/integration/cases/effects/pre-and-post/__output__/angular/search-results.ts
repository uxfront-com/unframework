import {
  ApplicationRef,
  Component,
  ElementRef,
  Injector,
  type OnInit,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-search-results",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let status = this.status();
    @let results = this.results();
    @let doubled = this.doubled();
    <section class="search-results" aria-label="Search">
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
  readonly ready = output<string>();
  readonly rendered = output<number>();
  readonly shown = output<string>();
  private readonly banner = viewChild<ElementRef<HTMLParagraphElement>>("banner");
  private readonly list = viewChild<ElementRef<HTMLUListElement>>("list");
  private readonly total = viewChild<ElementRef<HTMLOutputElement>>("total");
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
}
