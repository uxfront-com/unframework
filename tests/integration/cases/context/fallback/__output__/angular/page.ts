import Greeting from "./greeting";
import LocaleProvider from "./locale-provider";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-page",
  imports: [Greeting, LocaleProvider],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <main [class]="this.class()" [style]="this.style()">
      <uf-greeting [name]="'Ada'" />
      <uf-locale-provider [locale]="'pt'">
        <uf-greeting [name]="'Inês'" />
      </uf-locale-provider>
    </main>
  `,
})
export default class Page {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
