import { Component, input, signal } from "@angular/core";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

let nextId = 0;

@Component({
  selector: "uf-size-picker",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let legend = this.legend();
    @let sizes = this.sizes();
    @let picked = this.picked();
    <fieldset class="size-picker" [attr.aria-describedby]="hintId">
      <legend>{{ legend }}</legend>
      <p [attr.id]="hintId">Pick one size.</p>
      @for (size of sizes; track size; let index = $index) {
        <div class="size">
          <input
            type="radio"
            [attr.id]="group + '-' + index"
            [attr.name]="group"
            [attr.value]="size"
            (change)="choose(size)"
          />
          <label [attr.for]="group + '-' + index">{{ size }}</label>
        </div>
      }
      <output>{{ picked || "none" }}</output>
    </fieldset>
  `,
})
export default class SizePicker {
  readonly legend = input.required<string>();
  readonly sizes = input.required<string[]>();
  protected readonly group = `uf-id-size-picker-${nextId++}`;
  protected readonly hintId = `uf-id-size-picker-${nextId++}`;
  protected readonly picked = signal("");

  protected choose(size: string) {
    this.picked.set(size);
  }
}
