import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, output, viewChild } from "@angular/core";

export type Source =
  | { kind: "link"; id: string; title: string; href: string }
  | { kind: "book"; id: string; title: string; note?: string };

export interface ReadingProps {
  sources: Source[];
}

@Component({
  selector: "uf-reading",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let sources = this.sources();
    <ul
      class="reading"
      aria-label="Reading list"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @for (source of sources; track source.id; let index = $index) {
        <li
          [attr.title]="source.kind === 'link' ? source.href : source.title"
        >{{ index + 1 }}. {{ source.title }}{{ source.kind === "book" && source.note ? " (" + source.note.trim() + ")" : "" }}@if (source.kind === "link") {<button
          type="button"
          (click)="open.emit(source.href)"
        >{{ "Open " + source.title }}</button>}</li>
      }
    </ul>
  `,
})
export default class Reading {
  readonly sources = input.required<Source[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly open = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLUListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
