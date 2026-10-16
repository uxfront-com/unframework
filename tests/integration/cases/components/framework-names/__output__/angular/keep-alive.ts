import { Component, input } from "@angular/core";

@Component({
  selector: "uf-keep-alive",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let level = this.level();
    <div class="level" [class]="this.class()" [style]="this.style()">
      <span>Level {{ level }}</span>
      @if (level > 0) {
        <uf-keep-alive [level]="level - 1" />
      }
    </div>
  `,
})
export default class KeepAlive {
  readonly level = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
