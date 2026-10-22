import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  Renderer2,
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
  selector: "uf-page-count",
  imports: [ScopeAttributes],
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
      [ufScope]="this.host"
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
