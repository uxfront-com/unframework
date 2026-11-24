import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  TemplateRef,
  ViewEncapsulation,
  contentChild,
  inject,
  input,
  viewChild,
} from "@angular/core";

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
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <figure
      class="frame"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      data-uf-9dc516fd=""
      [ufScope]="this.host"
      #ufElement
    >
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
  styleUrl: "./Frame.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Frame {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly labelTemplate = contentChild(FrameLabel, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
