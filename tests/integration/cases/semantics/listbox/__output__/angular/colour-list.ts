import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-colour-list",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let colour = this.colour();
    <section aria-label="Colours" [class]="this.class()" [style]="this.style()">
      <select size="3" aria-label="Colour" (change)="onColourChange($event)">
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="blue">Blue</option>
      </select>
      <output>Picked: {{ colour }}</output>
    </section>
  `,
})
export default class ColourList {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly colour = signal("none");

  protected onColourChange(event: Event) {
    this.colour.set((event.currentTarget as HTMLSelectElement).value);
  }
}
