import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

@Component({
  selector: "uf-banner",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    @let tone = this.tone();
    @let emphasis = this.emphasis();
    <div
      class="banner"
      [class]="[tone, this.class()].join(' ')"
      role="note"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p [class]="emphasis">{{ message }}</p>
      <p [class]="'banner-footer banner-footer-' + tone">Shown to every visitor.</p>
    </div>
  `,
})
export default class Banner {
  readonly message = input.required<string>();
  readonly tone = input.required<string>();
  readonly emphasis = input<string | null>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
