import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

interface FieldAttributes {
  name: string;
  placeholder?: string;
  autocomplete?: "email" | "username";
  maxlength?: number;
  required?: boolean;
  title?: string;
}

interface HintAttributes {
  id: string;
  title?: string;
}

export interface TextFieldProps {
  label: string;
  inputId: string;
  hintText: string;
  field: FieldAttributes;
  hint?: HintAttributes;
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
  selector: "uf-text-field",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let inputId = this.inputId();
    @let hintText = this.hintText();
    @let field = this.field();
    @let hint = this.hint();
    <div class="text-field" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <label [attr.for]="inputId">{{ label }}</label>
      <input
        [attr.id]="inputId"
        type="text"
        [attr.name]="field.name"
        [attr.placeholder]="field.placeholder"
        [attr.autocomplete]="field.autocomplete"
        [attr.maxlength]="field.maxlength"
        [attr.required]="field.required ? '' : null"
        [attr.title]="field.title"
      />
      <p class="text-field-hint" [attr.id]="hint?.id" [attr.title]="hint?.title">{{ hintText }}</p>
    </div>
  `,
})
export default class TextField {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly hintText = input.required<string>();
  readonly field = input.required<FieldAttributes>();
  readonly hint = input<HintAttributes>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
