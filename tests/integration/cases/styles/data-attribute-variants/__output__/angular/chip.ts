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
  selector: "uf-chip",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let variant = this.variant();
    @let pressed = this.pressed();
    <button
      type="button"
      class="chip"
      [attr.data-variant]="variant"
      [attr.data-state]="pressed ? 'on' : 'off'"
      [attr.aria-pressed]="pressed ? 'true' : 'false'"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-69db3802=""
      [ufScope]="this.host"
    >{{ label }}</button>
  `,
  styleUrl: "./Chip.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Chip {
  readonly label = input.required<string>();
  readonly variant = input<"neutral" | "danger", "neutral" | "danger" | undefined>("neutral", {
    transform: (value) => (value === undefined ? "neutral" : value),
  });
  readonly pressed = input<boolean, boolean | undefined>(false, {
    transform: (value) => (value === undefined ? false : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
