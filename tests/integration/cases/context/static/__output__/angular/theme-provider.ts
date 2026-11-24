import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Badge from "./badge";
import { Component, ElementRef, InjectionToken, inject, input, viewChild } from "@angular/core";

export interface Theme {
  accent: string;
  label: string;
}

export const ThemeKey = new InjectionToken<Theme>("uf.theme");

@Component({
  selector: "uf-theme-provider",
  imports: [Badge, ScopeAttributes, Fallthrough],
  providers: [{ provide: ThemeKey, useValue: { accent: "teal", label: "Teal" } }],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section
      aria-label="Themed"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-badge [text]="'New'" />
    </section>
  `,
})
export default class ThemeProvider {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
