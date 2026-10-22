import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
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
  selector: "uf-tag",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let colour = this.colour();
    @let weight = this.weight();
    @let indent = this.indent();
    <span
      class="tag"
      [style]="{ display: 'inline-block', padding: '2px 8px', 'border-style': 'solid', 'border-width': '1px', 'border-color': colour ?? '#5a5a5a', color: colour, 'font-weight': weight, 'margin-left': indent, ...this.style() }"
      [class]="this.class()"
      [ufScope]="this.host"
    >{{ label }}</span>
  `,
})
export default class Tag {
  readonly label = input.required<string>();
  readonly colour = input<string>();
  readonly weight = input<number>();
  readonly indent = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
