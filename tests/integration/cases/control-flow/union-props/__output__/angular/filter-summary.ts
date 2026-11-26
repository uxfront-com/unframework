import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

type LookupResult = { ok: true; match: string } | { ok: false; error: string };

export interface FilterSummaryProps {
  tags: string | string[];
  limit: number | string;
  result: LookupResult;
}

@Component({
  selector: "uf-filter-summary",
  imports: [ScopeAttributes, Fallthrough],
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
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly Array = Array;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
