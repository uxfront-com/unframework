import { Component, input } from "@angular/core";

export interface CommentQuoteProps {
  author: string;
  comment: string;
}

@Component({
  selector: "uf-comment-quote",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let author = this.author();
    @let comment = this.comment();
    <figure class="comment-quote">
      <blockquote style="margin: 0; padding: 0">
        <p dir="auto">{{ comment }}</p>
      </blockquote>
      <figcaption>{{ author }}</figcaption>
    </figure>
  `,
})
export default class CommentQuote {
  readonly author = input.required<string>();
  readonly comment = input.required<string>();
}
