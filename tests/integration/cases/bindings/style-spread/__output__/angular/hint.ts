import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { styleObject } from "./_unframework/styleObject";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

interface HintAttributes {
  id: string;
  style?: string;
}

export interface HintProps {
  text: string;
  attrs: HintAttributes;
}

@Component({
  selector: "uf-hint",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    @let attrs = this.attrs();
    <small
      [attr.id]="'id' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['id'] : attrs.id"
      [class]="this.class()"
      [style]="{ ...styleObject(attrs.style), ...this.style() }"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ text }}</small>
  `,
})
export default class Hint {
  readonly text = input.required<string>();
  readonly attrs = input.required<HintAttributes>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly styleObject = styleObject;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
