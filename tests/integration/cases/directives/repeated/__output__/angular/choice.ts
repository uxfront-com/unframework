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

/** A template of `Choice`'s `body` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufChoiceBody]" })
export class ChoiceBody {
  static ngTemplateContextGuard(
    _directive: ChoiceBody,
    _context: unknown,
  ): _context is Record<never, never> {
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
  selector: "uf-choice",
  imports: [NgTemplateOutlet, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let first = this.first();
    <div class="choice" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      @if (first) {
        <b>
          @if (this.bodyTemplate(); as template) {
            <ng-container [ngTemplateOutlet]="template" />
          }
        </b>
      } @else {
        <i>
          @if (this.bodyTemplate(); as template) {
            <ng-container [ngTemplateOutlet]="template" />
          }
        </i>
      }
      <button type="button" (click)="onSwitch()">Switch</button>
    </div>
    <ng-content select="[ufChoiceBody]" />
  `,
})
export default class Choice {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly bodyTemplate = contentChild(ChoiceBody, { read: TemplateRef });
  protected readonly first = signal(true);

  protected onSwitch() {
    this.first.set(!this.first());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
