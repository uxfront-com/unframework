import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

type LookupResult = { ok: true; match: string } | { ok: false; error: string };

export interface FilterSummaryProps {
  tags: string | string[];
  limit: number | string;
  result: LookupResult;
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
  selector: "uf-filter-summary",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tags = this.tags();
    @let limit = this.limit();
    @let result = this.result();
    <section
      class="filter-summary"
      aria-label="Filters"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p>Tags: {{ Array.isArray(tags) ? tags.join(", ") : tags }}</p>
      <p>Limit: {{ typeof limit === "number" ? limit.toFixed(0) : limit.toLowerCase() }}</p>
      @if (result.ok) {
        <p>Found {{ result.match }}</p>
      } @else {
        <p>No match: {{ result.error }}</p>
      }
    </section>
  `,
})
export default class FilterSummary {
  readonly tags = input.required<string | string[]>();
  readonly limit = input.required<number | string>();
  readonly result = input.required<LookupResult>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly Array = Array;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
