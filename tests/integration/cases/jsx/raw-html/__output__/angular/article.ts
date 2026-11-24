import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { TrustedHtmlPipe } from "./_unframework/TrustedHtmlPipe";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface ArticleProps {
  title: string;
  body: string;
}

@Component({
  selector: "uf-article",
  imports: [ScopeAttributes, Fallthrough, TrustedHtmlPipe],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let body = this.body();
    <article
      class="article"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ title }}</h2>
      <div class="body" [innerHTML]="body | trustedHtml"></div>
      <footer
        [innerHTML]="'\\u003csmall\\u003eFiled under \\u003cem\\u003eNews\\u003c/em\\u003e\\u003c/small\\u003e' | trustedHtml"
      ></footer>
    </article>
  `,
})
export default class Article {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
