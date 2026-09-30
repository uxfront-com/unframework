import { BASE_PARTICLES, glslFloat as f } from "@uxfront/scene";
import type { FormationShader } from "@uxfront/scene";

import { COMPONENT_ART, KNOB_TRAVEL, ROLE, TYPED_LENGTH, buildShapeTable } from "./art";
import { BEHIND, CARD, CARDS, CARD_APPROACH, CARD_SCALE, FRONT } from "./geometry";

const vec = (values: readonly number[]) => `vec${values.length}(${values.map(f).join(", ")})`;
const array = (type: string, items: string[]) =>
  `${type}[${items.length}](\n  ${items.join(",\n  ")}\n)`;

const table = buildShapeTable(COMPONENT_ART);
const border = COMPONENT_ART[0];
const button = COMPONENT_ART.find((shape) => shape.role === ROLE.button);
if (border?.kind !== "rrect") throw new Error("The card artwork starts with the card's border.");
if (!button || !("c" in button)) throw new Error("The card artwork needs a button.");

// The share of particles each card's artwork gets: the prism's rails band
// (see the particle bands in $main), so rail i flows into card i on the way in.
const ART_SHARE = 0.57;
const LAST = CARDS - 1;

export const shader: FormationShader = {
  glsl: /* glsl */ `
const vec2 $CARD = ${vec(CARD)};
const float $CORNER = ${f(border.r)};
const float $SCALE = ${f(CARD_SCALE)};
const vec3 $FRONT = ${vec(FRONT)};
const vec3 $BEHIND = ${vec(BEHIND)};
const float $KNOB_TRAVEL = ${f(KNOB_TRAVEL)};
const float $TYPED_LENGTH = ${f(TYPED_LENGTH)};
const vec2 $BUTTON = ${vec(button.c)};

// Angular, Svelte, Astro, Vue, React, Solid, Qwik: the prism's spectrum, so
// each rail keeps its colour as it becomes a card.
const vec3 $SPECTRUM[${CARDS}] = vec3[${CARDS}](
  vec3(1.0, 0.13, 0.16),
  vec3(1.0, 0.4, 0.06),
  vec3(1.0, 0.8, 0.14),
  vec3(0.2, 1.0, 0.45),
  vec3(0.16, 0.75, 1.0),
  vec3(0.25, 0.36, 1.0),
  vec3(0.64, 0.26, 1.0)
);

const int $SHAPES = ${table.cdf.length};
const vec4 $SHAPE_A[$SHAPES] = ${array("vec4", table.a.map(vec))};
const vec4 $SHAPE_B[$SHAPES] = ${array("vec4", table.b.map(vec))};
const float $SHAPE_CDF[$SHAPES] = ${array("float", table.cdf.map(f))};
// Line brightness independent of how much artwork a card carries.
const float $GAIN = ${f((table.totalWeight / ((BASE_PARTICLES * ART_SHARE) / CARDS)) * 120)};

// Cards are dealt as the chapter scrolls in and is read (see cardProgress).
float $progress(Frame f) {
  if (f.approach < 1.0) return f.approach * ${f(CARD_APPROACH)};
  return mix(${f(CARD_APPROACH)}, 1.0, f.local);
}
float $reach(int i, float progress) {
  float o = float(i) * 0.08;
  return smoothstep(o, o + 0.45, progress);
}

// The same beat on every card, every four seconds: the email is typed, one
// character at a time, "remember me" switches on, submit is pressed, and the
// form clears. x: toggle, y: press, z: typed share of the email, w: caret.
vec4 $beat(float time) {
  float ph = fract(time * 0.25);
  float clear = 1.0 - smoothstep(0.9, 0.95, ph);
  float typed = floor(clamp((ph - 0.04) / 0.3, 0.0, 1.0) * 18.0) / 18.0 * clear;
  float on = smoothstep(0.42, 0.5, ph) * clear;
  float press = exp(-pow((ph - 0.64) * 16.0, 2.0));
  float caret = step(0.5, fract(time * 1.8)) * clear;
  return vec4(on, press, typed, caret);
}

float $ease(float reach) {
  return 1.0 - pow(1.0 - reach, 3.0);
}

// How far back card i sits, in cards. Angular (0) is the front card; each next
// card fans out from behind the one before it as it's dealt.
float $depth(int i, float progress) {
  if (i == 0) return 0.0;
  return float(i) - 1.0 + $ease($reach(i, progress));
}

vec3 $slot(float depth, float time) {
  return $FRONT + $BEHIND * depth + vec3(0.0, sin(time * 0.7) * 0.03, 0.0);
}

// Card-local point q (art units) of card i in the world. The front card flies
// in from below and in front, tipped towards the viewer.
vec3 $place(int i, vec2 q, float progress, float time) {
  vec3 w = vec3(q * $SCALE, 0.0);
  if (i > 0) return $slot($depth(i, progress), time) + w;
  float e = $ease($reach(0, progress));
  float tip = (1.0 - e) * 0.9;
  vec3 tipped = vec3(w.x, w.y * cos(tip), w.y * sin(tip));
  return $slot(0.0, time) + tipped + vec3(0.3, -1.4, 2.2) * (1.0 - e);
}

float $sdCard(vec2 p) {
  vec2 d = abs(p) - $CARD + $CORNER;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - $CORNER;
}

// How much of card i, at q, the cards in front of it hide. The renderer has no
// depth test, so what's behind is dimmed instead, as through frosted glass. A
// card's place hides what's behind it from the start of its deal, so the next
// card only shows once it fans out past it.
float $covered(int i, vec2 q, float progress) {
  float depth = $depth(i, progress);
  float cover = 0.0;
  for (int j = 0; j < i; j++) {
    vec2 rel = q + (depth - $depth(j, progress)) * $BEHIND.xy / $SCALE;
    float inside = 1.0 - smoothstep(-0.03, 0.02, $sdCard(rel));
    cover = max(cover, inside * smoothstep(0.0, 0.15, $reach(j, progress)));
  }
  return cover;
}

int $findShape(float x) {
  for (int k = 0; k < $SHAPES - 1; k++) {
    if (x < $SHAPE_CDF[k]) return k;
  }
  return $SHAPES - 1;
}

vec2 $shapePoint(int k, float b, float c, vec4 beat, out float light) {
  vec4 A = $SHAPE_A[k];
  vec4 B = $SHAPE_B[k];
  int type = int(B.x + 0.5);
  int role = int(B.z + 0.5);
  light = B.w;
  vec2 q;
  if (type == 0) q = mix(A.xy, A.zw, role == ${ROLE.typing} ? b * beat.z : b);
  else if (type == 1) q = rrectPoint(A, B.y, b);
  else if (type == 2) q = A.xy + A.z * vec2(cos(b * TAU), sin(b * TAU));
  else if (type == 3) q = A.xy + A.z * sqrt(c) * vec2(cos(b * TAU), sin(b * TAU));
  else {
    // Even over the rectangle, with the corners pulled in onto their arcs.
    vec2 p = (vec2(b, c) * 2.0 - 1.0) * A.zw;
    vec2 inner = A.zw - B.y;
    vec2 d = max(abs(p) - inner, 0.0);
    float len = length(d);
    if (len > B.y) p = sign(p) * (inner + d * (B.y / len));
    q = A.xy + p;
  }
  if (role == ${ROLE.knob}) {
    q.x += beat.x * $KNOB_TRAVEL;
    light *= mix(0.8, 1.3, beat.x);
  } else if (role == ${ROLE.track}) {
    light *= mix(0.25, 1.6, beat.x);
  } else if (role == ${ROLE.button}) {
    q = $BUTTON + (q - $BUTTON) * (1.0 - beat.y * 0.06);
    light *= 1.0 + beat.y * 1.8;
  } else if (role == ${ROLE.typing}) {
    // The same particles over a shorter line: keep its brightness even.
    light *= max(beat.z, 0.001);
  } else if (role == ${ROLE.caret}) {
    q.x += beat.z * $TYPED_LENGTH;
    light *= beat.w;
  }
  return q;
}

Particle $main(uint id, float sel, Frame f) {
  float progress = $progress(f);
  float time = f.time;
  uint s = seedOf(id, 0x5AC4ED07u);
  float a = rnd(s);
  float b = rnd(s);
  float c = rnd(s);
  float d = rnd(s);
  Particle P = blank();
  float sweep = mod(time * 0.5, 7.0) - 3.0;

  if (sel < ${f(0.92 - ART_SHARE)}) {
    // Frosted glass, with a glint sweeping across the stack.
    int i = min(int(a * ${f(CARDS)}), ${LAST});
    float e = $reach(i, progress);
    vec2 q = (vec2(b, c) * 2.0 - 1.0) * $CARD;
    P.pos = $place(i, q, progress, time);
    float glint = exp(-pow((P.pos.x - sweep) * 2.2, 2.0));
    P.col = mix($SPECTRUM[i], vec3(1.0), 0.4) * (0.016 + glint * 0.035) * smoothstep(0.0, 0.3, e);
    P.col *= 1.0 - 0.9 * $covered(i, q, progress);
    P.size = 0.75;
    P.refl = 1.0;
  } else if (sel < 0.92) {
    // Seven cards, one per framework, each holding the same component.
    int i = min(int((sel - ${f(0.92 - ART_SHARE)}) / ${f(ART_SHARE)} * ${f(CARDS)}), ${LAST});
    float e = $reach(i, progress);
    float light;
    vec2 q = $shapePoint($findShape(a), b, c, $beat(time), light);
    P.pos = $place(i, q, progress, time);
    float glint = exp(-pow((P.pos.x - sweep) * 2.2, 2.0));
    float landed = exp(-pow((e - 0.97) * 10.0, 2.0));
    vec3 tint = mix($SPECTRUM[i], vec3(1.0), 0.18);
    P.col = tint * light * $GAIN * (1.0 + glint * 0.8 + landed) * smoothstep(0.0, 0.3, e);
    P.col *= 1.0 - 0.97 * $covered(i, q, progress);
    P.size = 0.75;
    P.refl = 1.0;
  } else {
    // Dust caught in the light.
    vec3 p = vec3(mix(-5.0, 5.0, a), mix(-1.35, 2.6, b), mix(-4.0, 2.5, c));
    p.x = mod(p.x + time * 0.04 + 5.0, 10.0) - 5.0;
    P.pos = p;
    P.col = vec3(0.7, 0.75, 0.9) * 0.05 * step(0.4, d);
    P.size = 0.9;
  }
  return P;
}
`,
};
