import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { styleObject } from "./_unframework/styleObject";
import Badge from "./badge";
import Tag from "./tag";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

type NoticeLook = {
  color?: string;
  backgroundColor?: string;
  borderLeft?: string;
  "--notice-accent"?: string;
};

type NoticeVars = { "--notice-gap"?: string };

export interface NoticeProps {
  title: string;
  look?: NoticeLook;
  declarations?: string;
  vars?: NoticeVars;
}

@Component({
  selector: "uf-notice",
  imports: [Badge, Tag, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let look = this.look();
    @let declarations = this.declarations();
    @let vars = this.vars();
    @let quiet = this.quiet();
    <div
      class="notice"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p [style]="look">{{ title }}</p>
      <uf-badge
        [label]="'Permanent'"
        [tone]="'padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid'"
        [style]="styleObject(look)"
      />
      <p [style]="declarations">Read the details before you continue.</p>
      @switch (quiet ? "Tag" : "Badge") {
        @case ("Tag") {
          <uf-tag
            [label]="'Optional'"
            [tone]="'font-weight: 700'"
            [style]="styleObject(declarations)"
          />
        } @case ("Badge") {
          <uf-badge
            [label]="'Optional'"
            [tone]="'font-weight: 700'"
            [style]="styleObject(declarations)"
          />
        }
      }
      <p
        [style]="quiet
          ? { color: 'rgb(90, 90, 90)' }
          : { color: 'var(--notice-accent, rgb(160, 40, 40))', fontWeight: '700' }"
      >This cannot be undone.</p>
      <button
        type="button"
        [style]="vars"
        (click)="toggle()"
      >{{ quiet ? "Emphasise" : "Quieten" }}</button>
    </div>
  `,
})
export default class Notice {
  readonly title = input.required<string>();
  readonly look = input<NoticeLook>();
  readonly declarations = input<string>();
  readonly vars = input<NoticeVars>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly quiet = signal(false);
  protected readonly styleObject = styleObject;

  protected toggle() {
    this.quiet.set(!this.quiet());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
