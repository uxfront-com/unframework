import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
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
  selector: "uf-contact-card",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let jobTitle = this.jobTitle();
    @let team = this.team();
    @let pronouns = this.pronouns();
    @let phone = this.phone();
    <article
      class="contact-card"
      [attr.aria-label]="name"
      [attr.data-team]="team"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <h2 [attr.title]="pronouns">{{ name }}</h2>
      <p>{{ jobTitle }}</p>
      <p>Phone: {{ phone ?? "not listed" }}</p>
    </article>
  `,
})
export default class ContactCard {
  readonly name = input.required<string>();
  readonly jobTitle = input<string>();
  readonly team = input<string>();
  readonly pronouns = input<string>();
  readonly phone = input<string | null>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
