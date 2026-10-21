import Note from "./note";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-article",
  imports: [Note],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let note = this.note();
    <article class="article" [class]="this.class()" [style]="this.style()" data-uf-15946226="">
      <h2 class="title" data-uf-15946226="">{{ title }}</h2>
      <uf-note [text]="note" data-uf-15946226="" />
    </article>
  `,
})
export default class Article {
  readonly title = input.required<string>();
  readonly note = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
