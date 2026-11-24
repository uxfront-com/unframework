import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Hint from "./hint";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

type PanelLook = {
  borderColor?: string;
  borderStyle?: string;
  borderWidth?: string;
  "--panel-gap"?: string;
};

interface PanelAttributes {
  id: string;
  title?: string;
  style?: PanelLook;
}

interface NoteAttributes {
  title: string;
  style?: string;
}

export interface PanelProps {
  heading: string;
  panel: PanelAttributes;
  note?: NoteAttributes;
}

@Component({
  selector: "uf-panel",
  imports: [Hint, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let heading = this.heading();
    @let panel = this.panel();
    @let note = this.note();
    <div
      class="panels"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <section [attr.id]="panel.id" [attr.title]="panel.title" [style]="panel.style" class="panel">
        <h2 style="margin-bottom: var(--panel-gap, 4px)">{{ heading }}</h2>
        <p [attr.title]="note?.title" [style]="note?.style">Changes save as you type.</p>
        <uf-hint
          [text]="'Saved a moment ago'"
          [attrs]="{ id: 'saved-hint', style: 'font-style: italic; color: rgb(90, 90, 90)' }"
          [style]="{ color: 'rgb(30, 90, 60)' }"
        />
      </section>
    </div>
  `,
})
export default class Panel {
  readonly heading = input.required<string>();
  readonly panel = input.required<PanelAttributes>();
  readonly note = input<NoteAttributes>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
