import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface FilterPanelProps {
  heading: string;
  hint: string;
  category: string;
  expanded: boolean;
  inStockOnly: boolean;
  locked: boolean;
  mandatory: boolean;
  loading: boolean;
  invalid?: boolean;
  current?: "page" | "step";
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
  selector: "uf-filter-panel",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let heading = this.heading();
    @let hint = this.hint();
    @let category = this.category();
    @let expanded = this.expanded();
    @let inStockOnly = this.inStockOnly();
    @let locked = this.locked();
    @let mandatory = this.mandatory();
    @let loading = this.loading();
    @let invalid = this.invalid();
    @let current = this.current();
    <section
      class="filter-panel"
      [attr.aria-label]="heading"
      [attr.data-category]="category"
      data-layout="stacked"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <button
        type="button"
        [attr.aria-expanded]="expanded"
        aria-describedby="filter-panel-hint"
      >Price filters</button>
      <p id="filter-panel-hint">{{ hint }}</p>
      <details [attr.open]="expanded ? '' : null">
        <summary>Price range</summary>
        <label>Minimum price<input
          type="number"
          name="min-price"
          [attr.required]="mandatory ? '' : null"
          [attr.disabled]="locked ? '' : null"
          [attr.aria-invalid]="invalid"
        /></label>
      </details>
      <button
        type="button"
        [attr.aria-pressed]="inStockOnly"
        [attr.disabled]="locked ? '' : null"
      >In stock only</button>
      <nav aria-label="Filter steps">
        <a href="#filters" [attr.aria-current]="current">Filters</a>
      </nav>
      <p
        role="status"
        aria-live="polite"
        [attr.aria-busy]="loading"
      >{{ loading ? "Loading results" : "Results ready" }}</p>
    </section>
  `,
})
export default class FilterPanel {
  readonly heading = input.required<string>();
  readonly hint = input.required<string>();
  readonly category = input.required<string>();
  readonly expanded = input.required<boolean>();
  readonly inStockOnly = input.required<boolean>();
  readonly locked = input.required<boolean>();
  readonly mandatory = input.required<boolean>();
  readonly loading = input.required<boolean>();
  readonly invalid = input<boolean>();
  readonly current = input<"page" | "step">();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
