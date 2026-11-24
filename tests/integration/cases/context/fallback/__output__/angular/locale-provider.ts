import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, InjectionToken, inject, input, viewChild } from "@angular/core";

export const LocaleKey = new InjectionToken<string>("uf.locale");

@Component({
  selector: "uf-locale-provider",
  imports: [ScopeAttributes, Fallthrough],
  providers: [{ provide: LocaleKey, useFactory: () => inject(LocaleProvider).locale() }],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let locale = this.locale();
    <div
      [attr.lang]="'lang' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['lang'] : locale"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <ng-content />
    </div>
  `,
})
export default class LocaleProvider {
  readonly locale = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
