import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

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
  selector: "uf-article-teaser",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let summary = this.summary();
    @let minutes = this.minutes();
    <article
      class="article-teaser"
      [attr.aria-label]="title"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
