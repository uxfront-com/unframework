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

/** A template of `Notice`'s `action` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufNoticeAction]" })
export class NoticeAction {
  static ngTemplateContextGuard(
    _directive: NoticeAction,
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
  selector: "uf-notice",
  imports: [NgTemplateOutlet, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <div
      role="note"
      [attr.aria-label]="label"
      class="notice"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p>
        <ng-content>
          <em>Nothing to report.</em>
        </ng-content>
      </p>
      @if (this.actionTemplate(); as template) {
        <ng-container [ngTemplateOutlet]="template" />
      } @else {
        <span class="muted">No action</span>
      }
    </div>
    <ng-content select="[ufNoticeAction]" />
  `,
})
export default class Notice {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly actionTemplate = contentChild(NoticeAction, { read: TemplateRef });
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
