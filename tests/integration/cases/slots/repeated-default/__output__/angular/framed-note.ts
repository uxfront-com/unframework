import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  TemplateRef,
  contentChild,
  inject,
  input,
  viewChild,
} from "@angular/core";

/** A template of `FramedNote`'s `default` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufFramedNoteDefault]" })
export class FramedNoteDefault {
  static ngTemplateContextGuard(
    _directive: FramedNoteDefault,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-framed-note",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    <article
      class="framed-note"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <header>
        @if (this.defaultTemplate(); as template) {
          <ng-container [ngTemplateOutlet]="template" />
        }
      </header>
      <p>{{ title }}</p>
      <footer>
        @if (this.defaultTemplate(); as template) {
          <ng-container [ngTemplateOutlet]="template" />
        }
      </footer>
    </article>
    <ng-content select="[ufFramedNoteDefault]" />
  `,
})
export default class FramedNote {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly defaultTemplate = contentChild(FramedNoteDefault, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
