import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Emphasis from "./emphasis";
import FadeAction from "./fade-action";
import Greeting from "./greeting";
import IconAction from "./icon-action";
import LabelAction from "./label-action";
import SwitchAction from "./switch-action";
import TipAction from "./tip-action";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-page",
  imports: [
    LabelAction,
    FadeAction,
    IconAction,
    SwitchAction,
    Emphasis,
    Greeting,
    TipAction,
    ScopeAttributes,
    Fallthrough,
  ],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let linked = this.linked();
    @let strong = this.strong();
    @let signedIn = this.signedIn();
    @let tips = this.tips();
    <section
      class="page"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-label-action [href]="'#docs'" [label]="'Docs'">Read the docs</uf-label-action>
      <uf-label-action [label]="'Save'">Save the draft</uf-label-action>
      <uf-label-action [href]="'#home'" [label]="'Home'" />
      <uf-label-action [label]="'Close'" />
      <uf-fade-action [href]="'#guide'" [label]="'Guide'">Read the guide</uf-fade-action>
      <uf-fade-action [label]="'Send'">Send the draft</uf-fade-action>
      <uf-fade-action [href]="'#blog'" [label]="'Blog'" />
      <uf-fade-action [label]="'Undo'" />
      <uf-icon-action [href]="'#faq'" [label]="'FAQ'">Read the FAQ</uf-icon-action>
      <uf-icon-action [label]="'Print'">Print the draft</uf-icon-action>
      <uf-icon-action [href]="'#news'" [label]="'News'" />
      <uf-icon-action [label]="'Reset'" />
      <uf-switch-action [href]="linked ? '#more' : undefined">Learn more</uf-switch-action>
      <uf-emphasis [strong]="strong">Mind the gap</uf-emphasis>
      <uf-greeting [user]="signedIn ? ada : undefined">Welcome back</uf-greeting>
      <uf-greeting [user]="signedIn ? grace : undefined" />
      @if (tips) {
        <div class="tips">
          <uf-tip-action [href]="'#tips'" [label]="'Tips'">Linked tip</uf-tip-action>
          <uf-tip-action [label]="'Help'">Button tip</uf-tip-action>
          <uf-tip-action [href]="'#about'" [label]="'About'" />
          <uf-tip-action [label]="'Hint'" />
        </div>
      }
      <button type="button" (click)="onToggleLink()">Toggle link</button>
      <button type="button" (click)="onToggleEmphasis()">Toggle emphasis</button>
      <button type="button" (click)="onToggleUser()">Toggle user</button>
      <button type="button" (click)="onShowTips()">Show tips</button>
    </section>
  `,
})
export default class Page {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly linked = signal(true);
  protected readonly strong = signal(true);
  protected readonly signedIn = signal(true);
  protected readonly tips = signal(false);
  protected readonly ada = { name: "Ada" };
  protected readonly grace = { name: "Grace" };

  protected onToggleLink() {
    this.linked.set(!this.linked());
  }

  protected onToggleEmphasis() {
    this.strong.set(!this.strong());
  }

  protected onToggleUser() {
    this.signedIn.set(!this.signedIn());
  }

  protected onShowTips() {
    this.tips.set(true);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
