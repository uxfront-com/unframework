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

/** A template of `Action`'s `icon` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufActionIcon]" })
export class ActionIcon {
  static ngTemplateContextGuard(
    _directive: ActionIcon,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-action",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let label = this.label();
    <ng-template #defaultSlot>
      <ng-content>{{ label }}</ng-content>
    </ng-template>
    @switch (href ? "a" : "button") {
      @case ("a") {
        <a
          [attr.href]="'href' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['href'] : href"
          class="action"
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          @if (this.iconTemplate(); as template) {
            <ng-container [ngTemplateOutlet]="template" />
          }
          <span data-slot="label">
            <ng-container [ngTemplateOutlet]="defaultSlot" />
          </span>
        </a>
      } @case ("button") {
        <button
          class="action"
          [class]="this.class()"
          [style]="this.style()"
          [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
          [ufScope]="this.host"
          #ufElement
        >
          @if (this.iconTemplate(); as template) {
            <ng-container [ngTemplateOutlet]="template" />
          }
          <span data-slot="label">
            <ng-container [ngTemplateOutlet]="defaultSlot" />
          </span>
        </button>
      }
    }
    <ng-content select="[ufActionIcon]" />
  `,
})
export default class Action {
  readonly href = input<string>();
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly iconTemplate = contentChild(ActionIcon, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLAnchorElement | HTMLButtonElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
