import { Component, InjectionToken, inject, input } from "@angular/core";

export const LocaleKey = new InjectionToken<string>("uf.locale");

@Component({
  selector: "uf-locale-provider",
  providers: [{ provide: LocaleKey, useFactory: () => inject(LocaleProvider).locale() }],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let locale = this.locale();
    <div [attr.lang]="locale" [class]="this.class()" [style]="this.style()">
      <ng-content />
    </div>
  `,
})
export default class LocaleProvider {
  readonly locale = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
