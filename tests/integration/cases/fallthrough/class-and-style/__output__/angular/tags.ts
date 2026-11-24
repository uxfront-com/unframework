import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Tag from "./tag";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-tags",
  imports: [Tag, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let active = this.active();
    <div
      class="tags"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-tag [label]="'plain'" />
      <uf-tag [label]="'wide'" [class]="'wide'" [style]="{ 'margin-left': '8px' }" />
      <uf-tag
        [label]="'toggled'"
        [class]="['picked', active ? 'active' : null].join(' ')"
        [style]="{ color: active ? 'rgb(200, 0, 0)' : undefined }"
      />
      <button type="button" (click)="onToggle()">Toggle</button>
    </div>
  `,
})
export default class Tags {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly active = signal(false);

  protected onToggle() {
    this.active.set(!this.active());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
