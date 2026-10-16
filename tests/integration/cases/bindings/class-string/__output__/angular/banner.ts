import { Component, input } from "@angular/core";

export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

@Component({
  selector: "uf-banner",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    @let tone = this.tone();
    @let emphasis = this.emphasis();
    <div class="banner" [class]="[tone, this.class()].join(' ')" role="note" [style]="this.style()">
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
}
