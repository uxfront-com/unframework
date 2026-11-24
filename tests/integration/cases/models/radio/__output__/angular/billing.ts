import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-billing",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let plan = this.plan();
    <fieldset
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLFieldSetElement>>("ufElement");
  protected readonly plan = signal("monthly");

  protected onReset() {
    this.plan.set("monthly");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
