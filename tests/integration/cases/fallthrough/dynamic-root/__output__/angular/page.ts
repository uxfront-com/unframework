import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Base from "./base";
import Primary from "./primary";
import {
  Component,
  ElementRef,
  ViewEncapsulation,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-page",
  imports: [Primary, Base, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let linked = this.linked();
    @let tone = this.tone();
    @let pressed = this.pressed();
    @let items = this.items();
    <section
      class="page"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      data-uf-64cf7c28=""
      [ufScope]="this.host"
      #ufElement
    >
      <uf-primary
        [href]="linked ? '#docs' : undefined"
        [disabled]="true"
        [text]="'Docs'"
        [class]="'wide'"
        [style]="{ color: tone }"
        (press)="onPress()"
        data-uf-64cf7c28=""
      />
      <uf-base
        [disabled]="true"
        [text]="'Off'"
        [class]="['off', !linked ? 'muted' : null].join(' ')"
        (press)="onPress_1()"
        data-uf-64cf7c28=""
      />
      <uf-base [text]="'Save'" [class]="'save'" (press)="onPress_2()" data-uf-64cf7c28="" />
      <ul aria-label="Items" data-uf-64cf7c28="">
        @for (item of items; track item.id) {
          <li data-uf-64cf7c28="">
            @switch (item.href ? "a" : "button") {
              @case ("a") {
                <a [attr.href]="item.href" class="item" data-uf-64cf7c28="">{{ item.label }}</a>
              } @case ("button") {
                <button
                  [attr.disabled]="item.disabled ? '' : null"
                  class="item"
                  data-uf-64cf7c28=""
                >{{ item.label }}</button>
              }
            }
          </li>
        }
      </ul>
      <button type="button" (click)="onToggle()" data-uf-64cf7c28="">Toggle</button>
      <output data-uf-64cf7c28="">{{ pressed }}</output>
    </section>
  `,
  styleUrl: "./Page.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Page {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly linked = signal(true);
  protected readonly tone = signal("rgb(29, 78, 216)");
  protected readonly pressed = signal("none");
  protected readonly items = signal([
    { id: 1, href: "#one", disabled: true, label: "One" },
    { id: 2, href: "", disabled: true, label: "Two" },
  ]);

  protected onPress() {
    this.pressed.set("docs");
  }

  protected onPress_1() {
    this.pressed.set("off");
  }

  protected onPress_2() {
    this.pressed.set("save");
  }

  protected onToggle() {
    this.linked.set(!this.linked());
    this.tone.set(this.linked() ? "rgb(29, 78, 216)" : "rgb(21, 128, 61)");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
