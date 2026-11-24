import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface SummaryProps {
  name: string;
  plan: string;
  seats: number;
}

@Component({
  selector: "uf-summary",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let plan = this.plan();
    @let seats = this.seats();
    <div
      class="summary"
      [style]="{ display: 'table', 'border-spacing': '8px 4px', ...this.style() }"
      [class]="this.class()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <div style="display: table-caption; font-weight: 700">Account</div>
      <div style="display: table-row">
        <span style="display: table-cell">Name</span>
        <span style="display: table-cell">{{ name }}</span>
      </div>
      <div style="display: table-row">
        <span style="display: table-cell">Plan</span>
        <span style="display: table-cell">{{ plan }} for {{ seats }} seats</span>
      </div>
      <p>Billed to <span style="display: table-cell; padding: 0 4px">{{ name }}</span> monthly.</p>
    </div>
  `,
})
export default class Summary {
  readonly name = input.required<string>();
  readonly plan = input.required<string>();
  readonly seats = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
