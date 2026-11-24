import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

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
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let summary = this.summary();
    @let minutes = this.minutes();
    <article
      class="article-teaser"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : title"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
