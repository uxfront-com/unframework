import {
  Component,
  Injector,
  type OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
} from "@angular/core";

@Component({
  selector: "uf-name-sorter",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let names = this.names();
    @let count = this.count();
    <section class="name-sorter" aria-label="Names">
      <p>Names: {{ names.join(", ") }}</p>
      <p>Added: {{ count }}</p>
      <button type="button" (click)="add('Bo')">Add Bo</button>
      <button type="button" (click)="report()">Report</button>
    </section>
  `,
})
export default class NameSorter implements OnInit {
  readonly started = output<string>();
  readonly firstSeen = output<string>();
  readonly secondSeen = output<number>();
  readonly total = output<number>();
  private readonly injector = inject(Injector);
  private readonly compare = (a: string, b: string): number => {
    return a < b ? -1 : a > b ? 1 : 0;
  };
  protected readonly names = signal(["Cy", "Al"].toSorted((a, b) => this.compare(a, b)));
  protected readonly count = signal(0);
  private readonly doubled = computed(() => this.count() * 2);
  private readonly letters = computed(() => this.names().join("").length);

  constructor() {
    afterNextRender(() => {
      this.started.emit(`first ${this.describe()}`);
    });

    afterNextRender(() => {
      this.started.emit("second");
    });
  }

  ngOnInit(): void {
    const currentCount = computed(() => this.count());
    let lastCount = currentCount();
    effect(
      () => {
        const value = currentCount();
        if (Object.is(value, lastCount)) return;
        lastCount = value;
        untracked(() => {
          this.firstSeen.emit(this.describe());
        });
      },
      { injector: this.injector },
    );

    const currentCount_1 = computed(() => this.count());
    let lastCount_1 = currentCount_1();
    effect(
      () => {
        const value = currentCount_1();
        if (Object.is(value, lastCount_1)) return;
        lastCount_1 = value;
        untracked(() => {
          this.secondSeen.emit(value);
        });
      },
      { injector: this.injector },
    );
  }

  private describe(): string {
    return `doubled ${this.doubled()}`;
  }

  protected add(name: string) {
    this.names.set([...this.names(), name].toSorted(this.compare));
    this.count.update((count) => count + 1);
  }

  protected report() {
    this.total.emit(this.letters());
  }
}
