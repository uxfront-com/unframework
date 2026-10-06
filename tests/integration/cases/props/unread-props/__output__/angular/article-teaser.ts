import { Component, input } from "@angular/core";

export interface ArticleTeaserProps {
  title: string;
  summary: string;
  author: string;
  minutes?: number;
  featured?: boolean;
  category?: string;
  pinned?: boolean;
  layout?: "row" | "column";
}

@Component({
  selector: "uf-article-teaser",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let summary = this.summary();
    @let minutes = this.minutes();
    <article class="article-teaser" [attr.aria-label]="title">
      <h2>{{ title }}</h2>
      <p>{{ summary }}</p>
      <p class="article-teaser-meta">{{ minutes }} min read</p>
    </article>
  `,
})
export default class ArticleTeaser {
  readonly title = input.required<string>();
  readonly summary = input.required<string>();
  readonly author = input.required<string>();
  readonly minutes = input<number, number | undefined>(5, {
    transform: (value) => (value === undefined ? 5 : value),
  });
  readonly featured = input<boolean>();
  readonly category = input<string>();
  readonly pinned = input<boolean, boolean | undefined>(false, {
    transform: (value) => (value === undefined ? false : value),
  });
  readonly layout = input<"row" | "column", "row" | "column" | undefined>("row", {
    transform: (value) => (value === undefined ? "row" : value),
  });
}
