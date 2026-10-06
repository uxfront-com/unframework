import { Component, input } from "@angular/core";

export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

@Component({
  selector: "uf-article-skeleton",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    <article class="article-skeleton" aria-busy="true" aria-label="Loading article">
      <p>Loading the article</p>
    </article>
  `,
})
export default class ArticleSkeleton {
  readonly title = input.required<string>();
  readonly summary = input<string>();
  readonly minutes = input<number>();
}
