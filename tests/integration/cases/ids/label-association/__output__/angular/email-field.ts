import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

let nextId = 0;

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
  selector: "uf-email-field",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let hint = this.hint();
    <div class="email-field" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <label [attr.for]="inputId">{{ label }}</label>
      <input [attr.id]="inputId" name="email" type="email" [attr.aria-describedby]="hintId" />
      <p [attr.id]="hintId">{{ hint }}</p>
    </div>
  `,
})
export default class EmailField {
  readonly label = input.required<string>();
  readonly hint = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly inputId = `uf-id-email-field-${nextId++}`;
  protected readonly hintId = `uf-id-email-field-${nextId++}`;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
