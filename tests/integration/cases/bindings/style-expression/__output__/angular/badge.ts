import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { styleObject } from "./_unframework/styleObject";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface BadgeProps {
  label: string;
  tone?: string;
}

@Component({
  selector: "uf-badge",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let tone = this.tone();
    <span
      class="badge"
      [style]="{ ...styleObject(tone), ...this.style() }"
      [class]="this.class()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ label }}</span>
  `,
})
export default class Badge {
  readonly label = input.required<string>();
  readonly tone = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLSpanElement>>("ufElement");
  protected readonly styleObject = styleObject;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
