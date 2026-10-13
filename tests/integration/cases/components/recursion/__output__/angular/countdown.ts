import { Component, input } from "@angular/core";

@Component({
  selector: "uf-countdown",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let from = this.from();
    <div class="level" [class]="this.class()" [style]="this.style()">
      <span>{{ from }}</span>
      @if (from > 0) {
        <uf-countdown [from]="from - 1" />
      } @else {
        <strong>Liftoff</strong>
      }
    </div>
  `,
})
export default class Countdown {
  readonly from = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
