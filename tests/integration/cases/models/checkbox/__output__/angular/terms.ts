import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-terms",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let agreed = this.agreed();
    <section aria-label="Terms" [class]="this.class()" [style]="this.style()">
      <label><input
        type="checkbox"
        #agreedField
        [checked]="this.agreed()"
        (change)="this.agreed.set(agreedField.checked)"
      /> I agree</label>
      <output>{{ agreed ? "Agreed" : "Not agreed" }}</output>
      <button type="button" (click)="onToggle()">Toggle</button>
    </section>
  `,
})
export default class Terms {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly agreed = signal(false);

  protected onToggle() {
    this.agreed.set(!this.agreed());
  }
}
