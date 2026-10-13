import Badge from "./badge";
import { Component, InjectionToken, input } from "@angular/core";

export interface Theme {
  accent: string;
  label: string;
}

export const ThemeKey = new InjectionToken<Theme>("uf.theme");

@Component({
  selector: "uf-theme-provider",
  imports: [Badge],
  providers: [{ provide: ThemeKey, useValue: { accent: "teal", label: "Teal" } }],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section aria-label="Themed" [class]="this.class()" [style]="this.style()">
      <uf-badge [text]="'New'" />
    </section>
  `,
})
export default class ThemeProvider {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
