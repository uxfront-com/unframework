import Tag from "./tag";
import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-tags",
  imports: [Tag],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let active = this.active();
    <div class="tags" [class]="this.class()" [style]="this.style()">
      <uf-tag [label]="'plain'" />
      <uf-tag [label]="'wide'" [class]="'wide'" [style]="{ 'margin-left': '8px' }" />
      <uf-tag
        [label]="'toggled'"
        [class]="['picked', active ? 'active' : null].join(' ')"
        [style]="{ color: active ? 'rgb(200, 0, 0)' : undefined }"
      />
      <button type="button" (click)="onToggle()">Toggle</button>
    </div>
  `,
})
export default class Tags {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly active = signal(false);

  protected onToggle() {
    this.active.set(!this.active());
  }
}
