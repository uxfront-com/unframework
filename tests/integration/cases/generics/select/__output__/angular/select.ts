import { isPlatformServer } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  inject,
  input,
  model,
} from "@angular/core";

export interface SelectProps<T extends string> {
  label: string;
  options: readonly T[];
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
  selector: "uf-select",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let options = this.options();
    <label
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >{{ label }}&ngsp;<select
      #valueField
      (change)="this.value.set(valueField.value)"
    >@for (option of options; track option) {<option
      [attr.value]="option"
      [selected]="this.value() === option" [defaultSelected]="onServer && this.value() === option"
    >{{ option }}</option>}</select></label>
  `,
})
export default class Select {
  readonly label = input.required<string>();
  readonly options = input.required<readonly T[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly value = model.required<T>();
  protected readonly onServer = isPlatformServer(inject(PLATFORM_ID));
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
