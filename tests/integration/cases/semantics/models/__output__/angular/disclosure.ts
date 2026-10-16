import { Component, input, model } from "@angular/core";

@Component({
  selector: "uf-disclosure",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let open = this.open();
    <div class="disclosure" [class]="this.class()" [style]="this.style()">
      <button type="button" [attr.aria-expanded]="open" (click)="onClick()">{{ title }}</button>
      @if (open) {
        <p>Details of {{ title }}</p>
      }
    </div>
  `,
})
export default class Disclosure {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly open = model<boolean>(false);

  protected onClick() {
    this.open.set(!this.open());
  }
}
