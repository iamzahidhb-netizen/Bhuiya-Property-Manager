/*!
 * liquid-glass.js — Apple-style liquid glass refraction for any element.
 *
 * Source: https://github.com/deepika-builds/liquid-glass
 * MIT License — Copyright (c) 2026 Deepika Rao
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Technique informed by https://aave.com/design/building-glass-for-the-web and
 * https://github.com/rizroze/liquid-glass
 */

const SVG_NS = "http://www.w3.org/2000/svg";
let uid = 0;
let svgDefs = null;

// Chromium can apply SVG filters via backdrop-filter; Safari and Firefox
// silently no-op, so they get the frosted fallback instead.
export const isLiquidGlassSupported = (() => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Brave/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  if (isSafari || isFirefox) return false;
  if (typeof CSS === "undefined" || !CSS.supports || !CSS.supports("backdrop-filter", "url(#lg)")) return false;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 4;
    c.getContext("2d")?.getImageData(0, 0, 1, 1);
    return true;
  } catch (_) {
    return false;
  }
})();

function ensureDefs() {
  if (svgDefs && svgDefs.ownerDocument && document.body.contains(svgDefs)) {
    return svgDefs;
  }
  const svg = document.createElementNS(SVG_NS, "svg");
  // width/height 0 keeps it renderable (display:none would break feImage)
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";
  svg.style.opacity = "0";
  svg.style.zIndex = "-1";
  svgDefs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(svgDefs);
  if (document.body) {
    document.body.appendChild(svg);
  }
  return svgDefs;
}

// Displacement map, gradient-difference method: a red left->right ramp
// encodes X displacement, a blue top->bottom ramp encodes Y ("difference"
// keeps both since the channels are disjoint). A blurred, inset 50%-gray
// rounded rect neutralizes the interior, confining the refraction bulge to
// an edge band whose curvature is set by the blur radius.
function makeMap(w, h, radius, border, mapBlur) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const gx = ctx.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, "rgb(0,0,0)");
  gx.addColorStop(1, "rgb(255,0,0)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, w, h);

  const gy = ctx.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, "rgb(0,0,0)");
  gy.addColorStop(1, "rgb(0,0,255)");
  ctx.globalCompositeOperation = "difference";
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "source-over";
  const inset = border * Math.min(w, h);
  ctx.filter = "blur(" + mapBlur + "px)";
  ctx.fillStyle = "rgba(128,128,128,0.93)";
  ctx.beginPath();
  const r = Math.max(radius - inset, 2);
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(inset, inset, Math.max(1, w - inset * 2), Math.max(1, h - inset * 2), r);
  } else {
    // Fallback if roundRect is not defined
    ctx.rect(inset, inset, Math.max(1, w - inset * 2), Math.max(1, h - inset * 2));
  }
  ctx.fill();
  ctx.filter = "none";
  return canvas.toDataURL();
}

// Three displacement passes at staggered scales (R strongest), channels
// isolated with feColorMatrix and recombined with screen blends — the
// faint prism fringe at the rim.
function buildFilter(id, scales) {
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  // Load-bearing: filters default to linearRGB, which re-maps the map's
  // neutral gray 128 to ~0.216 and injects a constant phantom displacement.
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const feImage = document.createElementNS(SVG_NS, "feImage");
  feImage.setAttribute("x", "0");
  feImage.setAttribute("y", "0");
  feImage.setAttribute("result", "map");
  feImage.setAttribute("preserveAspectRatio", "none");
  filter.appendChild(feImage);

  const keep = [
    "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
    "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
    "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
  ];
  const channels = [];
  for (let i = 0; i < 3; i++) {
    const disp = document.createElementNS(SVG_NS, "feDisplacementMap");
    disp.setAttribute("in", "SourceGraphic");
    disp.setAttribute("in2", "map");
    disp.setAttribute("scale", String(scales[i]));
    disp.setAttribute("xChannelSelector", "R");
    disp.setAttribute("yChannelSelector", "B");
    disp.setAttribute("result", "d" + i);
    filter.appendChild(disp);

    const cm = document.createElementNS(SVG_NS, "feColorMatrix");
    cm.setAttribute("in", "d" + i);
    cm.setAttribute("type", "matrix");
    cm.setAttribute("values", keep[i]);
    cm.setAttribute("result", "c" + i);
    filter.appendChild(cm);
    channels.push("c" + i);
  }

  const blend1 = document.createElementNS(SVG_NS, "feBlend");
  blend1.setAttribute("in", channels[0]);
  blend1.setAttribute("in2", channels[1]);
  blend1.setAttribute("mode", "screen");
  blend1.setAttribute("result", "c01");
  filter.appendChild(blend1);

  const blend2 = document.createElementNS(SVG_NS, "feBlend");
  blend2.setAttribute("in", "c01");
  blend2.setAttribute("in2", channels[2]);
  blend2.setAttribute("mode", "screen");
  filter.appendChild(blend2);

  const defs = ensureDefs();
  if (defs) {
    defs.appendChild(filter);
  }
  return { filter, feImage };
}

