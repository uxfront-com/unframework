import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

/** What a template of `Frame`'s `label` slot reads: the slot's props. */
export type FrameLabelContext = { text: string };

/** A template of `Frame`'s `label` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufFrameLabel]" })
export class FrameLabel {
  static ngTemplateContextGuard(
    _directive: FrameLabel,
    _context: unknown,
  ): _context is FrameLabelContext & { $implicit: FrameLabelContext } {
    return true;
  }
}

@Component({
  selector: "uf-frame",
  imports: [NgTemplateOutlet],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <figure class="frame" [class]="this.class()" [style]="this.style()" data-uf-9dc516fd="">
      <ng-content />
      @if (this.labelTemplate(); as template) {
        <ng-container
          [ngTemplateOutlet]="template"
          [ngTemplateOutletContext]="{ $implicit: { text: 'Harbour at dusk' }, text: 'Harbour at dusk' }"
        />
      }
    </figure>
    <ng-content select="[ufFrameLabel]" />
  `,
})
export default class Frame {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly labelTemplate = contentChild(FrameLabel, { read: TemplateRef });
}
