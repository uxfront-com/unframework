import Box, { BoxTitle } from "./box";
import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

/** A template of `Frame`'s `title` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufFrameTitle]" })
export class FrameTitle {
  static ngTemplateContextGuard(
    _directive: FrameTitle,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-frame",
  imports: [Box, BoxTitle, NgTemplateOutlet],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <section class="frame" [attr.aria-label]="label" [class]="this.class()" [style]="this.style()">
      <uf-box>
        <ng-content />
        @if (this.titleTemplate(); as template) {
          <ng-template ufBoxTitle>
            <ng-container [ngTemplateOutlet]="template" />
          </ng-template>
        }
      </uf-box>
    </section>
    <ng-content select="[ufFrameTitle]" />
  `,
})
export default class Frame {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly titleTemplate = contentChild(FrameTitle, { read: TemplateRef });
}
