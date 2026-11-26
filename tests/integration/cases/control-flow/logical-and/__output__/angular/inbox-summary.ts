import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

@Component({
  selector: "uf-inbox-summary",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let folder = this.folder();
    @let unread = this.unread();
    @let flagged = this.flagged();
    @let signature = this.signature();
    <section
      class="inbox-summary"
      aria-label="Inbox summary"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ folder || "Inbox" }}</h2>
      @if (unread) {
        <p>{{ unread }} unread</p>
      }
      @if (flagged) {
        <p>{{ flagged }} flagged</p>
      }
      @if (unread > 0 && flagged > 0) {
        <p>Some unread messages are flagged.</p>
      }
      @if (folder) {
        <p>Filed under {{ folder }}</p>
      }
      @if (signature) {
        <p class="inbox-signature">{{ signature }}</p>
      }
    </section>
  `,
})
export default class InboxSummary {
  readonly folder = input.required<string>();
  readonly unread = input.required<number>();
  readonly flagged = input.required<number>();
  readonly signature = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
