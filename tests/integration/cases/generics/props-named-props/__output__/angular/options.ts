import { Component, input } from "@angular/core";

@Component({
  selector: "uf-options",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let heading = this.heading();
    @let options = this.options();
    @let selected = this.selected();
    <h2>{{ heading }}</h2>
    <ul [attr.aria-label]="heading">
      @for (option of options; track index; let index = $index) {
        <li [attr.aria-current]="option === selected ? 'true' : undefined">{{ String(option) }}</li>
      }
    </ul>
  `,
})
export default class Options<T> {
  readonly heading = input.required<string>();
  readonly options = input.required<T[]>();
  readonly selected = input<T>();
  protected readonly String = String;
}
