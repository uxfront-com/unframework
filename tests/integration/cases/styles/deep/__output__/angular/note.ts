import { Component, input } from "@angular/core";

@Component({
  selector: "uf-note",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <div class="note-box" [class]="this.class()" [style]="this.style()">
      <p class="note">{{ text }}</p>
    </div>
  `,
})
export default class Note {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
