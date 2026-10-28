import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  TemplateRef,
  contentChild,
  inject,
  input,
} from "@angular/core";

/** What a template of `Options`'s `option` slot reads: the slot's props. */
export type OptionsOptionContext = { option: T };

/** A template of `Options`'s `option` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufOptionsOption]" })
export class OptionsOption {
  static ngTemplateContextGuard(
    _directive: OptionsOption,
    _context: unknown,
  ): _context is OptionsOptionContext & { $implicit: OptionsOptionContext } {
    return true;
  }
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
  selector: "uf-options",
  imports: [NgTemplateOutlet, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let options = this.options();
    <ul [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      @for (option of options; track option.value) {
        <li>
          @if (this.optionTemplate(); as template) {
            <ng-container
              [ngTemplateOutlet]="template"
              [ngTemplateOutletContext]="{ $implicit: { option: option }, option: option }"
            />
          }
        </li>
      }
    </ul>
    <ng-content select="[ufOptionsOption]" />
  `,
})
export default class Options {
  readonly options = input.required<T[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly optionTemplate = contentChild(OptionsOption, { read: TemplateRef });
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
