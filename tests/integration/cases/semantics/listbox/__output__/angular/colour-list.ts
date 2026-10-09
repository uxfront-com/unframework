import { Component, signal } from "@angular/core";

@Component({
  selector: "uf-colour-list",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let colour = this.colour();
    <section aria-label="Colours">
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
  protected readonly colour = signal("none");

  protected onColourChange(event: Event) {
    this.colour.set((event.currentTarget as HTMLSelectElement).value);
  }
}
