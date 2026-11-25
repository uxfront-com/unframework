import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import type { Sized, Toned } from "./types";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

type ChipProps = Sized & Toned & { label: string };

@Component({
  selector: "uf-chip",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let size = this.size();
    @let tone = this.tone();
    @let label = this.label();
    <span
      [class]="['chip chip-' + size + ' chip-' + tone, this.class()].join(' ')"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ label }}</span>
  `,
})
export default class Chip {
  readonly size = input.required<ChipProps["size"]>();
  readonly tone = input<Exclude<ChipProps["tone"], undefined>, ChipProps["tone"]>("neutral", {
    transform: (value) => (value === undefined ? "neutral" : value),
  });
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLSpanElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
