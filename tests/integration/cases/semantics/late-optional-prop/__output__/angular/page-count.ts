import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from "@angular/core";

export interface PageCountProps {
  page?: number;
  total: number;
}

@Component({
  selector: "uf-page-count",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let page = this.page();
    @let label = this.label();
    <nav
      class="page-count"
      aria-label="Pages"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly pageChange = output<[page: number, previous: number]>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
