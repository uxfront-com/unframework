import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { TextCaret } from "./_unframework/TextCaret";
import { modelText } from "./_unframework/modelText";
import { writeModelText } from "./_unframework/writeModelText";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-reply",
  imports: [ScopeAttributes, Fallthrough, TextCaret],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    @let signature = this.signature();
    <form
      aria-label="Reply"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <textarea
        aria-label="Message"
        #messageField
        [value]="modelText(messageField, this.message(), { trim: true })"
        (input)="writeModelText(this.message, messageField, { trim: true })"
        (change)="messageField.value = messageField.value.trim()"
      ></textarea>
      <textarea
        aria-label="Signature"
        #signatureField
        [value]="this.signature()"
        (change)="this.signature.set(signatureField.value)"
      ></textarea>
      <output>[{{ message }}] from {{ signature }}</output>
    </form>
  `,
})
export default class Reply {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLFormElement>>("ufElement");
  protected readonly message = signal("Thanks, see you soon");
  protected readonly signature = signal("Ada");
  protected readonly modelText = modelText;
  protected readonly writeModelText = writeModelText;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
