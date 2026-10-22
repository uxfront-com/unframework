import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface ContactLineProps {
  name: string;
  phone?: string | null;
  verified?: boolean | null;
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
  selector: "uf-contact-line",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let phone = this.phone();
    @let verified = this.verified();
    <section
      class="contact-line"
      [attr.aria-label]="name"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p
        [attr.data-phone]="phone === null ? 'withheld' : phone"
      >Phone: {{ phone === null ? "withheld" : (phone ?? "not given yet") }}</p>
      <p>{{ verified === null ? "Verification pending" : verified ? "Verified" : "Not verified" }}</p>
    </section>
  `,
})
export default class ContactLine {
  readonly name = input.required<string>();
  readonly phone = input<string | null>();
  readonly verified = input<boolean | null>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
