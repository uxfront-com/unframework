import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Heading from "./heading";
import Status from "./status";
import { Component, ElementRef, ViewEncapsulation, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-panel",
  imports: [Heading, Status, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section
      class="panel"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      data-uf-34db6205=""
      [ufScope]="this.host"
      #ufElement
    >
      <uf-heading [big]="true" [text]="'Release'" data-uf-34db6205="" />
      <uf-heading [big]="false" [text]="'Notes'" data-uf-34db6205="" />
      <uf-status [busy]="false" [text]="'Save'" data-uf-34db6205="" />
      <uf-status [busy]="true" [text]="'Save'" data-uf-34db6205="" />
    </section>
  `,
  styleUrl: "./Panel.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Panel {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
