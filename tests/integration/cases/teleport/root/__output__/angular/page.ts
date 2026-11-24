import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Toast from "./toast";
import { Component, ElementRef, ViewEncapsulation, inject, input, viewChild } from "@angular/core";

export interface PageProps {
  message: string;
}

@Component({
  selector: "uf-page",
  imports: [Toast, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    <section
      class="page"
      aria-label="Page"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      data-uf-5a3bed67=""
      [ufScope]="this.host"
      #ufElement
    >
      <p data-uf-5a3bed67="">Saving…</p>
      <uf-toast [message]="message" data-uf-5a3bed67="" />
    </section>
  `,
  styleUrl: "./Page.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Page {
  readonly message = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
