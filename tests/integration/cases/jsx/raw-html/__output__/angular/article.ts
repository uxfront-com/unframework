import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Pipe,
  type PipeTransform,
  Renderer2,
  inject,
  input,
} from "@angular/core";
import { DomSanitizer, type SafeHtml } from "@angular/platform-browser";

export interface ArticleProps {
  title: string;
  body: string;
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

/** Marks markup trusted, so that `[innerHTML]` renders it as written. */
@Pipe({ name: "trustedHtml" })
class TrustedHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

@Component({
  selector: "uf-article",
  imports: [ScopeAttributes, TrustedHtmlPipe],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let body = this.body();
    <article class="article" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
