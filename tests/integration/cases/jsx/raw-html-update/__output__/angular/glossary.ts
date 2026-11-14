import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Pipe,
  type PipeTransform,
  Renderer2,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { DomSanitizer, type SafeHtml } from "@angular/platform-browser";

export interface GlossaryProps {
  terms: string[];
  definitions: string[];
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
  selector: "uf-glossary",
  imports: [ScopeAttributes, TrustedHtmlPipe],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let terms = this.terms();
    @let index = this.index();
    @let definition = this.definition();
    <section
      class="glossary"
      aria-label="Glossary"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <h2>{{ terms[index] }}</h2>
      <div class="definition" [innerHTML]="definition | trustedHtml"></div>
      <button type="button" (click)="next()">Next term</button>
    </section>
  `,
})
export default class Glossary {
  readonly terms = input.required<string[]>();
  readonly definitions = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly index = signal(0);
  protected readonly definition = computed(() => this.definitions()[this.index()] ?? "");

  protected next() {
    this.index.set((this.index() + 1) % this.terms().length);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
