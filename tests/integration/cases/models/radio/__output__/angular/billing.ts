import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-billing",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let plan = this.plan();
    <fieldset [class]="this.class()" [style]="this.style()">
      <legend>Billing</legend>
      <label><input
        type="radio"
        name="plan"
        value="monthly"
        [checked]="this.plan() === 'monthly'"
        (change)="this.plan.set('monthly')"
      /> Monthly</label>
      <label><input
        type="radio"
        name="plan"
        value="yearly"
        [checked]="this.plan() === 'yearly'"
        (change)="this.plan.set('yearly')"
      /> Yearly</label>
      <output>Plan: {{ plan }}</output>
      <button type="button" (click)="onReset()">Reset</button>
    </fieldset>
  `,
})
export default class Billing {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly plan = signal("monthly");

  protected onReset() {
    this.plan.set("monthly");
  }
}
