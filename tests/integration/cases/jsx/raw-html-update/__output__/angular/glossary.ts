import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { TrustedHtmlPipe } from "./_unframework/TrustedHtmlPipe";
import { Component, ElementRef, computed, inject, input, signal, viewChild } from "@angular/core";

export interface GlossaryProps {
  terms: string[];
  definitions: string[];
}

@Component({
  selector: "uf-glossary",
  imports: [ScopeAttributes, Fallthrough, TrustedHtmlPipe],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let terms = this.terms();
    @let index = this.index();
    @let definition = this.definition();
    <section
      class="glossary"
      aria-label="Glossary"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ terms[index] }}</h2>
      <div class="definition" [innerHTML]="definition | trustedHtml"></div>
      <button type="button" (click)="next()">Next term</button>
    </section>
  `,
})
export default class Glossary {
  readonly terms = input.required<string[]>();
  readonly definitions = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly index = signal(0);
  protected readonly definition = computed(() => this.definitions()[this.index()] ?? "");

  protected next() {
    this.index.set((this.index() + 1) % this.terms().length);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
