import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface BadgeProps {
  label: string;
  tone?: string;
}

/**
 * A style bound to a value as an object of CSS properties (ADR-0065), which a merge spreads: a
 * declaration list splits as Vue's parseStringStyle splits it, and an object's camel-case keys
 * are written in kebab case, as the template writes its declarations.
 */
function styleObject(
  style: object | string | null | undefined,
): Record<string, string | null | undefined> {
  const properties: Record<string, string | null | undefined> = {};
  if (typeof style === "string") {
    for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
      const [property, value] = declaration.split(/:([^]+)/);
      const key = property!.trim();
      // Only a CSS identifier is a property: anything else would reach the markup as written.
      if (value !== undefined && /^-?-?[A-Za-z_][\w-]*$/.test(key)) properties[key] = value.trim();
    }
    return properties;
  }
  for (const [key, value] of Object.entries(style ?? {})) {
    const kebab = key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
    properties[key.startsWith("--") ? key : kebab] =
      value === null || value === undefined ? value : String(value);
  }
  return properties;
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
  selector: "uf-badge",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let tone = this.tone();
    <span
      class="badge"
      [style]="{ ...styleObject(tone), ...this.style() }"
      [class]="this.class()"
      [ufScope]="this.host"
    >{{ label }}</span>
  `,
})
export default class Badge {
  readonly label = input.required<string>();
  readonly tone = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly styleObject = styleObject;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
