import {
  Component,
  Injector,
  type OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from "@angular/core";

export interface PageCountProps {
  page?: number;
  total: number;
}

@Component({
  selector: "uf-page-count",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let page = this.page();
    @let label = this.label();
    <nav class="page-count" aria-label="Pages">
      <p role="status">{{ label }}</p>
      <p>Direct: {{ page }}</p>
    </nav>
  `,
})
export default class PageCount implements OnInit {
  readonly page = input<number, number | undefined>(1, {
    transform: (value) => (value === undefined ? 1 : value),
  });
  readonly total = input.required<number>();
  readonly pageChange = output<[page: number, previous: number]>();
  private readonly injector = inject(Injector);
  protected readonly label = computed(() => `Page ${this.page()} of ${this.total()}`);

  ngOnInit(): void {
    let lastPage = this.page();
    effect(
      () => {
        const next = this.page();
        if (Object.is(next, lastPage)) return;
        const previous = lastPage;
        lastPage = next;
        untracked(() => {
          this.pageChange.emit([next, previous]);
        });
      },
      { injector: this.injector },
    );
  }
}
