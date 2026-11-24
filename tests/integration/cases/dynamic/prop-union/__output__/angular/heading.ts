import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input } from "@angular/core";

@Component({
  selector: "uf-heading",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tag = this.tag();
    @let text = this.text();
    @switch (tag) {
      @case ("h1") {
        <h1
          class="heading"
          [class]="this.class()"
          [style]="this.style()"
          [ufScope]="this.host"
        >{{ text }}</h1>
      } @case ("h2") {
        <h2
          class="heading"
          [class]="this.class()"
          [style]="this.style()"
          [ufScope]="this.host"
        >{{ text }}</h2>
      } @case ("h3") {
        <h3
          class="heading"
          [class]="this.class()"
          [style]="this.style()"
          [ufScope]="this.host"
        >{{ text }}</h3>
      }
    }
  `,
})
export default class Heading {
  readonly tag = input.required<"h1" | "h2" | "h3">();
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
