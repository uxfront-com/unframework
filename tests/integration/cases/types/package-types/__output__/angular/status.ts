import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import type { Labelled } from "./types";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";
import type { TimeInterval } from "rxjs";

type StatusProps = TimeInterval<string> & Labelled;

@Component({
  selector: "uf-status",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let value = this.value();
    @let interval = this.interval();
    @let label = this.label();
    <p
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ label }}: {{ value }} after {{ interval }} ms</p>
  `,
})
export default class Status {
  readonly value = input.required<StatusProps["value"]>();
  readonly interval = input.required<StatusProps["interval"]>();
  readonly label = input.required<StatusProps["label"]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLParagraphElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
