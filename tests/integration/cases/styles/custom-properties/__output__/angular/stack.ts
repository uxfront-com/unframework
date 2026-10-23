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
  selector: "uf-stack",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let gap = this.gap();
    @let accent = this.accent();
    <ul
      class="stack"
      [style]="{ '--gap': gap, '--accent': accent, ...this.style() }"
      [class]="this.class()"
      data-uf-e3a22111=""
      [ufScope]="this.host"
    >
      <li class="item" data-uf-e3a22111="">One</li>
      <li class="item" data-uf-e3a22111="">Two</li>
      <li class="item" data-uf-e3a22111="">Three</li>
    </ul>
  `,
  styleUrl: "./Stack.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Stack {
  readonly gap = input.required<string>();
  readonly accent = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
