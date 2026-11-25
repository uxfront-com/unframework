import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

/**
 * Class names as Vue's `normalizeClass` reads them (ADR-0065): a string as it is, an array's
 * entries and an object's keys whose values are truthy, Angular's `[class]` taking the string.
 */
function classNames(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(classNames).filter(Boolean).join(" ");
  if (!value || typeof value !== "object") return "";
  return Object.entries(value)
    .flatMap(([key, on]) => (on ? [key] : []))
    .join(" ");
}

@Component({
  selector: "uf-tag-list",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let tags = this.tags();
    @let states = this.states();
    @let extra = this.extra();
    @let expanded = this.expanded();
    <div
      class="tag-list"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <span
        class="tag"
        [class]="classNames([tags, states, { 'tag-open': expanded }])"
      >{{ label }}</span>
      <span [class]="classNames(tags)">Plain</span>
      <span [class]="classNames([extra, expanded ? ['tag-wide', 'tag-tall'] : []])">Extra</span>
      <button type="button" (click)="expand()">Expand</button>
    </div>
  `,
})
export default class TagList {
  readonly label = input.required<string>();
  readonly tags = input.required<string[]>();
  readonly states = input.required<TagStates>();
  readonly extra = input<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly expanded = signal(false);
  protected readonly classNames = classNames;

  protected expand() {
    this.expanded.set(!this.expanded());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
