import { Component, type OnInit, input, linkedSignal, untracked } from "@angular/core";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

@Component({
  selector: "uf-quantity-stepper",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let quantity = this.quantity();
    <div class="quantity-stepper" role="group" [attr.aria-label]="label">
      <output>{{ quantity }}</output>
      <button type="button" [attr.aria-label]="'Increase ' + label" (click)="onClick()">+</button>
    </div>
  `,
})
export default class QuantityStepper implements OnInit {
  readonly initial = input.required<number>();
  readonly label = input.required<string>();
  protected readonly quantity = linkedSignal(() => untracked(() => this.initial()));

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.quantity();
  }

  protected onClick() {
    this.quantity.update((quantity) => quantity + 1);
  }
}
