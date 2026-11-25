import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, afterNextRender, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-icon-link",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let label = this.label();
    <a
      #link
      [attr.href]="'href' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['href'] : href"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M2 8h10M8 4l4 4-4 4" />
      </svg>
    </a>
  `,
})
export default class IconLink {
  readonly href = input.required<string>();
  readonly label = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly link = viewChild<ElementRef<HTMLAnchorElement>>("link");
  readonly ufElement = viewChild<ElementRef<HTMLAnchorElement>>("ufElement");

  constructor() {
    afterNextRender(() => {
      if (typeof ngDevMode === "undefined" || ngDevMode) {
        const name =
          this.link()?.nativeElement.getAttribute("aria-label") ??
          this.link()?.nativeElement.textContent?.trim();
        if (!name) console.warn("IconLink has no accessible name: give it a `label` or some text.");
      }
    });
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
