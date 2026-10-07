import {
  Component,
  ElementRef,
  afterNextRender,
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
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let text = this.text();
    @let characters = this.characters();
    @let counted = this.counted();
    <article class="article-preview" [attr.aria-label]="title">
      <h2>{{ title }}</h2>
      <p #body>{{ text }}</p>
      <p role="status">{{ counted ? characters + " characters" : "Counting the characters" }}</p>
    </article>
  `,
})
export default class ArticlePreview {
  readonly title = input.required<string>();
  readonly text = input.required<string>();
  readonly ready = output<number>();
  private readonly body = viewChild<ElementRef<HTMLParagraphElement>>("body");
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
}
