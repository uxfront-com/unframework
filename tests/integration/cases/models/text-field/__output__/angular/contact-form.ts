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
  selector: "uf-contact-form",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let email = this.email();
    <form aria-label="Contact" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <label>Name <input
        #nameField
        [value]="this.name()"
        (input)="this.name.set(nameField.value)"
      /></label>
      <label>Email <input
        type="email"
        #emailField
        [value]="this.email()"
        (input)="this.email.set(emailField.value)"
      /></label>
      <output>{{ name }} at {{ email || "no address" }}</output>
      <button type="button" (click)="onUseGrace()">Use Grace</button>
    </form>
  `,
})
export default class ContactForm {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly name = signal("Ada");
  protected readonly email = signal("");

  protected onUseGrace() {
    this.name.set("Grace");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
