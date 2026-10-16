import { isPlatformServer } from "@angular/common";
import { Component, PLATFORM_ID, inject, input, signal } from "@angular/core";

@Component({
  selector: "uf-size-picker",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let size = this.size();
    <section aria-label="Size" [class]="this.class()" [style]="this.style()">
      <label>Size <select
        #sizeField
        (change)="this.size.set(sizeField.value)"
      ><option
        value="s"
        [selected]="this.size() === 's'" [defaultSelected]="onServer && this.size() === 's'"
      >Small</option><option
        value="m"
        [selected]="this.size() === 'm'" [defaultSelected]="onServer && this.size() === 'm'"
      >Medium</option><option
        value="l"
        [selected]="this.size() === 'l'" [defaultSelected]="onServer && this.size() === 'l'"
      >Large</option></select></label>
      <output>Chosen: {{ size }}</output>
      <button type="button" (click)="onLargest()">Largest</button>
    </section>
  `,
})
export default class SizePicker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly size = signal("m");
  protected readonly onServer = isPlatformServer(inject(PLATFORM_ID));

  protected onLargest() {
    this.size.set("l");
  }
}
