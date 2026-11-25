import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformServer } from "@angular/common";
import {
  Component,
  ElementRef,
  PLATFORM_ID,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-size-picker",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let size = this.size();
    <section
      aria-label="Size"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Size <select
        #sizeField
        (change)="this.size.set(sizeField.value)"
      ><option
        value="s"
        [defaultSelected]="onServer && this.size() === 's'" [selected]="this.size() === 's'"
      >Small</option><option
        value="m"
        [defaultSelected]="onServer && this.size() === 'm'" [selected]="this.size() === 'm'"
      >Medium</option><option
        value="l"
        [defaultSelected]="onServer && this.size() === 'l'" [selected]="this.size() === 'l'"
      >Large</option></select></label>
      <output>Chosen: {{ size }}</output>
      <button type="button" (click)="onLargest()">Largest</button>
    </section>
  `,
})
export default class SizePicker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly size = signal("m");
  protected readonly onServer = isPlatformServer(inject(PLATFORM_ID));

  protected onLargest() {
    this.size.set("l");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
