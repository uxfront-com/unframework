import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { TrustedHtmlPipe } from "./_unframework/TrustedHtmlPipe";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface Entry {
  id: number;
  html: string;
}

export interface ChangelogProps {
  entries: Entry[];
}

@Component({
  selector: "uf-changelog",
  imports: [ScopeAttributes, Fallthrough, TrustedHtmlPipe],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let entries = this.entries();
    <ul
      class="changelog"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @for (entry of entries; track entry.id) {
        <li [innerHTML]="entry.html | trustedHtml"></li>
      }
    </ul>
  `,
})
export default class Changelog {
  readonly entries = input.required<Entry[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLUListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
