import Row from "./row";
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
  selector: "uf-list",
  imports: [Row, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div
      class="list"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-ced7d23e=""
      [ufScope]="this.host"
    >
      <uf-row [text]="'One'" data-uf-ced7d23e="" />
      <uf-row [text]="'Two'" data-uf-ced7d23e="" />
    </div>
  `,
  styleUrl: "./List.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class List {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
