import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { modelText } from "./_unframework/modelText";
import { writeModelText } from "./_unframework/writeModelText";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-profile",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let city = this.city();
    @let weight = this.weight();
    <form
      aria-label="Profile"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Name <input
        #nameField
        [value]="modelText(nameField, this.name(), { trim: true })"
        (input)="writeModelText(this.name, nameField, { trim: true })"
        (change)="nameField.value = nameField.value.trim()"
      /></label>
      <label>City <input
        #cityField
        [value]="this.city()"
        (change)="this.city.set(cityField.value)"
      /></label>
      <label>Weight <input
        #weightField
        [value]="modelText(weightField, this.weight(), { number: true })"
        (input)="writeModelText(this.weight, weightField, { number: true })"
      /></label>
      <output>[{{ name }}] from {{ city }}, {{ weight + 1 }}</output>
    </form>
  `,
})
export default class Profile {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLFormElement>>("ufElement");
  protected readonly name = signal("");
  protected readonly city = signal("Lisbon");
  protected readonly weight = signal(0);
  protected readonly modelText = modelText;
  protected readonly writeModelText = writeModelText;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
