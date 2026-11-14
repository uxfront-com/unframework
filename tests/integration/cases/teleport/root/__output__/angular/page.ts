import Toast from "./toast";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  ViewEncapsulation,
  inject,
  input,
} from "@angular/core";

export interface PageProps {
  message: string;
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
  selector: "uf-page",
  imports: [Toast, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    <section
      class="page"
      aria-label="Page"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-5a3bed67=""
      [ufScope]="this.host"
    >
      <p data-uf-5a3bed67="">Saving…</p>
      <uf-toast [message]="message" data-uf-5a3bed67="" />
    </section>
  `,
  styleUrl: "./Page.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Page {
  readonly message = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
