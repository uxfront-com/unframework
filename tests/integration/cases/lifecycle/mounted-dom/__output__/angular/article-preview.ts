import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
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

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-article-preview",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let text = this.text();
    @let characters = this.characters();
    @let counted = this.counted();
    <article
      class="article-preview"
      [attr.aria-label]="title"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
