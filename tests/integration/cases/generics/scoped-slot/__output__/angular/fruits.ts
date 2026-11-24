import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Picker, { PickerItem } from "./picker";
import { Component, ElementRef, computed, inject, input, viewChild } from "@angular/core";

interface Fruit {
  name: string;
  count: number;
}

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

@Component({
  selector: "uf-fruits",
  imports: [Picker, PickerItem, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let fruits = this.fruits();
    <uf-picker
      [items]="fruits"
      [class]="this.class()"
      [style]="this.style()"
      [ufAttributes]="this.ufAttributes()"
      [ufListeners]="this.ufListeners()"
      [ufScope]="this.host"
      #ufElement
    >
      <ng-template ufPickerItem let-item="item">
        <span>{{ item.name }} × {{ item.count }}</span>
      </ng-template>
    </uf-picker>
  `,
})
export default class Fruits {
  readonly fruits = input.required<Fruit[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly rootComponent = viewChild("ufElement", { read: Picker });
  readonly ufElement = computed(() => this.rootComponent()?.ufElement());
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
