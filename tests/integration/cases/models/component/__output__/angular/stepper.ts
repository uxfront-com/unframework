import { Component, input, model } from "@angular/core";

@Component({
  selector: "uf-stepper",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let value = this.value();
    <div class="stepper" [class]="this.class()" [style]="this.style()">
      <button type="button" [attr.aria-label]="'Fewer ' + label" (click)="onClick()">-</button>
      <span>{{ label }}: {{ value }}</span>
      <button type="button" [attr.aria-label]="'More ' + label" (click)="onClick_1()">+</button>
    </div>
  `,
})
export default class Stepper {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly value = model<number>(0);

  protected onClick() {
    this.value.update((value) => value - 1);
  }

  protected onClick_1() {
    this.value.update((value) => value + 1);
  }
}
