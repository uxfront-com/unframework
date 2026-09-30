import { glslFloat as f } from "@uxfront/scene";
import type { FormationShader } from "@uxfront/scene";

import {
  ACROSS,
  BEAMS,
  BEAM_APPROACH,
  BREAK,
  CENTER,
  CONVERGE,
  CROSSING,
  FASTER,
  IN_DIR,
  IN_LENGTH,
  MERGE,
  NORMAL,
  OUT_DIR,
  OUT_LENGTH,
  RADIUS,
  UP,
} from "./geometry";

const vec = (values: readonly number[]) => `vec${values.length}(${values.map(f).join(", ")})`;

// A particle's phase runs the length of its beam once per cycle. The beam
// crosses the film SPLIT of the way through the cycle, which makes the light
// FASTER times faster beyond it.
const SPLIT = (FASTER * IN_LENGTH) / (OUT_LENGTH + FASTER * IN_LENGTH);
const RATE = 0.04;
const SPEED = (IN_LENGTH * RATE) / SPLIT;

export const shader: FormationShader = {
  glsl: /* glsl */ `
const vec3 $C = ${vec(CENTER)};
const float $R = ${f(RADIUS)};
const vec3 $N = ${vec(NORMAL)};
const vec3 $U = ${vec(ACROSS)};
const vec3 $V = ${vec(UP)};
const vec3 $IN = ${vec(IN_DIR)};
const vec3 $OUT = ${vec(OUT_DIR)};
const float $IN_LEN = ${f(IN_LENGTH)};
const float $OUT_LEN = ${f(OUT_LENGTH)};
const float $FASTER = ${f(FASTER)};
const float $CONVERGE = ${f(CONVERGE)};
const vec3 $MERGE = ${vec(MERGE)};
// The next framework's light: white, with a faint sheen of every colour.
const vec3 $WHITE = vec3(1.0, 0.97, 0.94);
const float $SPLIT = ${f(SPLIT)};
const float $RATE = ${f(RATE)};
const float $SPEED = ${f(SPEED)};

// Angular, Svelte, Astro, Vue, React, Solid, Qwik: the prism's spectrum.
const vec3 $SPECTRUM[${BEAMS}] = vec3[${BEAMS}](
  vec3(1.0, 0.13, 0.16),
  vec3(1.0, 0.4, 0.06),
  vec3(1.0, 0.8, 0.14),
  vec3(0.2, 1.0, 0.45),
  vec3(0.16, 0.75, 1.0),
  vec3(0.25, 0.36, 1.0),
  vec3(0.64, 0.26, 1.0)
);

float $progress(Frame f) {
  if (f.approach < 1.0) return f.approach * ${f(BEAM_APPROACH)};
  return mix(${f(BEAM_APPROACH)}, 1.0, f.local);
}
float $reach(int i, float progress) {
  float o = ${f(BREAK.from)} + float(i) * ${f(BREAK.step)};
  return smoothstep(o, o + ${f(BREAK.span)}, progress);
}

// Where beam i crosses the film, in the film's plane (across, up).
vec2 $crossing(int i) { return vec2(0.0, ${f(CROSSING[0])} - float(i) * ${f(CROSSING[1])}); }
vec3 $onFilm(vec2 q) { return $C + $U * q.x + $V * q.y; }

// How far along its beam a particle is, from its phase.
float $along(float phase) {
  if (phase < $SPLIT) return phase / $SPLIT * $IN_LEN;
  return $IN_LEN + (phase - $SPLIT) / (1.0 - $SPLIT) * $OUT_LEN;
}
// Beyond the film, the beam turns the corner and converges with the others on
// $MERGE, then runs on as one white stream. merged: 0 at the film, 1 from $MERGE.
vec3 $beamPoint(vec3 through, float dist, out float merged) {
  merged = 0.0;
  if (dist < $IN_LEN) return through - $IN * ($IN_LEN - dist);
  float t = dist - $IN_LEN;
  merged = 1.0;
  if (t > $CONVERGE) return $MERGE + $OUT * (t - $CONVERGE);
  float u = t / $CONVERGE;
  merged = u;
  vec3 p1 = through + $IN * $CONVERGE * 0.4;
  vec3 p2 = $MERGE - $OUT * $CONVERGE * 0.35;
  float v = 1.0 - u;
  return v * v * v * through + 3.0 * v * v * u * p1 + 3.0 * v * u * u * p2 + u * u * u * $MERGE;
}
// When the light at dist set off: pulses travel with it, faster beyond the film.
float $arrival(float dist) {
  if (dist < $IN_LEN) return dist / $SPEED;
  return $IN_LEN / $SPEED + (dist - $IN_LEN) / ($SPEED * $FASTER);
}

// A soap film drains: thin at the top, thicker below, in swirling bands.
float $thickness(vec2 q, float t) {
  vec2 w = q + 0.3 * vec2(sin(q.y * 2.3 + t * 0.4), sin(q.x * 2.9 - t * 0.35));
  w += 0.12 * vec2(sin(w.y * 4.1 - t * 0.6), sin(w.x * 3.7 + t * 0.5));
  return 0.35 - w.y * 0.4 + 0.08 * sin(length(w) * 3.0 - t * 0.3);
}
// Thin-film interference: the colour of a film of thickness h.
vec3 $iridescence(float h) {
  return 0.55 + 0.45 * cos(TAU * (h * 1.7 + vec3(0.0, 0.33, 0.67)));
}

// Rings spreading over the film from where each beam goes through, three at a
// time, and one wide ring as it breaks through.
float $ripples(vec2 q, float progress, float time) {
  float w = 0.0;
  for (int i = 0; i < ${BEAMS}; i++) {
    float reach = $reach(i, progress);
    if (reach <= 0.0) continue;
    float d = length(q - $crossing(i));
    for (int k = 0; k < 3; k++) {
      float r = fract(time * 0.22 + float(k) / 3.0 + float(i) * 0.137);
      float ring = exp(-pow((d - r * $R * 1.3) * 24.0, 2.0));
      w += ring * pow(1.0 - r, 2.0) * smoothstep(0.0, 0.1, r);
    }
    float burst = smoothstep(0.0, 0.8, reach);
    w += exp(-pow((d - burst * $R * 2.2) * 14.0, 2.0)) * (1.0 - burst) * 3.0;
  }
  return w;
}

Particle $main(uint id, float sel, Frame f) {
  float progress = $progress(f);
  float time = f.time;
  uint s = seedOf(id, 0x7E5A01D3u);
  float a = rnd(s);
  float b = rnd(s);
  float c = rnd(s);
  float d = rnd(s);
  Particle P = blank();
  vec2 g = gauss(b, c);
  float halo = step(0.82, d);

  if (sel < 0.46) {
    // Seven beams: slow on this side of the film, faster beyond it.
    int i = min(int(sel / 0.46 * ${f(BEAMS)}), ${BEAMS - 1});
    float reach = $reach(i, progress);
    float dist = $along(fract(a + time * $RATE));
    float beyond = step($IN_LEN, dist);
    float grown = $IN_LEN + reach * $OUT_LEN;
    float merged;
    vec3 p = $beamPoint($onFilm($crossing(i)), dist, merged);
    float joined = smoothstep(0.55, 1.0, merged);
    vec3 side = normalize(cross(mix($IN, $OUT, merged), $V));
    vec2 off = g * mix(0.014, 0.05, halo) * (1.0 + 0.4 * joined);
    P.pos = p + $V * off.x + side * off.y;
    // Each beam keeps its own beat until it joins the stream, then they pulse as one.
    float beat = float(i) * 1.3 * (1.0 - joined);
    float pulse = pow(0.5 + 0.5 * sin(($arrival(dist) - time) * 4.0 + beat), 10.0);
    float front = beyond * smoothstep(grown - 0.5, grown, dist) * (1.0 - smoothstep(0.97, 1.0, reach));
    float shown = 1.0 - step(grown, dist);
    float fade = smoothstep(0.0, 2.5, dist) * (1.0 - smoothstep($IN_LEN + $OUT_LEN * 0.3, $IN_LEN + $OUT_LEN * 0.8, dist));
    // Sparser beyond the film, where the light moves faster: brighter to match.
    // Where the seven overlap, each gives less, or the stream blows out.
    float gain = mix(1.0, $FASTER * 1.2, beyond) * mix(1.0, 0.4, joined);
    // The colours mix into white as the beams meet, and the stream shimmers.
    vec3 white = mix($WHITE, $iridescence((dist - $IN_LEN) * 0.12 - time * 0.08), 0.12);
    vec3 col = mix($SPECTRUM[i], white, smoothstep(0.25, 1.0, merged) * beyond);
    P.col = col * mix(0.8, 0.1, halo) * (1.0 + pulse * 1.6 + front * 3.0) * gain * fade * shown;
    P.size = mix(0.8, 1.1, halo);
    P.refl = 1.0;
  } else if (sel < 0.55) {
    // Ripple rings, crisp over the film's glow.
    int i = min(int(a * ${f(BEAMS)}), ${BEAMS - 1});
    float reach = $reach(i, progress);
    float k = floor(b * 3.0);
    float r = fract(time * 0.22 + k / 3.0 + float(i) * 0.137);
    vec2 q = $crossing(i) + r * $R * 1.3 * vec2(cos(c * TAU), sin(c * TAU));
    float inside = 1.0 - smoothstep($R * 0.97, $R, length(q));
    P.pos = $onFilm(q);
    float life = pow(1.0 - r, 2.0) * smoothstep(0.0, 0.1, r);
    P.col = mix($SPECTRUM[i], vec3(1.0), 0.55) * 0.3 * life * inside * smoothstep(0.0, 0.3, reach);
    P.size = 0.75;
    P.refl = 1.0;
  } else if (sel < 0.85) {
    // The film, iridescent, lit up by the ripples.
    float rr = $R * sqrt(b);
    vec2 q = rr * vec2(cos(c * TAU), sin(c * TAU));
    float w = $ripples(q, progress, time);
    float h = $thickness(q, time);
    float edge = smoothstep($R * 0.7, $R, rr);
    P.pos = $onFilm(q) + $N * w * 0.02;
    P.col = $iridescence(h) * (0.028 + 0.04 * edge + 0.14 * w);
    P.size = 0.9;
    P.refl = 1.0;
  } else if (sel < 0.9) {
    // The ring that holds the film.
    float ang = a * TAU;
    vec2 q = ($R + g.x * 0.006) * vec2(cos(ang), sin(ang));
    P.pos = $onFilm(q) + $N * g.y * 0.008;
    float glint = pow(0.5 + 0.5 * cos(ang - time * 0.4), 10.0);
    P.col = mix(vec3(0.82, 0.87, 1.0), $iridescence(ang / TAU + time * 0.03), 0.4) * (0.5 + glint);
    P.size = 0.8;
    P.refl = 1.0;
  } else {
    // Specks carried by the same current: slow on this side, fast beyond.
    vec2 q = vec2(mix(-4.0, 4.0, a), mix(-1.2, 2.6, b));
    float dist = $along(fract(c + time * $RATE * 0.5));
    float beyond = step($IN_LEN, dist);
    vec3 through = $onFilm(q);
    P.pos = dist < $IN_LEN ? through - $IN * ($IN_LEN - dist) : through + $OUT * (dist - $IN_LEN);
    P.col = vec3(0.7, 0.75, 0.95) * 0.06 * step(0.35, d) * mix(1.0, $FASTER, beyond);
    P.size = 0.9;
  }
  return P;
}
`,
};
