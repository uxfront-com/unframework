import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  type OnInit,
  inject,
  input,
  linkedSignal,
  untracked,
  viewChild,
} from "@angular/core";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

@Component({
  selector: "uf-quantity-stepper",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let quantity = this.quantity();
    <div
      class="quantity-stepper"
      role="group"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <output>{{ quantity }}</output>
      <button type="button" [attr.aria-label]="'Increase ' + label" (click)="onClick()">+</button>
    </div>
  `,
})
export default class QuantityStepper implements OnInit {
  readonly initial = input.required<number>();
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly quantity = linkedSignal(() => untracked(() => this.initial()));

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.quantity();
  }

  protected onClick() {
    this.quantity.update((quantity) => quantity + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
