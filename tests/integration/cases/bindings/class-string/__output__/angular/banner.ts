import { Component, input } from "@angular/core";

export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

@Component({
  selector: "uf-banner",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    @let tone = this.tone();
    @let emphasis = this.emphasis();
    <div class="banner" [class]="tone" role="note">
      <p [class]="emphasis">{{ message }}</p>
      <p [class]="'banner-footer banner-footer-' + tone">Shown to every visitor.</p>
    </div>
  `,
})
export default class Banner {
  readonly message = input.required<string>();
  readonly tone = input.required<string>();
  readonly emphasis = input<string | null>();
}
