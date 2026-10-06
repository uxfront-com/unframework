import { Component, input } from "@angular/core";

type LookupResult = { ok: true; match: string } | { ok: false; error: string };

export interface FilterSummaryProps {
  tags: string | string[];
  limit: number | string;
  result: LookupResult;
}

@Component({
  selector: "uf-filter-summary",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let tags = this.tags();
    @let limit = this.limit();
    @let result = this.result();
    <section class="filter-summary" aria-label="Filters">
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
  protected readonly Array = Array;
}
