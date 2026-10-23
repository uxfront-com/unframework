import Badge from "./badge";
import Tag from "./tag";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  signal,
} from "@angular/core";

type NoticeLook = {
  color?: string;
  backgroundColor?: string;
  borderLeft?: string;
  "--notice-accent"?: string;
};

type NoticeVars = { "--notice-gap"?: string };

export interface NoticeProps {
  title: string;
  look?: NoticeLook;
  declarations?: string;
  vars?: NoticeVars;
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
      // A property is a custom property or a CSS identifier: anything else would reach the markup.
      if (value !== undefined && /^(?:--[^\s"'<>&;:]+|-?[A-Za-z_][\w-]*)$/.test(key))
        properties[key.startsWith("--") ? key : key.toLowerCase()] = value.trim();
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
  selector: "uf-notice",
  imports: [Badge, Tag, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let look = this.look();
    @let declarations = this.declarations();
    @let vars = this.vars();
    @let quiet = this.quiet();
    <div class="notice" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <p [style]="look">{{ title }}</p>
      <uf-badge
        [label]="'Permanent'"
        [tone]="'padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid'"
        [style]="styleObject(look)"
      />
      <p [style]="declarations">Read the details before you continue.</p>
      @switch (quiet ? "Tag" : "Badge") {
        @case ("Tag") {
          <uf-tag
            [label]="'Optional'"
            [tone]="'font-weight: 700'"
            [style]="styleObject(declarations)"
          />
        } @case ("Badge") {
          <uf-badge
            [label]="'Optional'"
            [tone]="'font-weight: 700'"
            [style]="styleObject(declarations)"
          />
        }
      }
      <p
        [style]="quiet
          ? { color: 'rgb(90, 90, 90)' }
          : { color: 'var(--notice-accent, rgb(160, 40, 40))', fontWeight: '700' }"
      >This cannot be undone.</p>
      <button
        type="button"
        [style]="vars"
        (click)="toggle()"
      >{{ quiet ? "Emphasise" : "Quieten" }}</button>
    </div>
  `,
})
export default class Notice {
  readonly title = input.required<string>();
  readonly look = input<NoticeLook>();
  readonly declarations = input<string>();
  readonly vars = input<NoticeVars>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly quiet = signal(false);
  protected readonly styleObject = styleObject;

  protected toggle() {
    this.quiet.set(!this.quiet());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
