import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

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

@Component({
  selector: "uf-notice",
  imports: [NgTemplateOutlet],
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
}
