import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-section",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let nested = this.nested();
    <article [class]="this.class()" [style]="this.style()">
      @switch (nested ? "h3" : "h2") {
        @case ("h3") {
          <h3 class="title">{{ title }}</h3>
        } @case ("h2") {
          <h2 class="title">{{ title }}</h2>
        }
      }
      <button type="button" (click)="onClick()">{{ nested ? "Lift" : "Nest" }}</button>
    </article>
  `,
})
export default class Section {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly nested = signal(false);

  protected onClick() {
    this.nested.set(!this.nested());
  }
}
