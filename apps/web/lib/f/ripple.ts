// Water for the screen. A snapshot of what's on screen becomes a texture, and a shader bends
// it: rings travel out from the touch point across the whole phone, each one lifting the
// surface so that whatever is drawn there (bubbles, words) curves with it, and a little light
// catches the crest. Subtle, like touching a still pond.

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const MAX = 16;

const FRAG = `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;      // css px
uniform vec2 u_origin;   // css px, from the top left
uniform float u_time;    // seconds
uniform float u_dpr;
uniform float u_t0[${MAX}];
uniform float u_amp[${MAX}];
uniform int u_n;
varying vec2 v_uv;

const float SPEED = 400.0;   // px per second
const float LEN = 150.0;     // wavelength, px: three or four broad waves across the phone
const float PI2 = 6.2831853;

// Bayer 4x4, so the sheen is laid down as ordered pixels, not a gradient
float bayer(vec2 p) {
  vec2 c = floor(mod(p, 4.0));
  float i = c.x + c.y * 4.0;
  float v = 0.0;
  if (i == 0.0) v = 0.0;  else if (i == 1.0) v = 8.0;  else if (i == 2.0) v = 2.0;  else if (i == 3.0) v = 10.0;
  else if (i == 4.0) v = 12.0; else if (i == 5.0) v = 4.0;  else if (i == 6.0) v = 14.0; else if (i == 7.0) v = 6.0;
  else if (i == 8.0) v = 3.0;  else if (i == 9.0) v = 11.0; else if (i == 10.0) v = 1.0; else if (i == 11.0) v = 9.0;
  else if (i == 12.0) v = 15.0; else if (i == 13.0) v = 7.0; else if (i == 14.0) v = 13.0; else v = 5.0;
  return (v + 0.5) / 16.0;
}

// Thin-film colours, the oil-slick sheen on glass
vec3 film(float t) {
  return 0.5 + 0.5 * cos(PI2 * (t + vec3(0.0, 0.33, 0.67)));
}

void main() {
  // v_uv has y up; the snapshot and the touch point count from the top
  vec2 px = vec2(v_uv.x, 1.0 - v_uv.y) * u_res;
  vec2 d = px - u_origin;
  float dist = length(d);
  vec2 dir = dist > 0.5 ? d / dist : vec2(0.0);
  float disp = 0.0;
  float slope = 0.0;
  float height = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= u_n) break;
    float age = u_time - u_t0[i];
    if (age < 0.0) continue;
    float r = age * SPEED;
    float x = dist - r;                      // ahead of the front: positive
    float env = exp(-x * x / (2.0 * LEN * LEN)) * u_amp[i] * exp(-age * 0.35) / (1.0 + r / 900.0);
    float ph = x * PI2 / LEN;
    disp += sin(ph) * env;
    slope += cos(ph) * env;
    height = max(height, env * (0.5 + 0.5 * sin(ph)));
  }
  // Refraction: the screen under the wave bends with it
  vec2 off = vec2(dir.x, -dir.y) * disp * (7.0 / u_res);
  vec2 uv = v_uv + off;
  vec2 soft = vec2(dir.x, -dir.y) * abs(slope) * (1.6 / u_res);
  vec4 c = texture2D(u_tex, clamp(uv, vec2(0.001), vec2(0.999))) * 0.5
         + texture2D(u_tex, clamp(uv + soft, vec2(0.001), vec2(0.999))) * 0.25
         + texture2D(u_tex, clamp(uv - soft, vec2(0.001), vec2(0.999))) * 0.25;
  // The sheen: thin-film colour where the surface tilts, laid down as a 2px ordered dither
  float sheen = clamp(abs(slope) * 1.2, 0.0, 1.0) * height * height;
  float th = bayer(floor(gl_FragCoord.xy / (2.0 * u_dpr)));
  float on = step(th, sheen * 0.3);
  vec3 tint = film(dist / 260.0 + u_time * 0.08 + slope * 0.35);
  c.rgb = mix(c.rgb, mix(c.rgb, tint, 0.22) + 0.06, on * 0.6);
  // A soft lift on the crest and shade behind it, so it reads as a surface
  c.rgb += slope * 0.03;
  gl_FragColor = c;
}`;

export interface Water {
  ring(amp: number): void;
  frame(now: number): void;
  destroy(): void;
}

export function water(canvas: HTMLCanvasElement, snapshot: HTMLCanvasElement, origin: { x: number; y: number }, start: number): Water | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false });
  if (!gl) return null;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapshot);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  gl.uniform2f(u("u_res"), W, H);
  gl.uniform1f(u("u_dpr"), dpr);
  gl.uniform2f(u("u_origin"), origin.x, origin.y);
  gl.uniform1i(u("u_tex"), 0);
  const uTime = u("u_time");
  const uT0 = u("u_t0");
  const uAmp = u("u_amp");
  const uN = u("u_n");

  const t0 = new Float32Array(MAX);
  const amp = new Float32Array(MAX);
  let n = 0;
  let lastNow = start;
  const ring = (a: number) => {
    // Oldest ring gives way once we're full
    if (n === MAX) {
      t0.copyWithin(0, 1);
      amp.copyWithin(0, 1);
      n--;
    }
    t0[n] = (lastNow - start) / 1000;
    amp[n] = a;
    n++;
  };

  return {
    ring,
    frame(now) {
      lastNow = now;
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform1fv(uT0, t0);
      gl.uniform1fv(uAmp, amp);
      gl.uniform1i(uN, n);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    },
  };
}
