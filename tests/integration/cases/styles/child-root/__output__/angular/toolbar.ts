import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Button from "./button";
import { Component, ElementRef, ViewEncapsulation, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-toolbar",
  imports: [Button, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div
      role="toolbar"
      aria-label="Actions"
      class="toolbar"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      data-uf-a33d603f=""
      [ufScope]="this.host"
      #ufElement
    >
      <uf-button [text]="'Save'" data-uf-a33d603f="" />
      <uf-button [text]="'Cancel'" data-uf-a33d603f="" />
    </div>
  `,
  styleUrl: "./Toolbar.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Toolbar {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
