import { Component, input } from "@angular/core";

export interface ArticleHeaderProps {
  title: string;
  subtitle?: string;
  draft: boolean;
  tags: string[];
}

@Component({
  selector: "uf-article-header",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let subtitle = this.subtitle();
    @let draft = this.draft();
    @let tags = this.tags();
    <h2>{{ title }}</h2>
    @if (subtitle) {
      <p class="article-subtitle">{{ subtitle }}</p>
    }
    @if (draft) {
      <p class="article-badge">Draft</p>
      <p>Only editors can see this article.</p>
    } @else {
      <p class="article-badge">Published</p>
      <p>Everyone can read this article.</p>
    }
    <p>Tagged {{ tags.join(", ") }}</p>
  `,
})
export default class ArticleHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly draft = input.required<boolean>();
  readonly tags = input.required<string[]>();
}
