import {
  Component,
  Directive,
  ElementRef,
  InjectionToken,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface FieldProps {
  label: string;
  hint: string;
}

const idCounter = new InjectionToken<{ next: number }>("idCounter", {
  factory: () => ({ next: 0 }),
});

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
  selector: "uf-field",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let hint = this.hint();
    <p class="field" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <label [attr.for]="inputId">{{ label }}</label>
      <input [attr.id]="inputId" type="text" [attr.aria-describedby]="hintId" />
      <small [attr.id]="hintId">{{ hint }}</small>
    </p>
  `,
})
export default class Field {
  readonly label = input.required<string>();
  readonly hint = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly inputId = `uf-id-field-${inject(idCounter).next++}`;
  protected readonly hintId = `uf-id-field-${inject(idCounter).next++}`;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
