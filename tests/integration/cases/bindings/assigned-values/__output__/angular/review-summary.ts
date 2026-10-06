import { Component, input } from "@angular/core";

export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
}

@Component({
  selector: "uf-review-summary",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let steps = this.steps();
    @let score = this.score();
    @let sku = this.sku();
    @let product = this.product();
    <section class="review-summary" aria-label="Review">
      <ol>
        @for (step of steps; track step; let index = $index) {
          <li [attr.value]="index">{{ step }}</li>
        }
      </ol>
      <meter min="0" max="10" [attr.value]="score" aria-label="Score">{{ score }} out of 10</meter>
      <p>Product: <data [attr.value]="sku">{{ product }}</data></p>
    </section>
  `,
})
export default class ReviewSummary {
  readonly steps = input.required<string[]>();
  readonly score = input.required<number>();
  readonly sku = input.required<string>();
  readonly product = input.required<string>();
}
