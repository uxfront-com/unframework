import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface ArticlePreviewProps {
  title: string;
  text: string;
}

@Component({
  selector: "uf-article-preview",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let text = this.text();
    @let characters = this.characters();
    @let counted = this.counted();
    <article
      class="article-preview"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : title"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ title }}</h2>
      <p #body>{{ text }}</p>
      <p role="status">{{ counted ? characters + " characters" : "Counting the characters" }}</p>
    </article>
  `,
})
export default class ArticlePreview {
  readonly title = input.required<string>();
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ready = output<number>();
  private readonly body = viewChild<ElementRef<HTMLParagraphElement>>("body");
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly characters = signal(0);
  protected readonly counted = signal(false);

  constructor() {
    afterNextRender(() => {
      const length = this.body()?.nativeElement.textContent?.length ?? 0;
      this.characters.set(length);
      this.counted.set(true);
      this.ready.emit(length);
    });
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
