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
  signal,
} from "@angular/core";

/** What a template of `Picker`'s `option` slot reads: the slot's props. */
export type PickerOptionContext = { option: { id: string; label: string } };

/** A template of `Picker`'s `option` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufPickerOption]" })
export class PickerOption {
  static ngTemplateContextGuard(
    _directive: PickerOption,
    _context: unknown,
  ): _context is PickerOptionContext & { $implicit: PickerOptionContext } {
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
  selector: "uf-picker",
  imports: [NgTemplateOutlet, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let options = this.options();
    <div class="picker" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <ul aria-label="Options">
        @for (option of options; track option.id) {
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
      <button type="button" (click)="onRenameOption()">Rename option</button>
    </div>
    <ng-content select="[ufPickerOption]" />
  `,
})
export default class Picker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly optionTemplate = contentChild(PickerOption, { read: TemplateRef });
  protected readonly options = signal([
    { id: "x", label: "Xray" },
    { id: "y", label: "Yankee" },
  ]);

  protected onRenameOption() {
    this.options.set(
      this.options().map((option) => (option.id === "x" ? { id: "x", label: "Xenon" } : option)),
    );
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
