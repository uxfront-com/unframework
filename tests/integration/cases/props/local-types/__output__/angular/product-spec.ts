import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

type Availability = "in-stock" | "backorder" | "discontinued";

interface Finish {
  sku: string;
  label: string;
}

export interface ProductSpecProps {
  name: string;
  availability: Availability;
  size: { width: number; depth: number; unit: "cm" | "in" };
  finishes: Finish[];
}

@Component({
  selector: "uf-product-spec",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let availability = this.availability();
    @let size = this.size();
    @let finishes = this.finishes();
    <section
      class="product-spec"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : name"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ name }}</h2>
      <dl>
        <dt>Availability</dt>
        <dd>{{ availability }}</dd>
        <dt>Size</dt>
        <dd>{{ size.width }} × {{ size.depth }}&ngsp;{{ size.unit }}</dd>
      </dl>
      <ul>
        @for (finish of finishes; track finish.sku) {
          <li>{{ finish.label }} ({{ finish.sku }})</li>
        }
      </ul>
    </section>
  `,
})
export default class ProductSpec {
  readonly name = input.required<string>();
  readonly availability = input.required<Availability>();
  readonly size = input.required<{ width: number; depth: number; unit: "cm" | "in" }>();
  readonly finishes = input.required<Finish[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
