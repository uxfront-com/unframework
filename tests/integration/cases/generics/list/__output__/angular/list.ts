import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
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
  selector: "uf-list",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let items = this.items();
    @let selected = this.selected();
    <ul
      [attr.aria-label]="label"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      @for (item of items; track index; let index = $index) {
        <li [attr.aria-current]="item === selected ? 'true' : undefined">{{ String(item) }}</li>
      }
    </ul>
  `,
})
export default class List<T> {
  readonly label = input.required<string>();
  readonly items = input.required<T[]>();
  readonly selected = input<T>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly String = String;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
