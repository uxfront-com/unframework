import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
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
  selector: "uf-review-summary",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let steps = this.steps();
    @let score = this.score();
    @let sku = this.sku();
    @let product = this.product();
    <section
      class="review-summary"
      aria-label="Review"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
