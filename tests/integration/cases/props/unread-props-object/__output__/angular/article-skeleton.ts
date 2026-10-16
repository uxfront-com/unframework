import { Component, input } from "@angular/core";

export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

@Component({
  selector: "uf-article-skeleton",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <article
      class="article-skeleton"
      aria-busy="true"
      aria-label="Loading article"
      [class]="this.class()"
      [style]="this.style()"
    >
      <p>Loading the article</p>
    </article>
  `,
})
export default class ArticleSkeleton {
  readonly title = input.required<string>();
  readonly summary = input<string>();
  readonly minutes = input<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