function resolveRadius(el, w, h, override) {
  if (override != null) return override;
  const raw = getComputedStyle(el).borderTopLeftRadius || "0px";
  const v = parseFloat(raw) || 0;
  return raw.trim().endsWith("%") ? (v / 100) * Math.min(w, h) : v;
}

/**
 * Apply liquid glass to an element.
 *
 * @param {HTMLElement} el
 * @param {Object} [opts]
 * @param {number} [opts.scale=-112]       Displacement strength (negative = magnifying bulge).
 * @param {number} [opts.chroma=6]         Per-channel scale stagger; 0 disables the prism fringe.
 * @param {number} [opts.border=0.07]      Neutral interior inset as a fraction of the smaller side.
 * @param {number} [opts.mapBlur=12]       Edge-curvature softness (px) of the map's gray inset.
 * @param {number} [opts.blur=3]           Backdrop blur (px) behind the glass interior.
 * @param {number} [opts.saturate=1.5]     Backdrop saturation boost.
 * @param {number} [opts.radius]           Corner radius override (px); default reads border-radius.
 * @param {number} [opts.fallbackBlur=16]  Frosted blur (px) where refraction is unsupported.
 * @returns {{supported: boolean, refresh: Function, destroy: Function}}
 */
export function liquidGlass(el, opts) {
  if (!el || typeof window === "undefined") {
    return {
      supported: false,
      refresh: () => {},
      destroy: () => {},
    };
  }

  const o = Object.assign(
    {
      scale: -112,
      chroma: 6,
      border: 0.07,
      mapBlur: 12,
      blur: 3,
      saturate: 1.5,
      radius: null,
      fallbackBlur: 16,
    },
    opts
  );

  const isTouchDevice = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (!isLiquidGlassSupported || isTouchDevice) {
    const frosted = "blur(" + o.fallbackBlur + "px) saturate(" + o.saturate + ")";
    el.style.backdropFilter = frosted;
    el.style.webkitBackdropFilter = frosted;
    el.classList.add("lg-fallback");
    return {
      supported: false,
      refresh: function () {},
      destroy: function () {
        el.style.backdropFilter = "";
        el.style.webkitBackdropFilter = "";
        el.classList.remove("lg-fallback");
      },
    };
  }

  const id = "lg-filter-" + (++uid);
  const scales = [o.scale, o.scale + o.chroma, o.scale + 2 * o.chroma];
  const parts = buildFilter(id, scales);

  function refresh() {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
    const radius = resolveRadius(el, w, h, o.radius);
    const mapUri = makeMap(w, h, radius, o.border, o.mapBlur);
    if (mapUri) {
      parts.feImage.setAttribute("href", mapUri);
      parts.feImage.setAttribute("width", String(w));
      parts.feImage.setAttribute("height", String(h));
    }
  }

  refresh();
  const filterVal = "url(#" + id + ") blur(" + o.blur + "px) saturate(" + o.saturate + ")";
  el.style.backdropFilter = filterVal;
  el.style.webkitBackdropFilter = filterVal;

  let timer = null;
  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 120);
    });
    ro.observe(el);
  }

  return {
    supported: true,
    refresh: refresh,
    destroy: function () {
      if (ro) ro.disconnect();
      if (timer) clearTimeout(timer);
      if (parts && parts.filter && parts.filter.parentNode) {
        parts.filter.remove();
      }
      el.style.backdropFilter = "";
      el.style.webkitBackdropFilter = "";
    },
  };
}

// Global browser window attachment for compatibility
if (typeof window !== "undefined") {
  window.liquidGlass = liquidGlass;
  window.isLiquidGlassSupported = isLiquidGlassSupported;
}

export default liquidGlass;
