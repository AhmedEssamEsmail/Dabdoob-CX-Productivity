'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */

/**
 * Zb — Hub ecosystem page, verbatim port of the legacy closure
 * (`.devin/work/extract/hub/pages/ecosystem.closure.js`).
 *
 * The legacy bundle embedded three.js r186; this port binds the same minified
 * symbol names to real `three` imports so the page-specific scene code stays
 * byte-for-byte equivalent to the extracted closure.
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import {
  Eo,
  Ft,
  Gs,
  Pr,
  fetchJson,
} from '@/features/cx-hub/components/hub-shared'
import { PAGES } from '@/features/shared/components/shell/registry'
import { Button } from '@/features/shared/components/ui'
import { appForGroup, groupEntryLink } from '@/features/shared/shell/gates'

// ---------------------------------------------------------------------------
// three.js symbol bindings (minified closure names -> real classes/constants)
// ---------------------------------------------------------------------------
const P = THREE.Vector3
const ue = THREE.Vector2
const be = THREE.Color
const Qe = THREE.Matrix4
const Kn = THREE.Quaternion
const gi = THREE.Euler
const Pt = THREE.Object3D
const $t = THREE.Group
const Ou = THREE.Scene
const un = THREE.PerspectiveCamera
const y_ = THREE.HemisphereLight
const w_ = THREE.DirectionalLight
const S_ = THREE.PointLight
const et = THREE.Mesh
const K0 = THREE.Points
const Er = THREE.InstancedMesh
const H0 = THREE.Sprite
const lp = THREE.SpriteMaterial
const R_ = THREE.Raycaster
const Zn = THREE.CanvasTexture
const Xt = THREE.Texture
const Ct = THREE.BufferGeometry
const Je = THREE.Float32BufferAttribute
const fn = THREE.BufferAttribute
const Hc = THREE.InstancedBufferAttribute
const hp = THREE.Bone
const W0 = THREE.SkinnedMesh
const Vs = THREE.PlaneGeometry
const En = THREE.BoxGeometry
const Ws = THREE.SphereGeometry
const Qi = THREE.ConeGeometry
const rn = THREE.CylinderGeometry
const Lh = THREE.RingGeometry
const Do = THREE.TubeGeometry
const Po = THREE.CatmullRomCurve3
const Ph = THREE.QuadraticBezierCurve3
const Dh = THREE.IcosahedronGeometry
const qt = THREE.MeshStandardMaterial
const Hn = THREE.MeshBasicMaterial
const kt = THREE.ShaderMaterial
const Vc = THREE.MeshPhysicalMaterial
const Uo = Sky
const wb = Water
const Xc = THREE.PMREMGenerator
const gp = THREE.LoadingManager
const x_ = THREE.TextureLoader
const Kt = THREE.WebGLRenderTarget
const $S = EffectComposer
const KS = RenderPass
const zs = UnrealBloomPass
const JS = OutputPass
const PS = OrbitControls
const wh = THREE.FogExp2
const CS = THREE.WebGLRenderer

const Co = THREE.ACESFilmicToneMapping
const Xf = THREE.PCFSoftShadowMap
const dn = THREE.DoubleSide
const en = THREE.HalfFloatType
const In = THREE.RepeatWrapping
const Lt = THREE.SRGBColorSpace
const ci = THREE.NoColorSpace
const $i = THREE.AdditiveBlending

// ---------------------------------------------------------------------------
// Page constants (verbatim from the closure)
// ---------------------------------------------------------------------------
function Hb(n: number) {
  const e = Math.round((n % 24 + 24) % 24 * 60) % 1440
  return `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`
}

const Jd = Gs

function Yb() {
  try {
    const n = document.createElement('canvas').getContext('webgl2')
    return n ? (n.getExtension('WEBGL_lose_context')?.loseContext(), !0) : !1
  } catch {
    return !1
  }
}

const _r = ['hub', 'quality', 'productivity', 'queue', 'desk', 'people', 'operations', 'fcr'],
  ei = ['quality', 'productivity', 'queue', 'desk', 'people', 'operations', 'fcr'],
  ia: Record<string, string> = {
    hub: 'Main Hub',
    quality: 'Quality',
    productivity: 'Productivity',
    queue: 'Queue & Workforce',
    people: 'People & Performance',
    operations: 'Operations & Trackers',
    fcr: 'FCR',
    desk: 'TL Desk',
  },
  vu: Record<string, string> = {
    ok: 'Healthy',
    warn: 'Warning',
    down: 'Down',
    idle: 'Idle',
  },
  // kept raw: WebGL/Three.js palette values cannot consume CSS custom properties.
  tr: Record<string, string> = {
    ok: '#86ab98',
    warn: '#c2a878',
    down: '#c98f88',
    idle: '#8d97a5',
  },
  sa: Record<string, number> = {
    ok: 1,
    warn: 1,
    down: 0.72,
    idle: 0.58,
  }

const ib = 8.1

const zl = () => {
  const n = new Date()
  return n.getHours() + n.getMinutes() / 60
},
  qd = 110,
  Ip = 3.5,
  Es = ib * Ip,
  Gb: Record<string, number> = {
    quality: -120 * Math.PI / 180,
    productivity: -60 * Math.PI / 180,
    queue: -20 * Math.PI / 180,
    desk: 20 * Math.PI / 180,
    people: 60 * Math.PI / 180,
    operations: 120 * Math.PI / 180,
    fcr: Math.PI,
  },
  Ds = new P(-25, 5, 0),
  Cr = new P(30, 40, 250),
  Ha = Math.atan2(Ds.z - Cr.z, Ds.x - Cr.x),
  Yd = 0.45,
  Ga = 2.5,
  Vb = 2.7,
  $d = ['#b08a5e', '#9c7a52', '#bf9d74', '#8d6c48', '#b39270', '#a3825c', '#97744e'],
  Wb: Record<string, number> = {
    ok: 3.6,
    warn: 1.4,
    down: 0,
    idle: 0,
  },
  Kd = 64,
  Zd = 6,
  mr = [0, 0.5, -0.25, -0.75],
  _n = (n: number, e: number, t: number) => {
    const i = Math.min(1, Math.max(0, (t - n) / (e - n)))
    return i * i * (3 - 2 * i)
  },
  Xb = (n: number) => n < 0.5 ? 4 * n * n * n : 1 - Math.pow(-2 * n + 2, 3) / 2

const Fl = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k',
  Bl = (n: string) => ({
    map: `${Fl}/${n}/${n}_diff_1k.jpg`,
    normal: `${Fl}/${n}/${n}_nor_gl_1k.jpg`,
    rough: `${Fl}/${n}/${n}_rough_1k.jpg`,
  }),
  Vd = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples/textures',
  pr = {
    sand: Bl('dense_sand'),
    stone: Bl('large_sandstone_blocks'),
    rock: Bl('dark_rock_02'),
    water: `${Vd}/waternormals.jpg`,
    moon: `${Vd}/planets/moon_1024.jpg`,
  },
  As = {
    url: 'https://cdn.jsdelivr.net/gh/LukaArambasic/three-js@31a779de0929e77ee5da5f5eff8e99eec2144b2e/video3/public/scene.gltf',
    author: 'eb78',
    authorUrl: 'https://sketchfab.com/E.A.Cornell',
    source: 'https://sketchfab.com/3d-models/camel-99af7daa5baf450ea7b809937937e6d5',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  }

function Od(n: any[]) {
  let e: any,
    t: any,
    i: any,
    s = -1,
    r = 0
  for (let l = 0; l < n.length; ++l) {
    const h = n[l]
    if (e === void 0 && (e = h.array.constructor), e !== h.array.constructor) return console.error('THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.'), null
    if (t === void 0 && (t = h.itemSize), t !== h.itemSize) return console.error('THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.'), null
    if (i === void 0 && (i = h.normalized), i !== h.normalized) return console.error('THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.'), null
    if (s === -1 && (s = h.gpuType), s !== h.gpuType) return console.error('THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.'), null
    r += h.count * t
  }
  const a = new e(r),
    o = new fn(a, t, i)
  let c = 0
  for (let l = 0; l < n.length; ++l) {
    const h = n[l]
    if (h.isInterleavedBufferAttribute) {
      const u = c / t
      for (let d = 0, p = h.count; d < p; d++) for (let g = 0; g < t; g++) {
        const y = h.getComponent(d, g)
        o.setComponent(d + u, g, y)
      }
    } else a.set(h.array, c)
    c += h.count * t
  }
  return s !== void 0 && ((o as any).gpuType = s), o
}

function kr(n: any[], e = !1) {
  const t = n[0].index !== null,
    i = new Set(Object.keys(n[0].attributes)),
    s = new Set(Object.keys(n[0].morphAttributes)),
    r: Record<string, any[]> = {},
    a: Record<string, any[]> = {},
    o = n[0].morphTargetsRelative,
    c = new Ct()
  let l = 0
  for (let h = 0; h < n.length; ++h) {
    const u = n[h]
    let d = 0
    if (t !== (u.index !== null)) return console.error('THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + h + '. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.'), null
    for (const p in u.attributes) {
      if (!i.has(p)) return console.error('THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + h + '. All geometries must have compatible attributes; make sure "' + p + '" attribute exists among all geometries, or in none of them.'), null
      r[p] === void 0 && (r[p] = []), r[p].push(u.attributes[p]), d++
    }
    if (d !== i.size) return console.error('THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + h + '. Make sure all geometries have the same number of attributes.'), null
    if (o !== u.morphTargetsRelative) return console.error('THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + h + '. .morphTargetsRelative must be consistent throughout all geometries.'), null
    for (const p in u.morphAttributes) {
      if (!s.has(p)) return console.error('THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + h + '.  .morphAttributes must be consistent throughout all geometries.'), null
      a[p] === void 0 && (a[p] = []), a[p].push(u.morphAttributes[p])
    }
    if (e) {
      let p
      if (t) p = u.index.count; else if (u.attributes.position !== void 0) p = u.attributes.position.count; else return console.error('THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + h + '. The geometry must have either an index or a position attribute'), null
      c.addGroup(l, p, h), l += p
    }
  }
  if (t) {
    let h = 0
    const u: number[] = []
    for (let d = 0; d < n.length; ++d) {
      const p = n[d].index
      for (let g = 0; g < p.count; ++g) u.push(p.getX(g) + h)
      h += n[d].attributes.position.count
    }
    c.setIndex(u)
  }
  for (const h in r) {
    const u = Od(r[h])
    if (!u) return console.error('THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the ' + h + ' attribute.'), null
    c.setAttribute(h, u)
  }
  for (const h in a) {
    const u = a[h][0].length
    if (u !== 0) {
      c.morphAttributes = c.morphAttributes || {}, (c.morphAttributes as any)[h] = []
      for (let d = 0; d < u; ++d) {
        const p = []
        for (let y = 0; y < a[h].length; ++y) p.push(a[h][y][d])
        const g = Od(p)
        if (!g) {
          console.error('THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the ' + h + ' morphAttribute.')
          return null
        }
        (c.morphAttributes as any)[h].push(g)
      }
    }
  }
  return c
}

function Ab() {
  const n = []
  for (let e = 0; e < 15; e++) {
    const t = new Vs(1.1, 4.4, 1, 8),
      i = t.attributes.position,
      s = []
    for (let r = 0; r < i.count; r++) {
      const a = i.getY(r) + 2.2,
        o = a / 4.4
      i.setXYZ(r, i.getX(r), 1.1 * Math.sin(o * Math.PI * 0.55) - 1.9 * o * o, a * 0.95 - Math.abs(i.getX(r)) * 0.3), s.push(o)
    }
    t.setAttribute('aSway', new Je(s, 1)), t.computeVertexNormals(), t.rotateX(e < 5 ? -0.3 : e < 10 ? -0.05 : 0.15), t.rotateY(e / 15 * Math.PI * 2 + e % 3 * 0.17), n.push(t)
  }
  return kr(n)
}

function Eb() {
  const e = document.createElement('canvas')
  e.width = e.height = 128
  const t = e.getContext('2d')!,
    i = t.createImageData(128, 128),
    s = [[3, 1, 0.5], [1, 4, 0.35], [5, -2, 0.25], [-2, 7, 0.18], [8, 3, 0.12], [-6, -5, 0.1], [11, -7, 0.06]]
  for (let a = 0; a < 128; a++) for (let o = 0; o < 128; o++) {
    let c = 0,
      l = 0
    for (const [d, p, g] of s) {
      const y = (d * o + p * a) / 128 * Math.PI * 2
      c += g * d * Math.cos(y) * 0.1, l += g * p * Math.cos(y) * 0.1
    }
    const h = Math.hypot(c, l, 1),
      u = (a * 128 + o) * 4
    i.data[u] = (-c / h * 0.5 + 0.5) * 255, i.data[u + 1] = (-l / h * 0.5 + 0.5) * 255, i.data[u + 2] = (1 / h * 0.5 + 0.5) * 255, i.data[u + 3] = 255
  }
  t.putImageData(i, 0, 0)
  const r = new Zn(e)
  return r.wrapS = r.wrapT = In, r
}

function Hd(n: any, e: any, t: number) {
  n.onBeforeCompile = (i: any) => {
    i.uniforms.uTime = e, i.vertexShader = i.vertexShader.replace('#include <common>', `#include <common>
attribute float aSway;
uniform float uTime;`).replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float eco3ph = instanceMatrix[3].x * 0.07 + instanceMatrix[3].z * 0.05;
        #else
          float eco3ph = 0.0;
        #endif
        float eco3g = sin(uTime * 1.1 + eco3ph) * 0.6 + sin(uTime * 2.3 + eco3ph * 1.7) * 0.25;
        transformed.x += eco3g * aSway * aSway * ${t.toFixed(2)};
        transformed.y -= abs(eco3g) * aSway * aSway * ${(t * 0.3).toFixed(2)};`)
  }
}

const ai = new Po([[-165, 700], [-172, 300], [-178, 0], [-168, -300], [-225, -650], [-205, -1050], [-330, -1600], [-280, -2500], [-430, -3400]].map(([n, e]) => new P(n, 0, e)), !1, 'centripetal'),
  to = -0.6,
  yr = (n: number) => 34 + 50 * Math.pow(n, 0.8),
  Nl = (() => {
    const n = []
    for (let e = 0; e <= 400; e++) {
      const t = e / 400,
        i = ai.getPointAt(t)
      n.push({
        x: i.x,
        z: i.z,
        hw: yr(t),
      })
    }
    return n
  })()

function Dp(n: number, e: number) {
  let t = 1 / 0,
    i = 34
  for (let s = 0; s < Nl.length - 1; s++) {
    const r = Nl[s],
      a = Nl[s + 1],
      o = a.x - r.x,
      c = a.z - r.z,
      l = Math.max(0, Math.min(1, ((n - r.x) * o + (e - r.z) * c) / (o * o + c * c))),
      h = n - r.x - o * l,
      u = e - r.z - c * l,
      d = h * h + u * u
    d < t && (t = d, i = r.hw + (a.hw - r.hw) * l)
  }
  return {
    d: Math.sqrt(t),
    hw: i,
  }
}

const Bd = 34

function di(n: number, e: number) {
  const t = Math.sin(n * 127.1 + e * 311.7) * 43758.5453
  return t - Math.floor(t)
}

function Vn(n: number, e: number) {
  const t = Math.floor(n),
    i = Math.floor(e),
    s = n - t,
    r = e - i,
    a = s * s * (3 - 2 * s),
    o = r * r * (3 - 2 * r),
    c = di(t, i),
    l = di(t + 1, i),
    h = di(t, i + 1),
    u = di(t + 1, i + 1)
  return c + (l - c) * a + (h - c) * o + (c - l - h + u) * a * o
}

function Lp(n: number, e: number) {
  let t = 0,
    i = 0.5,
    s = 1 / 150
  for (let o = 0; o < 4; o++) t += i * Vn(n * s, e * s), i *= 0.5, s *= 2.07
  const r = Vn(n / 260 + 7.3, e / 260 - 2.1) * 90,
    a = 1 - Math.abs(Math.sin((n * 0.82 + e * 0.57 + r) / 46))
  return t + 0.75 * Math.pow(a, 2.4)
}

const wi = (n: number, e: number, t: number) => {
  const i = Math.min(1, Math.max(0, (t - n) / (e - n)))
  return i * i * (3 - 2 * i)
}

function mb(n: number, e: number) {
  const t = Math.hypot(n, e),
    i = Math.max(Math.abs(n), Math.abs(e)),
    s = i > Bd - 6 ? 2.6 * Math.exp(-Math.pow((i - Bd + 1) / 7, 2)) * (0.7 + 0.6 * Vn(n / 9, e / 9)) : 2.6,
    r = 0.6 * (Vn(n / 40, e / 40) - 0.5),
    a = wi(150, 260, t),
    o = 7 + 0.012 * Math.min(t, 2200),
    c = wi(500, 1400, t) * 60 * Vn(n / 460 + 3, e / 460 - 5)
  return s + r + a * (o * (Lp(n, e) - 0.55) + c)
}

function Os(n: number, e: number, t = Dp(n, e)) {
  const {
    d: i,
    hw: s,
  } = t,
    r = mb(n, e) * wi(s + 30, s + 120, i),
    a = to - 2.4
  return a + (r + 0.25 - a) * wi(s - 8, s + 6, i)
}

function Tb() {
  const t = document.createElement('canvas')
  t.width = 64, t.height = 256
  const i = t.getContext('2d')!
  i.strokeStyle = '#ffffff', i.lineCap = 'round', i.lineWidth = 3, i.beginPath(), i.moveTo(64 / 2, 0), i.lineTo(64 / 2, 256), i.stroke(), i.lineWidth = 2.2
  for (let r = 8; r < 252; r += 6) {
    const a = 30 * Math.sin(r / 256 * Math.PI * 0.9 + 0.15)
    for (const o of [-1, 1]) i.beginPath(), i.moveTo(64 / 2, r), i.lineTo(64 / 2 + o * a, r + 11), i.stroke()
  }
  const s = new Zn(t)
  return s.colorSpace = Lt, s
}

function Cb(n: boolean) {
  const e = new $t(),
    t = Eb(),
    i = Tb(),
    s = {
      value: 0,
    },
    r = 480,
    a: number[] = [],
    o: number[] = [],
    c: number[] = [],
    l = new P(),
    h = new P(),
    u = 6
  for (let oe = 0; oe <= r; oe++) {
    const Le = oe / r
    ai.getPointAt(Le, l), ai.getTangentAt(Le, h)
    const De = yr(Le) + 4,
      Oe = -h.z,
      Ye = h.x,
      Ke = Math.hypot(Oe, Ye)
    for (let ut = 0; ut <= u; ut++) {
      const je = ut / u * 2 - 1
      a.push(l.x + je * De * Oe / Ke, -(l.z + je * De * Ye / Ke), 0), o.push(1 - Math.abs(je))
    }
    if (oe < r) for (let ut = 0; ut < u; ut++) {
      const je = oe * (u + 1) + ut,
        rt = je + u + 1
      c.push(je, rt, je + 1, je + 1, rt, rt + 1)
    }
  }
  const d = new Ct()
  d.setAttribute('position', new Je(a, 3)), d.setAttribute('aEdge', new Je(o, 1)), d.setIndex(c), d.computeVertexNormals()
  const p: any = new wb(d, {
    textureWidth: n ? 256 : 512,
    textureHeight: n ? 256 : 512,
    waterNormals: t,
    sunDirection: new P(0, 1, 0),
    sunColor: 16777215,
    waterColor: 1915699,
    distortionScale: 3.2,
    fog: !0,
    side: dn,
  }),
    g = p.material
  g.vertexShader = g.vertexShader.replace('varying vec4 worldPosition;', `varying vec4 worldPosition;
attribute float aEdge;
varying float vEdge;`).replace('void main() {', `void main() {
vEdge = aEdge;`), g.fragmentShader = g.fragmentShader.replace('uniform float alpha;', `uniform float alpha;
varying float vEdge;`).replace('vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );', 'vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) ) * 0.62;').replace('gl_FragColor = vec4( outgoingLight, alpha );', `float eco3sh = smoothstep(0.0, 0.32, vEdge);
      vec3 eco3silt = vec3(0.30, 0.24, 0.15) * (0.35 + 0.65 * max(0.0, dot(surfaceNormal, eyeDirection)));
      outgoingLight = mix(mix(eco3silt, outgoingLight, 0.45), outgoingLight, eco3sh);
      gl_FragColor = vec4( outgoingLight, mix(0.55, 1.0, smoothstep(0.0, 0.12, vEdge)) );`), g.transparent = !0, g.uniforms.size.value = 0.55, p.rotation.x = -Math.PI / 2, p.position.y = to, p.renderOrder = 1, e.add(p)
  const y = p.onBeforeRender.bind(p)
  let v = 0,
    m = n
  p.onBeforeRender = (...oe: any[]) => {
    v++, (!m || v % 2 === 0) && y(...oe as [])
  }
  const E = new rn(0.2, 0.32, 1, 7, 8, !0).translate(0, 0.5, 0)
  {
    const oe = E.attributes.position
    for (let Le = 0; Le < oe.count; Le++) {
      const De = oe.getY(Le),
        Oe = 1 + 0.06 * Math.sin(De * 60)
      oe.setX(Le, oe.getX(Le) * Oe * (1 + 0.25 * Math.max(0, De - 0.88) * 7) + 0.22 * De * De), oe.setZ(Le, oe.getZ(Le) * Oe)
    }
    E.computeVertexNormals()
  }
  const C = Ab(),
    x = new qt({
      color: '#6e5638',
      roughness: 0.95,
    }),
    b = new qt({
      color: '#4f7a2c',
      map: i,
      alphaTest: 0.45,
      side: dn,
      roughness: 0.75,
    })
  Hd(b, s, 0.55)
  let w = 5
  const S = () => (w = w * 16807 % 2147483647) / 2147483647,
    _: { x: number; z: number; h: number; lean: number; yaw: number }[] = [],
    T = n ? 26 : 46
  for (let oe = 0; oe < T; oe++) {
    const Le = Math.pow(S(), 1.6) * 0.28
    ai.getPointAt(Le, l), ai.getTangentAt(Le, h)
    const De = S() < 0.5 ? 1 : -1,
      Oe = yr(Le) + 6 + Math.pow(S(), 1.5) * 40,
      Ye = l.x - h.z * De * Oe,
      Ke = l.z + h.x * De * Oe,
      ut = 2 + Math.floor(S() * S() * 8)
    for (let je = 0; je < ut; je++) {
      const rt = S() * Math.PI * 2,
        z = Math.sqrt(S()) * (3 + ut * 1.2),
        Tt = Ye + Math.cos(rt) * z,
        at = Ke + Math.sin(rt) * z
      Math.hypot(Tt, at) < 135 || _.push({
        x: Tt,
        z: at,
        h: 8 + S() * 9,
        lean: (S() - 0.5) * 0.35,
        yaw: S() * Math.PI * 2,
      })
    }
  }
  const R = new Er(E, x, _.length),
    D = new Er(C!, b, _.length),
    L = new Pt()
  _.forEach((oe, Le) => {
    const De = Os(oe.x, oe.z) - 0.2
    L.position.set(oe.x, De, oe.z), L.rotation.set(oe.lean, oe.yaw, 0), L.scale.set(1.2, oe.h, 1.2), L.updateMatrix(), R.setMatrixAt(Le, L.matrix)
    const Oe = new P(0.22, 1, 0).applyMatrix4(L.matrix)
    L.position.copy(Oe), L.scale.setScalar(1.1 + oe.h * 0.05), L.rotation.set(oe.lean * 0.5, oe.yaw + Le, 0), L.updateMatrix(), D.setMatrixAt(Le, L.matrix)
  })
  for (const oe of [R, D]) oe.castShadow = !0, oe.receiveShadow = !0, e.add(oe)
  const H = []
  for (let oe = 0; oe < 9; oe++) {
    const Le = 1.8 + oe % 3 * 0.6,
      De = new Qi(0.06, Le, 3, 4).translate(0, Le / 2, 0),
      Oe = [],
      Ye = De.attributes.position
    for (let Ke = 0; Ke < Ye.count; Ke++) Oe.push(Ye.getY(Ke) / Le)
    De.setAttribute('aSway', new Je(Oe, 1)), De.rotateZ((oe - 4) * 0.1), De.rotateY(oe * 0.9), De.translate(Math.cos(oe * 2.1) * 0.35, 0, Math.sin(oe * 2.1) * 0.35), H.push(De)
  }
  const I = kr(H),
    O = new qt({
      color: '#7a8f3e',
      roughness: 0.85,
    })
  Hd(O, s, 0.35)
  const k = n ? 380 : 900,
    V = new Er(I!, O, k)
  let Z = 0
  for (let oe = 0; Z < k && oe < 400; oe++) {
    const Le = S() * 0.3
    ai.getPointAt(Le, l), ai.getTangentAt(Le, h)
    const De = S() < 0.5 ? 1 : -1,
      Oe = 6 + Math.floor(S() * 24)
    for (let Ye = 0; Ye < Oe && Z < k; Ye++) {
      const Ke = (S() - 0.5) * 22,
        ut = yr(Le) - 3 + S() * 6 + (S() - 0.5) * 2,
        je = l.x - h.z * De * ut + h.x * Ke,
        rt = l.z + h.x * De * ut + h.z * Ke
      L.position.set(je, Math.max(to - 0.3, Os(je, rt) - 0.15), rt), L.rotation.set(0, S() * 6, 0), L.scale.setScalar((0.7 + S() * 0.9) * (0.8 + 0.4 * Vn(je / 10, rt / 10))), L.updateMatrix(), V.setMatrixAt(Z++, L.matrix)
    }
  }
  V.count = Z, e.add(V)
  const q = new $t(),
    J = new et(new Ws(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.95, 0.55, 3.3), new qt({
      color: '#4a3424',
      roughness: 0.8,
    }))
  J.position.y = 0.35
  const se = new et(new rn(1, 1, 0.08, 16).scale(0.92, 1, 3.2), new qt({
    color: '#7a5a3a',
    roughness: 0.85,
  }))
  se.position.y = 0.36
  const Te = new qt({
    color: '#3d2a1a',
    roughness: 0.8,
  }),
    Ce = new et(new rn(0.06, 0.08, 6.2, 6).translate(0, 3.1, 0), Te)
  Ce.position.set(0, 0.35, 1), Ce.rotation.x = 0.08
  const He = new P(0, 1, 3.4),
    ze = new P(0, 9.2, -3.2),
    Xe = new P(0, 1.25, -2.4),
    Q = ze.clone().sub(He),
    te = new et(new rn(0.04, 0.05, Q.length(), 5).translate(0, Q.length() / 2, 0), Te)
  te.position.copy(He), te.quaternion.setFromUnitVectors(new P(0, 1, 0), Q.clone().normalize())
  const de = He.clone().add(ze).add(Xe).multiplyScalar(1 / 3).add(new P(0.7, 0, 0)),
    Me = new Ct()
  Me.setAttribute('position', new Je([He, ze, de, ze, Xe, de, Xe, He, de].flatMap(oe => [oe.x, oe.y, oe.z]), 3)), Me.computeVertexNormals()
  const Ae = new et(Me, new qt({
    color: '#f1ece0',
    roughness: 0.9,
    side: dn,
  }))
  for (const oe of [J, se, Ce, te, Ae]) oe.castShadow = !0, q.add(oe)
  q.scale.setScalar(1.25), e.add(q)
  let We = 0.05,
    St = 0
  return {
    group: e,
    water: p,
    textures: [t, i],
    update(oe: number, Le: any, De: any, Oe: number) {
      s.value += oe
      const Ye = g.uniforms
      Ye.time.value += oe * 0.35, Ye.sunDirection.value.copy(Le).normalize(), Ye.sunColor.value.copy(De).multiplyScalar(Oe), We += oe * 45e-6, We > 0.2 && (We = 0.03), St += oe, ai.getPointAt(We, l), ai.getTangentAt(We, h)
      const Ke = yr(We) * 0.3
      q.position.set(l.x - h.z * Ke, to - 0.05 + Math.sin(St * 1.3) * 0.06, l.z + h.x * Ke), q.rotation.set(Math.sin(St * 0.9) * 0.02, Math.atan2(h.x, h.z), Math.sin(St * 1.1) * 0.035)
    },
    setLowQuality(oe: boolean) {
      m = oe
    },
    useNormals(oe: any) {
      oe.wrapS = oe.wrapT = In, g.uniforms.normalSampler.value = oe
    },
  }
}

function Db(n: (p: number) => void, e = 3e4) {
  let t = !1
  const i: any[] = [],
    s = new gp()
  s.onProgress = (u, d, p) => n(p ? d / p : 0)
  const r = new x_(s)
  r.setCrossOrigin('anonymous')
  const a = (u: string, d: boolean) => new Promise<any>((p, g) => r.load(u, y => {
    y.colorSpace = d ? Lt : ci, i.push(y), p(y)
  }, void 0, () => g(new Error(`Could not load ${u}`)))),
    o = (u: any) => Promise.all([a(u.map, !0), u.normal ? a(u.normal, !1) : Promise.resolve(new Xt()), a(u.rough, !1)]).then(([d, p, g]) => ({
      map: d,
      normal: p,
      rough: g,
    })),
    c = Promise.all([o(pr.sand), o(pr.stone), o(pr.rock), a(pr.water, !1), a(pr.moon, !0)]).then(([u, d, p, g, y]) => ({
      sand: u,
      stone: d,
      rock: p,
      water: g,
      moon: y,
    })),
    l = new Promise((u, d) => setTimeout(() => d(new Error('Assets timed out')), e))
  return {
    promise: Promise.race([c, l]).then(u => {
      if (t) throw new Error('cancelled')
      return u
    }).catch(u => {
      throw i.forEach(d => d.dispose()), u
    }),
    cancel() {
      t = !0
    },
  }
}

const Mr = 2400,
  Mb = `
attribute float aSize;
attribute float aBright;
attribute float aPhase;
uniform float uTime;
uniform float uPr;
varying float vB;
void main() {
  float tw = 0.75 + 0.25 * sin(uTime * (1.3 + aPhase * 0.7) + aPhase * 6.283);
  vB = aBright * tw * smoothstep(0.0, 0.12, normalize(position).y); // fade into the horizon haze
  gl_PointSize = aSize * uPr;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  Sb = `
uniform float uOpacity;
varying float vB;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(p));
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * vB, a * uOpacity * vB);
}`

const Fb = 1.94,
  Bb = 1.44,
  ka = {
    top: '#04060f',
    hor: '#121633',
    hemi: 0.32,
    sun: 0,
    sunCol: '#ffb36b',
    neon: 1.65,
    stars: 1,
  },
  kb = [{
    h: 0,
    ...ka,
  }, {
    h: 4.9,
    ...ka,
  }, {
    h: 6.2,
    top: '#2a3768',
    hor: '#f0a156',
    hemi: 0.55,
    sun: 2,
    sunCol: '#ffae62',
    neon: 1.2,
    stars: 0.12,
  }, {
    h: 8,
    top: '#4d86c4',
    hor: '#f3cf94',
    hemi: 0.85,
    sun: 2.8,
    sunCol: '#ffd9a2',
    neon: 0.95,
    stars: 0,
  }, {
    h: 12.5,
    top: '#2f78cf',
    hor: '#bcdcf2',
    hemi: 1.05,
    sun: 3.3,
    sunCol: '#fff5e6',
    neon: 0.85,
    stars: 0,
  }, {
    h: 16.5,
    top: '#4579bb',
    hor: '#efcf9c',
    hemi: 0.9,
    sun: 2.8,
    sunCol: '#ffe0ae',
    neon: 0.95,
    stars: 0,
  }, {
    h: 18.1,
    top: '#3a2c6c',
    hor: '#ff7438',
    hemi: 0.55,
    sun: 1.8,
    sunCol: '#ff8442',
    neon: 1.25,
    stars: 0.08,
  }, {
    h: 19.3,
    top: '#17133d',
    hor: '#76386f',
    hemi: 0.4,
    sun: 0,
    sunCol: '#ff8442',
    neon: 1.5,
    stars: 0.6,
  }, {
    h: 20.6,
    ...ka,
  }, {
    h: 24,
    ...ka,
  }],
  kl = (n: string) => new be(n),
  za = kb.map(n => ({
    ...n,
    topC: kl(n.top),
    horC: kl(n.hor),
    sunC: kl(n.sunCol),
  }))

const Lb: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
},
  Ib: Record<number, any> = {
    5121: Uint8Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
  }

function Ob(n: any) {
  const e = n.getAttribute('skinWeight')
  if (e) for (let t = 0; t < e.count; t++) {
    const i = e.getX(t) + e.getY(t) + e.getZ(t) + e.getW(t)
    i > 0 && Math.abs(i - 1) > 1e-4 && e.setXYZW(t, e.getX(t) / i, e.getY(t) / i, e.getZ(t) / i, e.getW(t) / i)
  }
}

function Ub(n: any, e: any, t: number, i: number, s: number[]) {
  let r = 0,
    a = n.length - 1
  if (i <= n[0]) a = 0; else if (i >= n[a]) r = a; else for (; a - r > 1;) {
    const u = r + a >> 1
    n[u] <= i ? r = u : a = u
  }
  const o = a === r ? 0 : (i - n[r]) / (n[a] - n[r])
  let c = 0
  if (t === 4) for (let u = 0; u < 4; u++) c += e[r * 4 + u] * e[a * 4 + u]
  const l = c < 0 ? -1 : 1
  let h = 0
  for (let u = 0; u < t; u++) s[u] = e[r * t + u] + (e[a * t + u] * l - e[r * t + u]) * o, h += s[u] * s[u]
  if (t === 4) for (let u = 0; u < 4; u++) s[u] /= Math.sqrt(h) || 1
}

async function Nb(n: string, e: AbortSignal) {
  const t = await (await fetch(n, {
    signal: e,
  })).json(),
    i = new URL(t.buffers[0].uri, n).href,
    s = await (await fetch(i, {
      signal: e,
    })).arrayBuffer()
  if (t.extensionsRequired?.length || t.buffers.length !== 1) throw new Error('Unsupported camel model')
  const r = (C: number) => {
    const x = t.accessors[C],
      b = t.bufferViews[x.bufferView],
      w = Lb[x.type],
      S = Ib[x.componentType]
    if (!w || !S || x.sparse) throw new Error('Unsupported accessor')
    const _ = S.BYTES_PER_ELEMENT * w,
      T = b.byteStride || _,
      R = (b.byteOffset || 0) + (x.byteOffset || 0)
    if (T === _) return {
      array: new S(s.slice(R, R + x.count * _), 0, x.count * w),
      n: w,
    }
    const D = new S(x.count * w)
    for (let L = 0; L < x.count; L++) D.set(new S(s.slice(R + L * T, R + L * T + _), 0, w), L * w)
    return {
      array: D,
      n: w,
    }
  },
    a: Record<string, string> = {
      POSITION: 'position',
      NORMAL: 'normal',
      TEXCOORD_0: 'uv',
      JOINTS_0: 'skinIndex',
      WEIGHTS_0: 'skinWeight',
    },
    o = t.meshes.map((C: any) => {
      const x = C.primitives[0]
      if ((x.mode ?? 4) !== 4) throw new Error('Unsupported primitive')
      const b = new Ct()
      for (const [w, S] of Object.entries(a)) {
        if (x.attributes[w] === void 0) continue
        const {
          array: _,
          n: T,
        } = r(x.attributes[w])
        b.setAttribute(S, new fn(_, T))
      }
      return x.indices !== void 0 && b.setIndex(new fn(r(x.indices).array, 1)), Ob(b), {
        g: b,
        material: t.materials?.[x.material]?.name ?? '',
      }
    }),
    c: Record<string, number> = {
      rotation: 0,
      translation: 1,
      scale: 2,
    },
    l = (t.animations || []).map((C: any) => {
      const x = []
      let b = 0
      for (const w of C.channels) {
        const S = C.samplers[w.sampler]
        if ((S.interpolation || 'LINEAR') !== 'LINEAR') throw new Error('Unsupported interpolation')
        const _ = c[w.target.path]
        if (_ === void 0) continue
        const T = r(S.input).array,
          R = r(S.output).array
        b = Math.max(b, T[T.length - 1]), x.push({
          node: w.target.node,
          path: _,
          times: T,
          values: R,
        })
      }
      return {
        name: C.name || '',
        duration: b,
        tracks: x,
      }
    }),
    h = (C: RegExp) => l.find((x: any) => C.test(x.name)),
    u = h(/walk/i),
    d = h(/idle_?0?1/i) ?? h(/idle/i),
    p = h(/idle_?0?2/i) ?? d
  if (!u || !d || !p) throw new Error('Camel model has no walk/idle animation')
  const g = [...new Set(l.flatMap((C: any) => C.tracks.map((x: any) => x.node)))] as number[],
    y = new Set(t.skins.flatMap((C: any) => C.joints)),
    v = r(t.skins[0].inverseBindMatrices).array
  function m(C: any, x: string) {
    const b = new Vc({
      color: x,
      roughness: 1,
      bumpMap: C,
      bumpScale: 1.6,
      sheen: 0.8,
      sheenRoughness: 0.75,
      sheenColor: new be('#e8d4b4'),
    }),
      w = b.clone()
    w.color.multiplyScalar(0.86)
    const S = t.nodes.map((Z: any, q: number) => {
      const J = y.has(q) ? new hp() : new Pt()
      return Z.matrix && new Qe().fromArray(Z.matrix).decompose(J.position, J.quaternion, J.scale), Z.translation && J.position.fromArray(Z.translation), Z.rotation && J.quaternion.fromArray(Z.rotation), Z.scale && J.scale.fromArray(Z.scale), J
    })
    t.nodes.forEach((Z: any, q: number) => (Z.children || []).forEach((J: number) => S[q].add(S[J])))
    const _ = new $t()
    for (const Z of t.scenes[t.scene ?? 0].nodes) _.add(S[Z])
    _.updateMatrixWorld(!0)
    const T = t.skins[0],
      R = new THREE.Skeleton(T.joints.map((Z: number) => S[Z]), T.joints.map((Z: number, q: number) => new Qe().fromArray(v as any, q * 16)))
    t.nodes.forEach((Z: any, q: number) => {
      if (Z.mesh === void 0) return
      const {
        g: J,
        material: se,
      } = o[Z.mesh]
      if (/hair/i.test(se)) return
      const Te = new W0(J, /coat/i.test(se) ? w : b)
      Te.castShadow = !0, Te.frustumCulled = !1, S[q].add(Te), Te.bind(R, new Qe())
    })
    const D = g.map(Z => S[Z].quaternion.clone()),
      L = g.map(Z => [S[Z].position.toArray(), S[Z].scale.toArray()]),
      H = new Kn(),
      I = new Kn(),
      O = [0, 0, 0, 0],
      k = [[0, 0, 0], [0, 0, 0]]
    function V(Z: any[]) {
      g.forEach((q, J) => {
        let se = 0
        I.copy(D[J]), k[0] = L[J][0].slice(), k[1] = L[J][1].slice()
        let Te = !0
        for (const He of Z) {
          if (He.weight <= 0.001) continue
          se += He.weight
          const ze = Te ? 1 : He.weight / se
          Te = !1
          for (let Xe = 0; Xe < 3; Xe++) {
            const Q = E.get(He.clip).get(q)?.[Xe],
              te = Xe === 0 ? 4 : 3
            if (Q) Ub(Q.times, Q.values, te, He.time, O); else if (Xe === 0) D[J].toArray(O); else for (let de = 0; de < 3; de++) O[de] = L[J][Xe - 1][de]
            if (Xe === 0) I.slerp(H.fromArray(O), ze); else for (let de = 0; de < 3; de++) k[Xe - 1][de] += (O[de] - k[Xe - 1][de]) * ze
          }
        }
        const Ce = S[q]
        Ce.quaternion.copy(I), Ce.position.fromArray(k[0]), Ce.scale.fromArray(k[1])
      })
    }
    return {
      root: _,
      mat: b,
      coatMat: w,
      pose: V,
    }
  }
  const E = new Map()
  for (const C of l) {
    const x = new Map()
    for (const b of C.tracks) x.has(b.node) || x.set(b.node, []), x.get(b.node)[b.path] = b
    E.set(C, x)
  }
  return {
    instance: m,
    clips: {
      walk: u,
      idle: d,
      rest: p,
    },
    height: Fb,
    stride: Bb,
  }
}

const Ul = [{
  n: 11,
  path: {
    cx: -120,
    cz: -40,
    rx: 190,
    rz: 240,
    alt: 46,
    altAmp: 14,
    speed: 12,
    dir: 1,
    phase: 0.3,
  },
}, {
  n: 8,
  path: {
    cx: 40,
    cz: 20,
    rx: 260,
    rz: 170,
    alt: 62,
    altAmp: 18,
    speed: 13.5,
    dir: -1,
    phase: 2.1,
  },
}, {
  n: 9,
  path: {
    cx: -200,
    cz: -260,
    rx: 150,
    rz: 300,
    alt: 38,
    altAmp: 10,
    speed: 10.5,
    dir: 1,
    phase: 4.2,
  },
}],
  Gd = 3

function Ol(n: any, e: number, t: any) {
  const i = Math.PI * (n.rx + n.rz),
    s = n.phase + n.dir * e * n.speed * Math.PI * 2 / i
  return t.set(n.cx + Math.cos(s) * n.rx + 30 * Math.sin(s * 2.3 + n.phase), n.alt + n.altAmp * Math.sin(s * 1.7 + n.phase * 2), n.cz + Math.sin(s) * n.rz + 25 * Math.cos(s * 3.1 + n.phase)), t
}

function Rb() {
  const n: number[] = [],
    e: number[] = [],
    t = (s: number[], r: number[], a: number[]) => {
      for (const o of [s, r, a]) n.push(o[0], o[1], o[2]), e.push(Math.min(1, Math.abs(o[0]) / 0.9))
    }
  t([0, 0.03, 0.5], [0.07, 0, 0.1], [-0.07, 0, 0.1]), t([0.07, 0, 0.1], [0, 0.02, -0.35], [-0.07, 0, 0.1]), t([0, 0.03, 0.5], [0.03, 0, 0.75], [-0.03, 0, 0.75]), t([0.03, 0, 0.75], [0, 0, 0.95], [-0.03, 0, 0.75]), t([0, 0.01, -0.3], [0.1, 0, -0.55], [-0.1, 0, -0.55])
  for (const s of [-1, 1]) t([0, 0, 0.18], [s * 0.45, 0, 0.16], [0, 0, -0.16]), t([s * 0.45, 0, 0.16], [s * 0.45, 0, -0.14], [0, 0, -0.16]), t([s * 0.45, 0, 0.16], [s * 0.9, 0, 0.02], [s * 0.45, 0, -0.14]), t([s * 0.9, 0, 0.02], [s * 0.95, 0, -0.1], [s * 0.45, 0, -0.14])
  const i = new Ct()
  return i.setAttribute('position', new Je(n, 3)), i.setAttribute('aWing', new Je(e, 1)), i.computeVertexNormals(), i
}

function Pb() {
  const n = Ul.reduce((C, x) => C + x.n, 0) + Gd,
    e = new qt({
      color: '#4a4038',
      roughness: 0.85,
      side: dn,
    }),
    t = {
      value: 0,
    }
  e.onBeforeCompile = (C: any) => {
    C.uniforms.uTime = t, C.vertexShader = C.vertexShader.replace('#include <common>', `#include <common>
attribute float aWing;
attribute vec2 aFlap;
uniform float uTime;`).replace('#include <begin_vertex>', `#include <begin_vertex>
        // Downstroke leads at the shoulder, the outer wing follows a little later.
        float eco3b = sin(uTime * 8.5 + aFlap.x - aWing * 0.9);
        float eco3amp = aFlap.y;
        transformed.y += (eco3b * eco3amp * 0.55 + 0.08) * aWing;
        transformed.x *= 1.0 - 0.18 * aWing * max(0.0, -eco3b) * eco3amp;`)
  }
  const i = Rb(),
    s = new Hc(new Float32Array(n * 2), 2)
  i.setAttribute('aFlap', s)
  const r = new Er(i, e, n)
  r.frustumCulled = !1, r.castShadow = !1
  let a = 0
  const o: any[] = [],
    c = new P()
  Ul.forEach((C, x) => {
    Ol(C.path, 0, c)
    for (let b = 0; b < C.n; b++) {
      const w = Math.ceil(b / 2),
        S = b % 2 ? 1 : -1,
        _ = new P(S * w * 2.4, -w * 0.25, -w * 2.2)
      o.push({
        p: c.clone().add(new P(S * w * 3, 0, w * 3)),
        v: new P(0, 0, 12),
        flock: x,
        slot: _,
        roll: 0,
        flap: 1,
        seed: (b * 7.13 + x) % 6.28,
      })
    }
  })
  for (let C = 0; C < Gd; C++) o.push({
    p: new P(-170 + C * 15, 30 + C * 6, -40 - C * 60),
    v: new P(9, 0, 0),
    flock: -1 - C,
    slot: new P(),
    roll: 0,
    flap: 0.2,
    seed: C * 2.1,
  })
  o.forEach((C, x) => s.setX(x, C.seed))
  const l = new Pt(),
    h = new P(),
    u = new P(),
    d = new P(),
    p = new P(),
    g = new P(),
    y = new P(),
    v = new P(),
    m = new gi()
  function E(C: number) {
    a += C, o.forEach((x, b) => {
      if (h.set(0, 0, 0), x.flock >= 0) {
        const I = Ul[x.flock].path
        Ol(I, a, c), Ol(I, a + 0.5, d), p.copy(d).sub(c).normalize()
        const O = Math.atan2(p.x, p.z)
        u.copy(x.slot).applyAxisAngle(new P(0, 1, 0), O).add(c), u.y += Math.sin(a * 0.6 + x.seed) * 1.2, h.addScaledVector(u.sub(x.p), 0.9), g.set(0, 0, 0), y.set(0, 0, 0), v.set(0, 0, 0)
        let k = 0
        for (const V of o) {
          if (V === x || V.flock !== x.flock) continue
          const Z = x.p.distanceTo(V.p)
          Z > 14 || (k++, g.add(V.v), y.add(V.p), Z < 2.6 && v.add(u.copy(x.p).sub(V.p).multiplyScalar((2.6 - Z) / Math.max(Z, 0.1))))
        }
        k && (h.addScaledVector(g.multiplyScalar(1 / k).sub(x.v), 0.5), h.addScaledVector(y.multiplyScalar(1 / k).sub(x.p), 0.15)), h.addScaledVector(v, 6)
      } else {
        const I = -1 - x.flock,
          k = u.set(-170 + 20 * Math.sin(a * 0.03 + I), 32 + I * 7, -60 - I * 70 + 40 * Math.sin(a * 0.02 + I * 2)).sub(x.p),
          V = new P(-k.z, 0, k.x).normalize().multiplyScalar(I % 2 ? 9 : -9)
        h.addScaledVector(V.sub(x.v), 0.8).addScaledVector(k, 0.02 * Math.max(0, k.length() - 22) / 22)
      }
      h.clampLength(0, 18)
      const w = Math.atan2(x.v.x, x.v.z)
      x.v.addScaledVector(h, C)
      const S = x.v.length(),
        _ = x.flock >= 0 ? 9 : 7,
        T = x.flock >= 0 ? 15 : 10
      S < _ && x.v.multiplyScalar(_ / S), S > T && x.v.multiplyScalar(T / S), x.p.addScaledVector(x.v, C)
      let R = Math.atan2(x.v.x, x.v.z) - w
      R = Math.atan2(Math.sin(R), Math.cos(R))
      const D = Math.max(-0.9, Math.min(0.9, -R / Math.max(C, 0.001) * 0.9))
      x.roll += (D - x.roll) * Math.min(1, C * 3)
      const L = x.v.y / Math.max(1, x.v.length()),
        H = x.flock >= 0 ? Math.min(1, Math.max(0.05, 0.25 + L * 4 + Math.pow(Math.max(0, Math.sin(a * 0.45 + x.seed)), 3) * 0.9)) : 0.06 + 0.9 * Math.pow(Math.max(0, Math.sin(a * 0.3 + x.seed)), 12)
      x.flap += (H - x.flap) * Math.min(1, C * 2), s.setY(b, x.flap)
    })
  }
  return {
    mesh: r,
    positionOf: (C: number) => o[C].p.clone(),
    update(C: number, x: number) {
      t.value += C, r.visible = x > 0.05
      let b = Math.min(C, 0.25)
      for (; b > 0;) {
        const w = Math.min(b, 0.03333333333333333)
        E(w), b -= w
      }
      r.visible && (o.forEach((w, S) => {
        l.position.copy(w.p)
        const _ = Math.atan2(w.v.x, w.v.z),
          T = -Math.asin(Math.max(-1, Math.min(1, w.v.y / Math.max(0.001, w.v.length()))))
        m.set(T, _, w.roll, 'YXZ'), l.quaternion.setFromEuler(m), l.scale.setScalar((w.flock >= 0 ? 1.9 : 2.3) * Math.max(0.001, x)), l.updateMatrix(), r.setMatrixAt(S, l.matrix)
      }), r.instanceMatrix.needsUpdate = !0, s.needsUpdate = !0)
    },
  }
}

let li: any = null

function Pp() {
  if (li) return li
  const n = 256,
    e = document.createElement('canvas')
  e.width = e.height = n
  const t = e.getContext('2d')!
  t.fillStyle = '#808080', t.fillRect(0, 0, n, n)
  let i = 23
  const s = () => (i = i * 16807 % 2147483647) / 2147483647
  t.lineCap = 'round'
  for (let r = 0; r < 9e3; r++) {
    const a = s() * n,
      o = s() * n,
      c = 2 + s() * 5,
      l = Math.PI / 2 + (s() - 0.5) * 0.6,
      h = Math.floor(70 + s() * 130)
    t.strokeStyle = `rgba(${h},${h},${h},0.55)`, t.lineWidth = 0.6 + s() * 0.8, t.beginPath(), t.moveTo(a, o), t.lineTo(a + Math.cos(l) * c, o + Math.sin(l) * c), t.stroke()
  }
  return li = new Zn(e), li.wrapS = li.wrapT = In, li.repeat.set(6, 6), li
}

function QS() {
  const i = document.createElement('canvas')
  i.width = 512, i.height = 640
  const s = i.getContext('2d')!
  s.fillStyle = '#000', s.fillRect(0, 0, 512, 640), s.strokeStyle = '#fff', s.fillStyle = '#fff', s.lineWidth = 5, s.lineCap = 'round', s.lineJoin = 'round'
  let r = 7
  const a = () => (r = r * 16807 % 2147483647) / 2147483647,
    o = [(l: number, h: number, u: number) => {
      s.beginPath(), s.arc(l, h, u * 0.42, 0, Math.PI * 2), s.stroke(), s.beginPath(), s.arc(l, h, u * 0.1, 0, Math.PI * 2), s.fill()
    }, (l: number, h: number, u: number) => {
      s.beginPath(), s.moveTo(l - u * 0.5, h), s.quadraticCurveTo(l, h - u * 0.45, l + u * 0.5, h), s.quadraticCurveTo(l, h + u * 0.35, l - u * 0.5, h), s.stroke(), s.beginPath(), s.arc(l, h, u * 0.12, 0, Math.PI * 2), s.fill(), s.beginPath(), s.moveTo(l - u * 0.1, h + u * 0.2), s.lineTo(l - u * 0.2, h + u * 0.45), s.stroke()
    }, (l: number, h: number, u: number) => {
      s.beginPath(), s.ellipse(l, h - u * 0.25, u * 0.16, u * 0.2, 0, 0, Math.PI * 2), s.stroke(), s.beginPath(), s.moveTo(l, h - u * 0.05), s.lineTo(l, h + u * 0.5), s.moveTo(l - u * 0.3, h + u * 0.05), s.lineTo(l + u * 0.3, h + u * 0.05), s.stroke()
    }, (l: number, h: number, u: number) => {
      s.beginPath()
      for (let d = 0; d <= 6; d++) s.lineTo(l - u * 0.45 + d * u * 0.9 / 6, h + (d % 2 ? -1 : 1) * u * 0.12)
      s.stroke()
    }, (l: number, h: number, u: number) => {
      s.beginPath(), s.moveTo(l - u * 0.45, h - u * 0.3), s.lineTo(l - u * 0.1, h - u * 0.3), s.lineTo(l + u * 0.15, h), s.lineTo(l + u * 0.45, h), s.stroke(), s.beginPath(), s.arc(l + u * 0.45, h, u * 0.08, 0, Math.PI * 2), s.fill(), s.beginPath(), s.moveTo(l - u * 0.45, h + u * 0.3), s.lineTo(l + u * 0.2, h + u * 0.3), s.stroke()
    }, (l: number, h: number, u: number) => {
      for (let d = -1; d <= 1; d++) s.beginPath(), s.moveTo(l + d * u * 0.22, h + u * 0.4), s.lineTo(l + d * u * 0.22, h - u * 0.3), s.stroke()
      s.beginPath(), s.arc(l, h - u * 0.38, u * 0.1, 0, Math.PI * 2), s.stroke()
    }]
  for (let l = 0; l < 4; l++) {
    const h = l * 128
    s.globalAlpha = 0.55, s.fillRect(h + 10, 0, 3, 640), s.fillRect(h + 128 - 13, 0, 3, 640), s.globalAlpha = 1
    const u = 128 * 0.55
    for (let d = 70; d < 600; d += u * 1.25) o[Math.floor(a() * o.length)](h + 128 / 2, d, u)
  }
  const c = new Zn(i)
  return c.colorSpace = Lt, c.anisotropy = 4, c
}

function Wd(n: number) {
  const e = Math.cos(n),
    t = Math.sin(n),
    i = -0.35,
    s = Math.hypot(e, t, i)
  return [e / s, t / s, i / s]
}

function Xd(n: number, e?: any) {
  const t = (n % 24 + 24) % 24
  let i = 0
  for (; i < za.length - 2 && za[i + 1].h <= t;) i++
  const s = za[i],
    r = za[i + 1],
    a = r.h === s.h ? 0 : (t - s.h) / (r.h - s.h),
    o = (h: number, u: number) => h + (u - h) * a,
    c = e ?? {
      top: new be(),
      hor: new be(),
      sunCol: new be(),
      hemi: 0,
      sun: 0,
      neon: 1,
      stars: 0,
      sunDir: [0, 1, 0],
      moonDir: [0, -1, 0],
    }
  c.top.lerpColors(s.topC, r.topC, a), c.hor.lerpColors(s.horC, r.horC, a), c.sunCol.lerpColors(s.sunC, r.sunC, a), c.hemi = o(s.hemi, r.hemi), c.sun = o(s.sun, r.sun), c.neon = o(s.neon, r.neon), c.stars = o(s.stars, r.stars)
  const l = (t - 6) / 12 * Math.PI
  return c.sunDir = Wd(l), c.moonDir = Wd(l + Math.PI), c
}

let eo: any = null

function ab() {
  eo?.map.dispose(), eo?.bump.dispose(), eo = null
}

function _b() {
  const t = document.createElement('canvas')
  t.width = t.height = 128
  const i = t.getContext('2d')!,
    s = i.createRadialGradient(64, 64, 0, 64, 64, 64)
  s.addColorStop(0, 'rgba(255,255,255,0.5)'), s.addColorStop(0.3, 'rgba(255,255,255,0.12)'), s.addColorStop(1, 'rgba(255,255,255,0)'), i.fillStyle = s, i.fillRect(0, 0, 128, 128)
  const r = new Zn(t)
  return r.colorSpace = Lt, r
}

function vb() {
  const e = document.createElement('canvas')
  e.width = 256 * 2, e.height = 256
  const t = e.getContext('2d')!
  t.fillStyle = '#bfc0c4', t.fillRect(0, 0, 256 * 2, 256)
  for (let s = 0; s < 60; s++) t.fillStyle = `rgba(80,82,90,${0.08 + di(s, 3) * 0.2})`, t.beginPath(), t.arc(di(s, 1) * 256 * 2, di(s, 2) * 256, 4 + di(s, 4) * 40, 0, Math.PI * 2), t.fill()
  const i = new Zn(e)
  return i.colorSpace = Lt, i
}

function bb(n: number) {
  const e = new $t(),
    t = _b(),
    i = vb(),
    s = new Hn({
      map: i,
      fog: !1,
    }),
    r = new et(new Ws(1, 48, 24), s)
  r.scale.setScalar(Mr * 0.92 * Math.tan(Math.PI / 180 * 0.9)), r.renderOrder = -1
  const a = new H0(new lp({
    map: t,
    fog: !1,
    depthWrite: !1,
    transparent: !0,
    blending: $i,
  }))
  a.scale.setScalar(r.scale.x * 9), a.renderOrder = -1, e.add(a, r)
  let o = 11
  const c = () => (o = o * 16807 % 2147483647) / 2147483647,
    l: number[] = [],
    h: number[] = [],
    u: number[] = [],
    d: number[] = []
  for (let v = 0; v < 5200; v++) {
    const m = c() * Math.PI * 2,
      E = 0.02 + Math.pow(c(), 0.8) * 0.98,
      C = Math.sqrt(1 - E * E)
    l.push(Math.cos(m) * C * Mr * 0.97, E * Mr * 0.97, Math.sin(m) * C * Mr * 0.97)
    const x = Math.pow(c(), 4)
    h.push(1.5 + x * 3.2), u.push(0.55 + x * 1.5), d.push(c())
  }
  const p = new Ct()
  p.setAttribute('position', new Je(l, 3)), p.setAttribute('aSize', new Je(h, 1)), p.setAttribute('aBright', new Je(u, 1)), p.setAttribute('aPhase', new Je(d, 1))
  const g = new kt({
    vertexShader: Mb,
    fragmentShader: Sb,
    transparent: !0,
    depthWrite: !1,
    blending: $i,
    uniforms: {
      uTime: {
        value: 0,
      },
      uOpacity: {
        value: 1,
      },
      uPr: {
        value: n,
      },
    },
  }),
    y = new K0(p, g)
  return y.renderOrder = -1, y.frustumCulled = !1, e.add(y), {
    group: e,
    moon: r,
    moonMat: s,
    moonHalo: a,
    stars: y,
    starMat: g,
    textures: [t, i],
    useMoonTexture(v: any) {
      v.colorSpace = Lt, s.map = v, s.needsUpdate = !0
    },
  }
}

const zi = (n: number, e: number, t: number, i: number, s: number, r: number, a = 0) => {
  const o = new Ws(1, 16, 12)
  return o.scale(n, e, t), a && o.rotateX(a), o.translate(i, s, r)
}

function cb() {
  const n = new Po([new P(0, 1.82, 0.62), new P(0, 1.68, 1.02), new P(0, 1.8, 1.32), new P(0, 2.2, 1.5), new P(0, 2.5, 1.56)]),
    e: any = new Do(n, 14, 0.135, 8, !1)
  {
    const o = e.attributes.position,
      c = new P(),
      l = new P()
    for (let h = 0; h < o.count; h++) {
      const u = Math.floor(h / 9) / 14
      n.getPointAt(u, l), c.fromBufferAttribute(o, h).sub(l).multiplyScalar(1.35 - 0.55 * u).add(l), o.setXYZ(h, c.x, c.y, c.z)
    }
    e.computeVertexNormals()
  }
  const t = (o: number) => new Qi(0.035, 0.11, 5).rotateX(-0.3).translate(o, 2.68, 1.58),
    i = new rn(0.025, 0.015, 0.55, 5).translate(0, -0.27, 0).rotateX(0.25).translate(0, 1.82, -0.98),
    s = kr([zi(0.44, 0.44, 0.86, 0, 1.72, 0), zi(0.4, 0.46, 0.44, 0, 1.68, 0.5), zi(0.38, 0.4, 0.42, 0, 1.76, -0.6), zi(0.34, 0.44, 0.5, 0, 2.08, -0.06), e, zi(0.105, 0.125, 0.3, 0, 2.58, 1.72, 0.42), zi(0.08, 0.095, 0.15, 0, 2.45, 1.97, 0.3), zi(0.06, 0.04, 0.1, 0, 2.38, 1.98), t(0.075), t(-0.075), i].map((o: any) => o.index ? o.toNonIndexed() : o))!
  {
    const o = s.attributes.position,
      c = []
    for (let l = 0; l < o.count; l++) {
      const h = o.getX(l),
        u = o.getY(l),
        d = o.getZ(l),
        p = Math.min(1, Math.max(0, (u - 1.75) / 0.7)),
        g = Math.min(1, Math.max(0, (1.55 - u) / 0.3)),
        y = 0.93 + 0.14 * Math.abs(Math.sin(h * 23.1 + u * 17.3 + d * 11.7)),
        v = (1 - 0.2 * p + 0.16 * g) * y
      c.push(v, v * (0.98 - 0.03 * p), v * (0.95 - 0.06 * p))
    }
    s.setAttribute('color', new Je(c, 3))
  }
  const r = new rn(0.475, 0.475, 0.62, 18, 1, !0, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 1.74, 0.38),
    a = new rn(0.485, 0.485, 0.06, 18, 1, !0, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 1.74, 0.08)
  return {
    hide: s,
    cloth: kr([r, a].map(o => o.toNonIndexed()))!,
    thigh: new rn(0.14, 0.09, 0.78, 8).translate(0, -0.39, 0),
    hindThigh: new rn(0.2, 0.1, 0.78, 8).translate(0, -0.39, 0),
    shin: new rn(0.078, 0.06, 0.7, 7).translate(0, -0.35, 0),
    knee: new Ws(0.085, 8, 6).scale(1, 1.3, 1),
    pad: new rn(0.075, 0.1, 0.05, 9).translate(0, -0.72, 0),
  }
}

function db() {
  li?.dispose(), li = null
}

const hb = 1.55,
  ub = 2 * 1.5 * Math.sin(0.34) * 2,
  Ba = ['#c7ab88', '#b99a74', '#d2b896', '#ad8b66', '#cbb08c', '#bd9f7b']

function fb(n: any, e = 0) {
  const t = Pp(),
    i = new Vc({
      color: Ba[e % Ba.length],
      roughness: 1,
      vertexColors: !0,
      bumpMap: t,
      bumpScale: 2.2,
      sheen: 0.8,
      sheenRoughness: 0.75,
      sheenColor: new be('#e8d4b4'),
    }),
    s = new Vc({
      color: new be(Ba[e % Ba.length]).multiplyScalar(0.9),
      roughness: 1,
      bumpMap: t,
      bumpScale: 1.6,
      sheen: 0.6,
      sheenRoughness: 0.8,
      sheenColor: new be('#e0caa6'),
    }),
    r = new qt({
      color: '#1f3f73',
      roughness: 0.7,
      side: dn,
      emissive: '#e2b04a',
      emissiveIntensity: 0,
    }),
    a = new $t(),
    o = new $t(),
    c = new et(n.hide, i)
  c.castShadow = !0
  const l = new et(n.cloth, r)
  l.castShadow = !0, o.add(c, l)
  const h = []
  for (const u of [!0, !1]) for (const d of [!0, !1]) {
    const p = new $t()
    p.position.set(d ? 0.22 : -0.22, hb, u ? 0.52 : -0.6)
    const g = new et(u ? n.thigh : n.hindThigh, s),
      y = new $t()
    y.position.y = -0.78
    const v = new et(n.knee, s),
      m = new et(n.shin, s),
      E = new et(n.pad, s)
    for (const C of [g, v, m, E]) C.castShadow = !0
    y.add(v, m, E), p.add(g, y), o.add(p), h.push({
      hip: p,
      knee: y,
      front: u,
      left: d,
    })
  }
  return a.add(o), {
    group: a,
    body: o,
    legs: h,
    mat: i,
    legMat: s,
  }
}

function jS() {
  const n = document.createElement('canvas')
  n.width = n.height = 128
  const e = n.getContext('2d')!,
    t = e.createRadialGradient(64, 64, 0, 64, 64, 64)
  t.addColorStop(0, 'rgba(255,255,255,1)'), t.addColorStop(0.35, 'rgba(255,255,255,0.45)'), t.addColorStop(1, 'rgba(255,255,255,0)'), e.fillStyle = t, e.fillRect(0, 0, 128, 128)
  const i = new Zn(n)
  return i.colorSpace = Lt, i
}

function Cp(n: string) {
  const t = () => {
    const u = document.createElement('canvas')
    return u.width = u.height = 512, [u, u.getContext('2d')!] as const
  },
    [i, s] = t(),
    [r, a] = t()
  let o = n === 'limestone' ? 3 : 19
  const c = () => (o = o * 16807 % 2147483647) / 2147483647
  s.fillStyle = n === 'limestone' ? '#d6bf95' : '#a08c7f', s.fillRect(0, 0, 512, 512), a.fillStyle = '#808080', a.fillRect(0, 0, 512, 512)
  for (let u = 0; u < (n === 'limestone' ? 9e3 : 16e3); u++) {
    const d = c() * 512,
      p = c() * 512,
      g = c() * (n === 'limestone' ? 3 : 2) + 0.5,
      y = c()
    s.fillStyle = n === 'limestone' ? `rgba(${y > 0.5 ? '245,228,196' : '120,92,58'},${0.08 + c() * 0.12})` : `rgba(${y > 0.6 ? '226,206,196' : y > 0.25 ? '40,32,30' : '150,110,96'},${0.25 + c() * 0.3})`, s.fillRect(d, p, g, g), a.fillStyle = `rgba(${y > 0.5 ? 255 : 0},${y > 0.5 ? 255 : 0},${y > 0.5 ? 255 : 0},0.12)`, a.fillRect(d, p, g, g)
  }
  for (let u = 0; u < 14; u++) {
    const d = c() * 512,
      p = 6 + c() * 30,
      g = s.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, 'rgba(70,52,34,0)'), g.addColorStop(0.5 + c() * 0.4, `rgba(70,52,34,${0.08 + c() * 0.08})`), g.addColorStop(1, 'rgba(70,52,34,0)'), s.fillStyle = g, s.fillRect(d, 0, p, 512)
  }
  if (n === 'limestone') {
    s.strokeStyle = 'rgba(92,70,44,0.55)', a.strokeStyle = '#000'
    for (const p of [s, a]) {
      p.lineWidth = p === s ? 2.5 : 4
      for (let g = 0; g < 4; g++) {
        p.beginPath(), p.moveTo(0, g * 128 + 1), p.lineTo(512, g * 128 + 1)
        for (let y = 0; y < 8; y++) {
          const v = y * 64 + g % 2 * 64 * 0.5 + ((y * 7 + g * 3) % 5 - 2) * 3
          p.moveTo(v, g * 128), p.lineTo(v, g * 128 + 128)
        }
        p.stroke()
      }
    }
  }
  const l = new Zn(i)
  l.colorSpace = Lt
  const h = new Zn(r)
  for (const u of [l, h]) u.wrapS = u.wrapT = In, u.anisotropy = 8
  return {
    map: l,
    bump: h,
  }
}

function rb() {
  return eo ?? (eo = Cp('granite'))
}

function lb(n: any, e: any, t: any) {
  const i = new $t(),
    {
      map: s,
      bump: r,
    } = rb(),
    a = new et(n.plinth, e)
  a.castShadow = a.receiveShadow = !0
  const o = new qt({
    map: s,
    bumpMap: r,
    bumpScale: 1.2,
    roughness: 0.78,
    metalness: 0.05,
    emissive: '#ffffff',
    emissiveMap: t,
    emissiveIntensity: 1,
  }),
    c = new et(n.shaft, o)
  c.position.y = 0.65 + 3.4, c.castShadow = c.receiveShadow = !0
  const l = new qt({
    color: '#d9b25c',
    metalness: 0.9,
    roughness: 0.25,
    emissive: '#ffffff',
    emissiveIntensity: 2,
  }),
    h = new et(n.apex, l)
  return h.position.y = 0.65 + 6.8 + 0.4, h.castShadow = !0, i.add(a, c, h), {
    group: i,
    shaftMat: o,
    apexMat: l,
  }
}

const Ps = 34,
  eb = Math.tan(51.84 * Math.PI / 180),
  $c = -3,
  _o = Ps * eb,
  Us = 0.93,
  Fh = $c + _o * Us,
  Rp = _o * (1 - Us),
  Il = Ps * (1 - Us),
  ws = Fh + Rp / 2 + 0.8,
  Oa = 2.6

function nb() {
  const n = new $t(),
    e = new qt({
      color: '#c9a04a',
      metalness: 0.9,
      roughness: 0.2,
      emissive: '#ffffff',
      emissiveIntensity: 2,
    }),
    t = new et(new Qi(Il * Math.SQRT2, Rp, 4).rotateY(Math.PI / 4), e)
  t.castShadow = !0, n.add(t)
  const i = new Hn({
    color: '#ffffff',
    transparent: !0,
    opacity: 0.55,
    depthWrite: !1,
  }),
    s = new et(new Lh(Il * 1.9, Il * 2, 64), i)
  return s.rotation.x = -Math.PI / 2, s.position.y = Fh + 0.04, {
    capstone: n,
    mat: e,
    ring: s,
    ringMat: i,
  }
}

function ob(n: any[], e: any, t: any, i: any) {
  for (const s of [e, t, i]) s.wrapS = s.wrapT = In, s.repeat.set(1, 3.2), s.anisotropy = 8
  e.colorSpace = Lt
  for (const s of n) s.map = e, s.bumpMap = null, s.normalMap = t, s.roughnessMap = i, s.roughness = 1, s.color.set('#d2c2b6'), s.needsUpdate = !0
}

function pb(n: any, e: string, t: number, i: number) {
  const s = e === 'kneel',
    r = e === 'walk',
    a = s ? -1.12 : r ? Math.abs(Math.cos(t)) * 0.05 : 0
  n.body.position.y += (a - n.body.position.y) * i, n.body.rotation.z += ((r ? Math.sin(t) * 0.035 : 0) - n.body.rotation.z) * i, n.body.rotation.x += ((s ? 0.04 : 0) - n.body.rotation.x) * i
  for (const o of n.legs) {
    const c = t + (o.left ? 0 : Math.PI)
    let l = 0,
      h = 0
    r ? (l = -Math.sin(c) * 0.34, h = Math.max(0, Math.cos(c)) * (o.front ? 0.55 : -0.5)) : s && (l = o.front ? -1.45 : 1.3, h = o.front ? 2.75 : -2.6), o.hip.rotation.x += (l - o.hip.rotation.x) * (r ? 1 : i), o.knee.rotation.x += (h - o.knee.rotation.x) * (r ? 1 : i)
  }
}

function sb() {
  const n = new rn(0.46, 0.76, 6.8, 4, 1).rotateY(Math.PI / 4),
    e = new Qi(0.46, 0.8, 4).rotateY(Math.PI / 4),
    t = kr([new En(2.3, 0.35, 2.3).translate(0, 0.175, 0), new En(1.8, 0.3, 1.8).translate(0, 0.5, 0)])!
  return {
    shaft: n,
    apex: e,
    plinth: t,
  }
}

function Fa(n: number, e: number) {
  const t = Math.sin(n * 127.1 + e * 311.7) * 43758.5453
  return t - Math.floor(t)
}

function Fd(n: number, e: number) {
  const t = Math.floor(n),
    i = Math.floor(e),
    s = n - t,
    r = e - i,
    a = s * s * (3 - 2 * s),
    o = r * r * (3 - 2 * r),
    c = Fa(t, i),
    l = Fa(t + 1, i),
    h = Fa(t, i + 1),
    u = Fa(t + 1, i + 1)
  return c + (l - c) * a + (h - c) * o + (c - l - h + u) * a * o
}

function tb() {
  const n: number[] = [],
    e: number[] = [],
    t: number[] = [],
    i: number[] = [],
    a = Ps * (1 - Us),
    o = Math.hypot(Ps - a, _o * Us),
    c = new be('#b48d5e'),
    l = new be('#ffffff'),
    h = new be(),
    u = [[-1, 1], [1, 1], [1, -1], [-1, -1]]
  for (let E = 0; E < 4; E++) {
    const [C, x] = u[E],
      [b, w] = u[(E + 1) % 4],
      S = n.length / 3
    for (let _ = 0; _ <= 24; _++) {
      const T = _ / 24,
        R = Ps + (a - Ps) * T,
        D = $c + _o * Us * T
      for (let L = 0; L <= 24; L++) {
        const H = L / 24,
          I = (C + (b - C) * H) * R,
          O = (x + (w - x) * H) * R
        n.push(I, D, O), e.push(((H - 0.5) * 2 * R + E * 37) / Oa, T * o / Oa)
        const k = 0.82 + 0.22 * Fd(I / 6 + E * 9, D / 4) + 0.06 * Fd(I / 1.7, D / 1.3)
        h.lerpColors(c, l, 0.35 + 0.65 * Math.min(1, Math.max(0, (D - $c - 1) / 9))), h.multiplyScalar(k * (0.94 + 0.08 * T)), t.push(h.r, h.g, h.b)
      }
    }
    for (let _ = 0; _ < 24; _++) for (let T = 0; T < 24; T++) {
      const R = S + _ * 25 + T,
        D = R + 1,
        L = R + 24 + 1,
        H = L + 1
      i.push(R, D, L, D, H, L)
    }
  }
  const d = n.length / 3
  for (const [E, C] of u) n.push(E * a, Fh, C * a), e.push(E * a / Oa, C * a / Oa), t.push(0.95, 0.95, 0.95)
  i.push(d, d + 1, d + 2, d, d + 2, d + 3)
  const p = new Ct()
  p.setAttribute('position', new Je(n, 3)), p.setAttribute('uv', new Je(e, 2)), p.setAttribute('color', new Je(t, 3)), p.setIndex(i), p.computeVertexNormals()
  const g = Cp('limestone')
  g.map.repeat.set(1, 1), g.bump.repeat.set(1, 1)
  const y = new qt({
    vertexColors: !0,
    map: g.map,
    bumpMap: g.bump,
    bumpScale: 1.2,
    roughness: 0.9,
    metalness: 0,
  }),
    v = new et(p, y)
  v.castShadow = v.receiveShadow = !0
  const m = new $t()
  return m.add(v), {
    group: m,
    mat: y,
    textures: [g.map, g.bump],
    usePbr(E: any, C: any, x: any) {
      for (const b of [E, C, x]) b.wrapS = b.wrapT = In, b.anisotropy = 8
      E.colorSpace = Lt, y.map = E, y.bumpMap = null, y.normalMap = C, y.normalScale.set(0.38, 0.38), y.roughnessMap = x, y.roughness = 1, y.color.setRGB(2.35, 1.95, 1.4), y.needsUpdate = !0
    },
  }
}

function gb() {
  const e = new Float32Array(65536)
  for (let a = 0; a < 256; a++) for (let o = 0; o < 256; o++) {
    const c = o / 256,
      l = a / 256,
      h = 0.06 * Math.sin(c * Math.PI * 4 + 1.7) + 0.03 * Math.sin(c * Math.PI * 10)
    e[a * 256 + o] = Math.sin((l + h) * Math.PI * 18) * 0.6 + (di(o, a) - 0.5) * 0.35
  }
  const t = document.createElement('canvas')
  t.width = t.height = 256
  const i = t.getContext('2d')!,
    s = i.createImageData(256, 256)
  for (let a = 0; a < 256; a++) for (let o = 0; o < 256; o++) {
    const c = (p: number, g: number) => e[(g + 256) % 256 * 256 + (p + 256) % 256],
      l = (c(o + 1, a) - c(o - 1, a)) * 0.9,
      h = (c(o, a + 1) - c(o, a - 1)) * 0.9,
      u = Math.hypot(l, h, 1),
      d = (a * 256 + o) * 4
    s.data[d] = (-l / u * 0.5 + 0.5) * 255, s.data[d + 1] = (-h / u * 0.5 + 0.5) * 255, s.data[d + 2] = (1 / u * 0.5 + 0.5) * 255, s.data[d + 3] = 255
  }
  i.putImageData(s, 0, 0)
  const r = new Zn(t)
  return r.wrapS = r.wrapT = In, r.anisotropy = 8, r
}

const kd = 3200

function xb() {
  const e: number[] = []
  for (let _ = 0.8; _ < kd; _ = _ * 1.04 + 0.7) e.push(_)
  e.push(kd)
  const t: number[] = [],
    i: number[] = [],
    s: number[] = [],
    r: number[] = [],
    a = new be('#c8b08f'),
    o = new be('#dccaa9'),
    c = new be('#ede2cb'),
    l = new be(),
    h = new be('#5f7a34'),
    u = new be('#86913f'),
    d = new be('#4e3d2b'),
    p = new be('#8c7350'),
    g = new be(),
    y = (_: number, T: number) => {
      const R = Dp(_, T),
        D = Os(_, T, R)
      t.push(_, D, T), i.push(_ / 3.5, T / 3.5)
      const L = Lp(_, T)
      L < 0.6 ? l.lerpColors(a, o, Math.max(0, (L - 0.15) / 0.45)) : l.lerpColors(o, c, Math.min(1, (L - 0.6) / 0.7)), l.multiplyScalar(0.94 + 0.12 * Vn(_ / 23, T / 23))
      const H = R.d - R.hw,
        I = 22 + 26 * Vn(_ / 70, T / 70),
        O = (1 - wi(I * 0.5, I, H)) * wi(-2, 6, H)
      O > 0 && (g.lerpColors(h, u, Vn(_ / 18, T / 18)), l.lerp(g, O * (0.55 + 0.45 * Vn(_ / 9 + 4, T / 9)))), l.lerp(d, 1 - wi(-3, 7, H)), l.lerp(p, 1 - wi(-14, -3, H)), s.push(l.r, l.g, l.b)
    }
  y(0, 0)
  for (const _ of e) for (let T = 0; T < 220; T++) y(Math.cos(T / 220 * Math.PI * 2) * _, Math.sin(T / 220 * Math.PI * 2) * _)
  for (let _ = 0; _ < 220; _++) r.push(0, 1 + (_ + 1) % 220, 1 + _)
  for (let _ = 0; _ < e.length - 1; _++) {
    const T = 1 + _ * 220,
      R = 1 + (_ + 1) * 220
    for (let D = 0; D < 220; D++) {
      const L = (D + 1) % 220
      r.push(T + D, T + L, R + D, T + L, R + L, R + D)
    }
  }
  const v = new Ct()
  v.setAttribute('position', new Je(t, 3)), v.setAttribute('uv', new Je(i, 2)), v.setAttribute('color', new Je(s, 3)), v.setIndex(r), v.computeVertexNormals()
  const m = gb(),
    E = new qt({
      vertexColors: !0,
      roughness: 0.92,
      metalness: 0,
      normalMap: m,
      normalScale: new ue(0.5, 0.5),
    }),
    C = {
      value: 0,
    }
  E.onBeforeCompile = (_: any) => {
    _.uniforms.eco3Desat = C, _.fragmentShader = _.fragmentShader.replace('#include <common>', `#include <common>
        uniform float eco3Desat;
        float eco3n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453), b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5453);
          float c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5453), d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5453);
          return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
        vec2 eco3rot(vec2 u){ return mat2(0.8,-0.6,0.6,0.8) * u * 0.37 + vec2(0.31, 0.77); }`).replace('#include <map_fragment>', `#ifdef USE_MAP
          float eco3k = smoothstep(0.3, 0.7, eco3n(vMapUv * 0.05));
          vec4 eco3a = texture2D(map, vMapUv), eco3b = texture2D(map, eco3rot(vMapUv));
          vec4 sampledDiffuseColor = mix(eco3a, eco3b, eco3k);
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), eco3Desat);
          diffuseColor *= sampledDiffuseColor;
        #endif`)
  }
  const x = new et(v, E)
  x.receiveShadow = !0
  let b = !1,
    w = 0
  const S = () => {
    const _ = b ? [1.25, 1.18, 1.08] : [1, 1, 1],
      T = b ? [1.52, 1.5, 1.5] : [0.98, 0.99, 1.02]
    E.color.setRGB(...(_.map((R, D) => R + (T[D] - R) * w) as [number, number, number])), C.value = b ? 0.75 * w : 0
  }
  return {
    mesh: x,
    mat: E,
    textures: [m],
    usePbr(_: any, T: any, R: any) {
      for (const D of [_, T, R]) D.wrapS = D.wrapT = In, D.anisotropy = 8
      _.colorSpace = Lt, E.map = _, E.normalMap = T, E.normalScale.set(0.6, 0.6), E.roughnessMap = R, E.roughness = 1, b = !0, S(), E.needsUpdate = !0
    },
    setNoon(_: number) {
      Math.abs(_ - w) < 0.005 || (w = _, S())
    },
  }
}

function yb(n: number, e: any) {
  const t = new $t()
  for (const [i, s, r] of [[0.33, 1150, 95], [0.39, 1300, 70], [0.28, 1500, 60]]) {
    const a = r / 0.898,
      o = new et(new Qi(a, r, 4, 1).rotateY(Math.PI / 4), e),
      c = n + i,
      l = Math.cos(c) * s,
      h = Math.sin(c) * s
    o.position.set(l, r / 2 - 8, h), o.rotation.y = i, t.add(o)
  }
  return t
}

function zd(n: number, e: number, t: number[]) {
  const i = Math.min(1, Math.max(0, n)),
    s = e + 0.5 - i * 0.86,
    r = Math.sin(i * Math.PI) * (Math.PI / 180) * 11.5 - (n < 0 || n > 1 ? 0.2 : 0) + Math.PI / 180 * 0.8
  return t[0] = Math.cos(r) * Math.cos(s), t[1] = Math.sin(r), t[2] = Math.cos(r) * Math.sin(s), t
}

function qb(n: {
  host: HTMLElement
  reducedMotion: boolean
  tag: (id: string) => HTMLElement | undefined
  camelTag: () => HTMLElement | null
  onHover: (u: any) => void
  onPick: (id: string) => void
  onEmpty: () => void
  onLost: () => void
  onAssets?: (state: string, p: number) => void
}) {
  const {
    host: e,
  } = n,
    t = new CS({
      antialias: !1,
      powerPreference: 'high-performance',
    })
  let i = Math.min(window.devicePixelRatio || 1, 2)
  t.toneMapping = Co, t.toneMappingExposure = 0.85
  let s = (() => {
    try {
      const U = t.getContext(),
        ee = U.getExtension('WEBGL_debug_renderer_info'),
        ae = ee ? String(U.getParameter(ee.UNMASKED_RENDERER_WEBGL)) : ''
      if (/swiftshader|llvmpipe|software|basic render|mali-[4t]|intel\(r\) hd graphics( [2-5]\d\d\d)?$/i.test(ae)) return !0
    } catch { /* noop */ }
    return (navigator.hardwareConcurrency || 8) <= 4
  })()
  t.shadowMap.enabled = !s, t.shadowMap.type = Xf, t.shadowMap.autoUpdate = !1, s && (i = 1), t.setPixelRatio(i)
  const r = t.domElement
  r.setAttribute('aria-hidden', 'true'), e.appendChild(r)
  const a = new Ou(),
    o = new un(45, 1, 0.5, 9e3)
  o.position.copy(Cr)
  const c = new wh('#c8c4b8', 58e-5)
  a.fog = c
  const l: any[] = [],
    h = QS(),
    u = jS()
  l.push(h, u)
  const d = new Uo() as any
  d.scale.setScalar(5e3), d.renderOrder = -2
  const p = d.material
  Object.assign(p.uniforms, {
    hazeColor: {
      value: new be(),
    },
    hazeMix: {
      value: 0.85,
    },
    nightTop: {
      value: new be(),
    },
    nightHor: {
      value: new be(),
    },
    uNight: {
      value: 0,
    },
  }), p.depthWrite = !1, p.fragmentShader = `uniform vec3 hazeColor; uniform float hazeMix; uniform vec3 nightTop; uniform vec3 nightHor; uniform float uNight;
` + p.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );', `// Keep the sky itself below the bloom threshold and let only the sun's disc exceed it, so the
      // sun reads as glare from the sky, not a sticker.
      vec3 eco3disc = sundiscColor;
      vec3 eco3base = max(texColor - eco3disc, vec3(0.0));
      eco3base *= min(1.0, 0.92 / max(max(eco3base.r, max(eco3base.g, eco3base.b)), 1e-4));
      eco3base = mix(eco3base, hazeColor, (1.0 - smoothstep(-0.03, 0.12, direction.y)) * hazeMix);
      vec3 eco3night = mix(nightHor, nightTop, pow(smoothstep(-0.04, 0.65, direction.y), 0.7));
      eco3base = mix(eco3base, eco3night, uNight);
      texColor = eco3base + min(eco3disc * 0.0008, vec3(12.0)) * (1.0 - uNight);
      gl_FragColor = vec4( texColor, 1.0 );`), p.uniforms.turbidity.value = 3.4, p.uniforms.rayleigh.value = 1.25, p.uniforms.mieCoefficient.value = 0.004, p.uniforms.mieDirectionalG.value = 0.82, p.uniforms.cloudCoverage.value = 0.16, p.uniforms.cloudDensity.value = 0.3, p.uniforms.showSunDisc.value = 1, a.add(d)
  const g = new Xc(t),
    y = new Ou(),
    v = new et(d.geometry, p)
  v.scale.setScalar(5e3), y.add(v)
  let m: any = null,
    E = -99,
    C = -1,
    x = 0
  const b = bb(i)
  l.push(...b.textures), a.add(b.group)
  const w = new y_('#ffffff', '#6b5236', 0.4),
    S = new w_('#ffffff', 2)
  S.castShadow = !0, S.shadow.mapSize.set(2048, 2048), S.shadow.radius = 4, Object.assign(S.shadow.camera, {
    left: -140,
    right: 140,
    top: 140,
    bottom: -140,
    near: 10,
    far: 700,
  }), S.shadow.bias = -4e-4, S.shadow.normalBias = 0.25, S.target.position.set(0, 0, 0)
  const _ = new S_('#ffffff', 2, 120, 1.4)
  _.position.set(0, ws, 0), a.add(w, S, S.target, _)
  const T = xb()
  l.push(...T.textures), a.add(T.mesh)
  const R = new qt({
    color: '#d4b382',
    roughness: 0.95,
  })
  a.add(yb(Ha, R))
  const D = Cb(s)
  l.push(...D.textures), a.add(D.group)
  const L = Pb()
  a.add(L.mesh)
  const H = tb()
  l.push(...H.textures), a.add(H.group)
  const I = nb()
  I.capstone.position.y = ws, a.add(I.capstone, I.ring)
  const O = new Vs(1, 1).rotateX(-Math.PI / 2),
    k = (U: number, ee: number, ae: number) => {
      const Ee = new Hn({
        map: u,
        transparent: !0,
        depthWrite: !1,
        blending: $i,
        color: '#ffffff',
      }),
        Ie = new et(O, Ee)
      return Ie.scale.setScalar(U), Ie.position.set(ee, Os(ee, ae) + 0.15, ae), Ie.renderOrder = 1, a.add(Ie), Ee
    },
    V = sb(),
    Z = new qt({
      color: '#4a3f37',
      metalness: 0.05,
      roughness: 0.75,
    }),
    q = cb(),
    J = new Hn({
      visible: !1,
    }),
    se: any[] = [],
    Te = new et(new En(70, 46, 70), J)
  Te.position.y = 20, Te.userData = {
    kind: 'node',
    id: 'hub',
  }, a.add(Te), se.push(Te)
  const Ce = new En(0.25, 2.4, 0.25),
    He: Record<string, any> = {}
  ei.forEach((U, ee) => {
    const ae = Gb[U],
      Ee = Math.cos(ae),
      Ie = Math.sin(ae),
      le = new P(Ee * qd, 0, Ie * qd)
    le.y = Os(le.x, le.z) - 0.2
    const qe = lb(V, Z, h)
    qe.group.position.copy(le), qe.group.scale.setScalar(Ip), qe.group.rotation.y = -ae, a.add(qe.group)
    const tt = new et(new En(8, Es + 2, 8), J)
    tt.position.set(le.x, (Es + 2) / 2, le.z), tt.userData = {
      kind: 'node',
      id: U,
    }, a.add(tt), se.push(tt)
    const gt = new P(0, ws, 0),
      pt = new P(le.x, le.y + Es + 0.1, le.z),
      Et = new Ph(gt, new P(le.x * 0.52, ws + 20, le.z * 0.52), pt),
      _e: any = new Do(Et, Kd, 0.16, Zd, !1),
      At = Zd * 6,
      nt = 28,
      Gt = 36
    _e.clearGroups(), _e.addGroup(0, nt * At, 0), _e.addGroup(nt * At, (Gt - nt) * At, 1), _e.addGroup(Gt * At, (Kd - Gt) * At, 0)
    const Vt = new Hn({
      transparent: !0,
      depthWrite: !1,
      blending: $i,
    }),
      ln = Vt.clone(),
      Tn = new et(_e, [Vt, ln])
    Tn.renderOrder = 2, a.add(Tn)
    const lt = new Hn({
      color: new be(tr.down).multiplyScalar(2.2),
    }),
      mt = new $t(),
      Zt = new et(Ce, lt),
      Re = new et(Ce, lt)
    Zt.rotation.z = Math.PI / 4, Re.rotation.z = -Math.PI / 4, mt.add(Zt, Re), mt.position.copy(Et.getPointAt(0.5)), mt.visible = !1, a.add(mt)
    const _t = -Ie,
      $e = Ee,
      It = [[46, 4], [62, 6], [82, 5.5], [97, 3], [100, 0], [97, -3], [82, -5.5], [62, -6], [46, -4], [43, 0]].map(([Un, An]) => new P(Ee * Un + _t * An, 0, Ie * Un + $e * An)),
      pn = new Po(It, !0, 'centripetal'),
      cn = fb(q, ee)
    cn.group.scale.setScalar(Ga), a.add(cn.group)
    const xn = new et(new En(1.4, 3, 3.4), J)
    xn.position.set(0, 1.5, 0.2), xn.userData = {
      kind: 'camel',
      id: U,
    }, cn.group.add(xn), se.push(xn), He[U] = {
      pos: le,
      obelisk: qe,
      glowMat: k(20, le.x, le.z),
      curve: Et,
      tubeMat: Vt,
      gapMat: ln,
      cross: mt,
      camel: cn,
      path: pn,
      pathLen: pn.getLength(),
      u: ee * 0.17 % 1,
      phase: ee,
    }
  })
  const ze = new Er(new Dh(0.42, 1), new Hn({
    color: '#ffffff',
  }), ei.length * mr.length)
  ze.frustumCulled = !1
  const Xe = new be('#ffffff')
  for (let U = 0; U < ze.count; U++) ze.setColorAt(U, Xe)
  a.add(ze)
  const Q = new Kt(1, 1, {
    type: en,
    samples: i >= 2 ? 0 : 4,
  }),
    te = new $S(t, Q)
  te.setPixelRatio(i), te.addPass(new KS(a, o))
  const de = new zs(new ue(256, 256), 0.28, 0.5, 1)
  te.addPass(de), te.addPass(new JS())
  const Me = new PS(o, r)
  Me.target.copy(Ds), Me.enableDamping = !0, Me.dampingFactor = 0.06, Me.enablePan = !1, Me.minDistance = 25, Me.maxDistance = 560, Me.maxPolarAngle = 1.5, Me.update()
  let Ae = !n.reducedMotion,
    We = 1,
    St = !1
  const oe = () => {
    St = !0
  },
    Le = () => {
      St = !1
    }
  Me.addEventListener('start', oe), Me.addEventListener('end', Le)
  const De = new P(),
    Oe = new P(),
    Ye = new Pt()
  let Ke = 0,
    ut = 0,
    je = 0,
    rt = !1,
    z = !1,
    Tt = !1,
    at: any = null,
    N: any = null,
    M = 12,
    G: any = null,
    Y = 0,
    $: any = null
  const ce: Record<string, any> = {}
  _r.forEach(U => ce[U] = new be(tr.idle))
  const fe = (U: string) => at?.nodes[U]?.state ?? 'idle',
    j = (U: string) => at?.links[U]?.state ?? 'idle',
    ie: Record<string, any> = {}
  ei.forEach(U => ie[U] = new be(tr.idle))
  const ve = ei.map(U => He[U].camel.mat.color.clone()),
    Fe = ei.map(U => He[U].camel.legMat.color.clone()),
    xe = new be('#c0583f')
  function me() {
    _r.forEach(U => ce[U].set(tr[fe(U)])), ei.forEach((U, ee) => {
      const ae = j(U)
      ie[U].set(tr[ae])
      const Ee = He[U]
      Ee.cross.visible = ae === 'down', Ee.gapMat.visible = ae !== 'down'
      const Ie = ie[U].clone().multiplyScalar(3 * sa[ae])
      mr.forEach((qe, tt) => ze.setColorAt(ee * mr.length + tt, Ie))
      const le = fe(U) === 'down'
      Ee.camel.mat.color.copy(ve[ee]).lerp(xe, le ? 0.55 : 0), Ee.camel.legMat.color.copy(Fe[ee]).lerp(xe, le ? 0.55 : 0), Ee.rig && (Ee.rig.mat.color.set($d[ee]).lerp(xe, le ? 0.55 : 0), Ee.rig.coatMat.color.copy(Ee.rig.mat.color).multiplyScalar(0.86))
    }), ze.instanceColor && (ze.instanceColor.needsUpdate = !0)
  }
  n.onAssets?.('loading', 0)
  const Ue = Db(U => !Tt && n.onAssets?.('loading', U))
  Ue.promise.then((U: any) => {
    if (Tt) {
      [U.sand, U.stone, U.rock].forEach(ee => [ee.map, ee.normal, ee.rough].forEach(ae => ae.dispose())), U.water.dispose(), U.moon.dispose()
      return
    }
    l.push(U.sand.map, U.sand.normal, U.sand.rough, U.stone.map, U.stone.normal, U.stone.rough, U.rock.map, U.rock.normal, U.rock.rough, U.water, U.moon), T.usePbr(U.sand.map, U.sand.normal, U.sand.rough), H.usePbr(U.stone.map, U.stone.normal, U.stone.rough), ob(ei.map(ee => He[ee].obelisk.shaftMat), U.rock.map, U.rock.normal, U.rock.rough), D.useNormals(U.water), b.useMoonTexture(U.moon), n.onAssets?.('ready', 1), rt || ns(0)
  }, () => {
    Tt || n.onAssets?.('failed', 0)
  })
  const ke = new AbortController()
  Nb(As.url, ke.signal).then((U: any) => {
    if (Tt) return
    const ee = Vb / U.height
    ei.forEach((ae, Ee) => {
      const Ie = He[ae],
        le = U.instance(Pp(), $d[Ee])
      le.root.scale.setScalar(ee), le.root.rotation.y = Math.PI, Ie.camel.group.add(le.root), Ie.camel.body.visible = !1
      const qe = (tt: any, gt: number) => ({
        clip: tt,
        time: Math.random() * tt.duration,
        weight: gt,
      })
      Ie.rig = {
        ...le,
        layers: [qe(U.clips.walk, 1), qe(U.clips.idle, 0), qe(U.clips.rest, 0)],
      }
    }), Y = U.clips.walk.duration / (U.stride * ee * Ga), me(), rt || ns(0)
  }, () => { /* camel optional */ })
  let Ge = 1,
    B = 1,
    ge = 1
  const ne = Cr.clone(),
    pe = Ds.clone()
  function we() {
    Ge = Math.max(1, e.clientWidth), B = Math.max(1, e.clientHeight), t.setSize(Ge, B, !1), te.setSize(Ge, B), o.aspect = Ge / B, o.fov = o.aspect < 0.8 ? 62 : o.aspect < 1.2 ? 52 : 45, o.updateProjectionMatrix()
    const U = o.aspect < 1.25 ? Math.min(2.4, 1.2 / o.aspect) : 1
    U !== ge && !$ && (pe.copy(Ds), U > 1 && (pe.x = 0), ne.copy(Cr).sub(Ds).multiplyScalar(U).add(pe), Me.target.copy(pe), o.position.copy(ne), ge = U), z && !rt && ns(0)
  }
  const re = new ResizeObserver(we)
  re.observe(e), we()
  let Be = !0
  const Ne = new IntersectionObserver(U => {
    Be = U.some(ee => ee.isIntersecting), ye()
  })
  Ne.observe(e)
  const yt = new R_(),
    dt = new ue()
  let tn = !1,
    on = !1,
    Li: any = null
  const Wr = (U: PointerEvent) => {
    const ee = r.getBoundingClientRect()
    dt.set((U.clientX - ee.left) / ee.width * 2 - 1, -((U.clientY - ee.top) / ee.height) * 2 + 1)
  },
    Ys = () => {
      yt.setFromCamera(dt, o)
      const U = yt.intersectObjects(se, !1)[0]
      return U ? U.object.userData : null
    },
    ji = (U: any) => {
      U?.kind === G?.kind && U?.id === G?.id || (G = U, r.style.cursor = U ? 'pointer' : 'grab', n.onHover(U))
    },
    Xr = (U: PointerEvent) => {
      Wr(U), on = !0, tn = !0
    },
    $s = () => {
      on = !1, ji(null)
    },
    Ks = (U: PointerEvent) => {
      Li = {
        x: U.clientX,
        y: U.clientY,
      }
    },
    Nn = (U: PointerEvent) => {
      if (!Li || U.button !== 0) return
      const ee = Math.hypot(U.clientX - Li.x, U.clientY - Li.y)
      if (Li = null, ee > 6 || $) return
      Wr(U)
      const ae = Ys()
      ae ? n.onPick(ae.id) : n.onEmpty()
    },
    es = (U: Event) => {
      U.preventDefault(), W(), n.onLost()
    }
  r.addEventListener('pointermove', Xr), r.addEventListener('pointerleave', $s), r.addEventListener('pointerdown', Ks), r.addEventListener('pointerup', Nn), r.addEventListener('webglcontextlost', es), r.style.cursor = 'grab'
  const qr = Xd(M),
    Jn = [0, 1, 0],
    Qn = [0, -1, 0],
    Zs = new P(),
    ts = new be('#b8c8ff')
  let Yr = 0
  const Js: Record<string, [number, number]> = {}
  function Oo(U: HTMLElement | null, ee: any) {
    if (U) {
      if (De.copy(ee).project(o), De.z > 1 || De.z < -1) {
        U.style.visibility = 'hidden'
        return
      }
      U.style.visibility = '', U.style.transform = `translate3d(${((De.x + 1) / 2 * Ge).toFixed(1)}px, ${((1 - De.y) / 2 * B).toFixed(1)}px, 0) translate(-50%, -100%)`
    }
  }
  function Fo(U: number) {
    Ke += U
    const ee = Xd(M, qr),
      ae = ee.neon,
      Ee = _n(0.05, 0.6, ee.stars),
      Ie = (M % 24 + 24) % 24,
      le = (Ie - 6) / 12,
      qe = (Ie + 6) % 24 / 12
    zd(le, Ha, Jn), zd(qe, Ha, Qn)
    const tt = le > 0 && le < 1,
      gt = qe > 0 && qe < 1,
      pt = tt ? _n(0, 0.02, le) * _n(1, 0.98, le) : 0,
      Et = gt ? _n(0, 0.03, qe) * _n(1, 0.97, qe) : 0,
      _e = p.uniforms
    _e.sunPosition.value.set(Jn[0], tt ? Jn[1] : -0.25, Jn[2]), _e.time.value = Ke, _e.hazeColor.value.copy(ee.hor), _e.nightTop.value.copy(ee.top), _e.nightHor.value.copy(ee.hor), _e.uNight.value = Math.max(Ee, tt ? 1 - _n(0, 0.035, le) * _n(1, 0.965, le) : 1), d.position.copy(o.position), b.group.position.copy(o.position), b.starMat.uniforms.uTime.value = Ke, b.starMat.uniforms.uOpacity.value = ee.stars, b.stars.visible = ee.stars > 0.01, b.moon.visible = b.moonHalo.visible = Et > 0, b.moon.visible && (b.moon.position.set(...(Qn as [number, number, number])).multiplyScalar(Mr * 0.92), b.moon.lookAt(o.position), b.moon.rotateY(-Math.PI / 2), b.moonHalo.position.copy(b.moon.position).multiplyScalar(1.001), b.moonMat.color.setScalar((0.35 + 0.95 * ee.stars) * Et), b.moonHalo.material.color.set('#c9d6ff').multiplyScalar(0.18 * Et * ee.stars)), c.color.copy(ee.hor), w.color.copy(ee.hor).lerp(Xe, 0.4), T.setNoon(tt ? _n(0.14, 0.3, le) * _n(0.86, 0.7, le) : 0), w.intensity = ee.hemi * 0.45, (Math.abs(M - E) > 0.1 || Math.abs(Ee - C) > 0.08) && Ke - x > 0.5 && (m?.dispose(), m = g.fromScene(y, 0, 1, 2e4), a.environment = m.texture, E = M, C = Ee, x = Ke), a.environmentIntensity = 0.55 - 0.4 * Ee
    const At = tt ? Jn : Qn,
      nt = Math.asin(At[1]),
      Gt = _n(0.03, 0.19, nt),
      Vt = Math.min(1.1, nt * 7 + 0.1),
      ln = Math.atan2(At[2], At[0]) + Gt * 1.75
    S.position.set(Math.cos(Vt) * Math.cos(ln) * 300, Math.sin(Vt) * 300, Math.cos(Vt) * Math.sin(ln) * 300), tt ? (S.color.copy(ee.sunCol), S.intensity = Math.max(ee.sun, 0.6) * pt) : (S.color.set('#a8b8ff'), S.intensity = 0.8 * Et), de.strength = 0.22 + 0.3 * _n(0.85, 1.65, ae), Zs.set(...(tt ? Jn : Qn) as [number, number, number]), D.update(U, Zs, tt ? ee.sunCol : ts, tt ? 1.4 * pt : 0.5 * Et), L.update(U, 1 - _n(0.15, 0.6, ee.stars))
    const Tn = 1 + 0.15 * Math.sin(Ke * 2.1),
      lt = sa[fe('hub')] * (N === 'hub' ? 1.4 : 1)
    if (I.capstone.position.y = ws + Math.sin(Ke * 0.9) * 0.3, I.capstone.rotation.y = Math.sin(Ke * 0.15) * 0.08, I.mat.emissive.copy(ce.hub), I.mat.emissiveIntensity = 2.1 * ae * lt * Tn, I.ringMat.color.copy(ce.hub).multiplyScalar(1.5 * ae * lt), _.color.copy(ce.hub), _.intensity = 900 * _n(0.9, 1.65, ae) * lt + 20, ei.forEach((Re, _t) => {
      const $e = He[Re],
        It = fe(Re),
        pn = j(Re),
        cn = N === Re,
        xn = N === null ? 1 : N === 'hub' ? 1.3 : cn ? 1.7 : 0.45,
        Un = sa[It] * (cn ? 1.6 : 1)
      $e.obelisk.shaftMat.emissive.copy(ce[Re]), $e.obelisk.shaftMat.emissiveIntensity = 1.4 * ae * Un, $e.obelisk.apexMat.emissive.copy(ce[Re]), $e.obelisk.apexMat.emissiveIntensity = 1.6 * ae * Un, $e.glowMat.color.copy(ce[Re]).multiplyScalar(0.4 * ae * Un * (0.4 + 0.6 * Ee))
      const An = sa[pn] * (pn === 'idle' ? 0.55 : 1.25)
      $e.tubeMat.color.copy(ie[Re]).multiplyScalar(An * ae * xn), $e.tubeMat.opacity = pn === 'idle' ? 0.35 : 0.8, $e.gapMat.color.copy($e.tubeMat.color), $e.gapMat.opacity = $e.tubeMat.opacity, $e.cross.visible && $e.cross.quaternion.copy(o.quaternion)
      const Up = pn === 'ok' || pn === 'warn'
      mr.forEach((Zr, Jr) => {
        if (Up) {
          let Qs = ((Ke * 0.12 + Math.abs(Zr) + _t * 0.13) % 1 + 1) % 1
          Zr < 0 && (Qs = 1 - Qs), $e.curve.getPointAt(Qs, Ye.position), Ye.scale.setScalar((0.8 + 0.35 * Math.sin(Ke * 6 + Jr)) * (cn ? 1.35 : 1))
        } else Ye.scale.setScalar(0)
        Ye.updateMatrix(), ze.setMatrixAt(_t * mr.length + Jr, Ye.matrix)
      })
      const is = $e.camel,
        Ii = Wb[It]
      if (Ii > 0 && ($e.u = ($e.u + Ii * U / $e.pathLen) % 1, $e.phase += Ii * U * Math.PI * 2 / (ub * Ga)), $e.path.getPointAt($e.u, is.group.position), is.group.position.y = Os(is.group.position.x, is.group.position.z) - 0.05, $e.path.getTangentAt($e.u, De), is.group.rotation.y = Math.atan2(De.x, De.z), $e.rig) {
        const Zr = 1 - Math.exp(-U * 4),
          Jr = [Ii > 0 ? 1 : 0, Ii > 0 || It === 'idle' ? 0 : 1, It === 'idle' ? 1 : 0],
          Qs = [Math.max(0.3, Ii * Y), 1, 0.6]
        $e.rig.layers.forEach((js: any, Vh: number) => {
          js.weight += (Jr[Vh] - js.weight) * Zr, js.time = (js.time + U * Qs[Vh]) % js.clip.duration
        }), $e.rig.pose($e.rig.layers)
      } else pb(is, It === 'idle' ? 'kneel' : Ii > 0 ? 'walk' : 'stand', $e.phase, 1 - Math.exp(-U * 4))
    }), ze.instanceMatrix.needsUpdate = !0, $) {
      $.t = Math.min(1, $.t + U / $.dur)
      const Re = Xb($.t)
      if (Me.target.lerpVectors($.fromT, $.toT, Re), o.position.lerpVectors($.fromP, $.toP, Re), o.lookAt(Me.target), $.t >= 1) {
        const _t = $.done
        $ = null, Me.enabled = !0, Me.update(), _t?.()
      }
    } else {
      if (Ae && !St) {
        const Re = o.position.x - Me.target.x,
          _t = o.position.z - Me.target.z
        let It = Math.atan2(-_t, -Re) - Ha
        It = Math.atan2(Math.sin(It), Math.cos(It)), It > Yd ? We = -1 : It < -Yd && (We = 1)
        const pn = We * 0.035 * U,
          cn = Math.cos(pn),
          xn = Math.sin(pn)
        o.position.x = Me.target.x + Re * cn - _t * xn, o.position.z = Me.target.z + Re * xn + _t * cn
      }
      Me.update(U)
    }
    tn && on && !$ && (tn = !1, ji(Ys())), Yr++ % 30 === 0 && _r.forEach(Re => {
      const _t = n.tag(Re)
      _t && (Js[Re] = [_t.offsetWidth, _t.offsetHeight])
    })
    const mt: any[] = []
    _r.forEach(Re => {
      Re === 'hub' ? Oe.set(0, ws + 3.2, 0) : Oe.set(He[Re].pos.x, He[Re].pos.y + Es + 2.2, He[Re].pos.z), De.copy(Oe).project(o)
      const [_t, $e] = Js[Re] ?? [120, 28],
        It = _t + 10
      mt.push({
        x: Math.min(Ge - It / 2, Math.max(It / 2, (De.x + 1) / 2 * Ge)),
        y: (1 - De.y) / 2 * B,
        w: It,
        h: $e + 6,
        z: De.z,
        id: Re,
      })
    }), mt.sort((Re, _t) => Re.id === 'hub' ? -1 : _t.id === 'hub' ? 1 : Re.z - _t.z), mt.forEach((Re, _t) => {
      for (let cn = 0; cn < 5; cn++) {
        let xn = !1
        for (let Un = 0; Un < _t; Un++) {
          const An = mt[Un]
          Math.abs(Re.x - An.x) < (Re.w + An.w) / 2 && Math.abs(Re.y - An.y) < (Re.h + An.h) / 2 && (Re.y = An.y - An.h, xn = !0)
        }
        if (!xn) break
      }
      const $e = n.tag(Re.id)
      if (!$e) return
      if (Re.z > 1 || Re.z < -1) {
        $e.style.visibility = 'hidden'
        return
      }
      $e.style.visibility = ''
      const It = Re.x,
        pn = Math.max(Re.h + 4, Re.y)
      $e.style.transform = `translate3d(${It.toFixed(1)}px, ${pn.toFixed(1)}px, 0) translate(-50%, -100%)`
    })
    const Zt = n.camelTag()
    Zt && G?.kind === 'camel' && G.id !== 'hub' ? Oo(Zt, Oe.copy(He[G.id].camel.group.position).setY(He[G.id].camel.group.position.y + 1.25 * 3.4 * Ga)) : Zt && (Zt.style.visibility = 'hidden')
  }
  function $r(U: number) {
    Fo(U), t.shadowMap.needsUpdate = !0, te.render(U)
  }
  function ns(U = 0) {
    $r(U)
  }
  function Kr() {
    s = !0, i = 1, t.setPixelRatio(1), te.setPixelRatio(1), we(), t.shadowMap.enabled = !1, a.traverse(U => {
      const ee = (U as any).material
      ee && (Array.isArray(ee) ? ee : [ee]).forEach(ae => ae.needsUpdate = !0)
    }), D.setLowQuality(!0)
  }
  let A = 0,
    F = 0
  function K(U: number) {
    je = requestAnimationFrame(K)
    const ee = ut ? (U - ut) / 1e3 : 0.016,
      ae = Math.min(0.1, ee)
    ut = U, !s && ee < 0.25 && (F += ee, ee > 0.034 && (A += ee), F > 3 && (A / F > 0.6 && Kr(), F = A = 0)), $r(ae)
  }
  function X() {
    rt || (rt = !0, ut = 0, je = requestAnimationFrame(K))
  }
  function W() {
    rt = !1, cancelAnimationFrame(je)
  }
  function ye() {
    !document.hidden && Be ? X() : W()
  }
  document.addEventListener('visibilitychange', ye), z = !0, ye()
  function Pe(U: string, ee?: () => void) {
    let ae: any, Ee: any
    if (U === 'hub') ae = new P(0, 18, 0), De.copy(o.position).sub(Me.target).setY(0).normalize(), Ee = new P(De.x * 125, 42, De.z * 125); else {
      const Ie = He[U].pos
      ae = new P(Ie.x, Ie.y + Es * 0.45, Ie.z)
      const le = new P(Ie.x, 0, Ie.z).normalize()
      Ee = Ie.clone().addScaledVector(le, 64).setY(Ie.y + Es * 0.8)
    }
    $ = {
      t: 0,
      dur: n.reducedMotion ? 0.001 : 1.3,
      fromT: Me.target.clone(),
      toT: ae,
      fromP: o.position.clone(),
      toP: Ee,
      done: ee,
    }, Me.enabled = !1
  }
  return {
    setHealth(U: any) {
      at = U, me()
    },
    setHot(U: any) {
      N = U
    },
    setHours(U: number) {
      M = U
    },
    setAutoRotate(U: boolean) {
      Ae = U
    },
    flyTo: Pe,
    renderNow: ns,
    resetView() {
      $ = {
        t: 0,
        dur: n.reducedMotion ? 0.001 : 1.3,
        fromT: Me.target.clone(),
        toT: pe.clone(),
        fromP: o.position.clone(),
        toP: ne.clone(),
      }, Me.enabled = !1
    },
    dispose() {
      Tt = !0, Ue.cancel(), ke.abort(), W(), document.removeEventListener('visibilitychange', ye), re.disconnect(), Ne.disconnect(), r.removeEventListener('pointermove', Xr), r.removeEventListener('pointerleave', $s), r.removeEventListener('pointerdown', Ks), r.removeEventListener('pointerup', Nn), r.removeEventListener('webglcontextlost', es), Me.removeEventListener('start', oe), Me.removeEventListener('end', Le), Me.dispose()
      const U = new Set<any>(),
        ee = new Set<any>()
      a.traverse(ae => {
        const Ee = ae as any
        Ee.geometry && U.add(Ee.geometry), Ee.material && (Array.isArray(Ee.material) ? Ee.material : [Ee.material]).forEach((Ie: any) => ee.add(Ie))
      }), U.forEach(ae => ae.dispose()), ee.forEach(ae => ae.dispose()), l.forEach(ae => ae.dispose()), ab(), db(), D.water.material.uniforms.mirrorSampler.value?.dispose(), m?.dispose(), g.dispose(), ze.dispose(), de.dispose(), te.dispose(), Q.dispose(), t.dispose(), t.forceContextLoss(), r.remove()
    },
  }
}

function xu(n: any) {
  if (!n) return 'never'
  const e = Date.parse(n)
  if (Number.isNaN(e)) return n
  const t = Math.round((Date.now() - e) / 6e4)
  if (t < 1) return 'just now'
  if (t < 60) return `${t} min ago`
  const i = Math.round(t / 60)
  return i < 48 ? `${i} h ago` : `${Math.round(i / 24)} d ago`
}

function zb(n: number) {
  const e = (n % 24 + 24) % 24
  return e < 5 ? 'Night' : e < 8 ? 'Dawn' : e < 11 ? 'Morning' : e < 14.5 ? 'Midday' : e < 17.3 ? 'Afternoon' : e < 19.4 ? 'Sunset' : 'Night'
}

// ---------------------------------------------------------------------------
// $b — the 3D scene component (verbatim port). Named Scene3D so react-hooks
// sees a component (the minified `$b` name reads as neither component nor hook).
// ---------------------------------------------------------------------------
function Scene3D(n: { health: any; onSelect: (id: string) => void }) {
  const {
    health: e,
  } = n,
    t = useRef<HTMLDivElement | null>(null),
    i = useRef<any>(null),
    s = useRef<Record<string, HTMLButtonElement | null>>({}),
    r = useRef<HTMLDivElement | null>(null),
    a = useRef(n.onSelect)
  // legacy assigns the latest callback in render; the ref is committed in an
  // always-run effect instead — same value every consumer sees.
  useEffect(() => {
    a.current = n.onSelect
  })
  const [o, c] = useState(() => Yb() ? '' : 'nogl'),
    [l, h] = useState<any>(null),
    [u, d] = useState<any>(null),
    [p, g] = useState(!0),
    [y, v] = useState(zl),
    [m, E] = useState(() => !Jd()),
    [C, x] = useState({
      state: 'loading',
      p: 0,
    }),
    b = (_: string) => i.current?.flyTo(_, () => a.current(_))
  useEffect(() => {
    if (o || !t.current) return
    let _: any
    try {
      _ = qb({
        host: t.current,
        reducedMotion: Jd(),
        tag: T => s.current[T] ?? undefined,
        camelTag: () => r.current,
        onHover: h,
        onPick: b,
        onEmpty: () => i.current?.resetView(),
        onLost: () => c('lost'),
        onAssets: (T, R) => x({
          state: T,
          p: R,
        }),
      })
    } catch {
      queueMicrotask(() => c('nogl')) // setState deferred out of the effect body
      return
    }
    return i.current = _, () => {
      i.current = null, _.dispose()
    }
  }, [o]), useEffect(() => i.current?.setHealth(e), [e, o])
  const w = (l?.kind === 'node' ? l.id : null) ?? u
  if (useEffect(() => i.current?.setHot(w), [w, o]), useEffect(() => i.current?.setHours(y), [y, o]), useEffect(() => i.current?.setAutoRotate(m), [m, o]), useEffect(() => {
    if (!p) return
    queueMicrotask(() => v(zl())) // setState deferred out of the effect body
    const _ = setInterval(() => v(zl()), 3e4)
    return () => clearInterval(_)
  }, [p]), useEffect(() => {
    if (o) return
    const _ = (T: KeyboardEvent) => {
      T.key === 'Escape' && i.current?.resetView()
    }
    return document.addEventListener('keydown', _), () => document.removeEventListener('keydown', _)
  }, [o]), o) return <div className="eco3 eco3--msg"><p>{o === 'nogl' ? '3D view needs WebGL' : '3D view stopped: the graphics card was reset. Reload the page.'}</p></div>
  const S = l?.kind === 'camel' && l.id !== 'hub' ? l.id : null
  return <div className="eco3" role="group" aria-label="CX ecosystem in 3D: the Main Hub and seven systems"><div className="eco3-canvas" ref={t} /><div className="eco3-tags">{_r.map(_ => {
    const T = e.nodes[_],
      R = w === _
    // eslint-disable-next-line -- kept raw: eco3-tag is a transform-positioned scene label, not a button
    return <button key={_} type="button" ref={D => {
      s.current[_] = D
    }} className={`eco3-tag eco3-s-${T.state}${R ? ' is-hot' : ''}${_ === 'hub' ? ' eco3-tag--hub' : ''}`} aria-label={`${ia[_]}, ${vu[T.state]}. Last run ${xu(T.lastRun)}. Opens ${ia[_]}.`} onPointerEnter={() => h({
      kind: 'node',
      id: _,
    })} onPointerLeave={() => h(null)} onFocus={() => d(_)} onBlur={() => d(null)} onClick={() => b(_)}><span className="eco3-tag-name"><i className="eco3-dot" aria-hidden="true" />{ia[_]}</span>{R ? <span className="eco3-tag-state">{vu[T.state]}{T.note ? `: ${T.note}` : ''}</span> : null}</button>
  })}<div ref={r} className={`eco3-tag eco3-tag--camel${S ? ` eco3-s-${e.nodes[S].state}` : ''}`} aria-hidden="true" style={{
    visibility: 'hidden',
  }}>{S ? <Ft><span className="eco3-tag-name"><i className="eco3-dot" />{ia[S]}</span><span className="eco3-tag-state">Last run {xu(e.nodes[S].lastRun)}</span></Ft> : null}</div></div>{C.state === 'loading' ? <div className="eco3-loading" role="status"><span>Loading the desert</span><i className="eco3-loading-bar" aria-hidden="true"><b style={{
    inlineSize: `${Math.round(C.p * 100)}%`,
  }} /></i></div> : null}<div className="eco3-dock"><label className="eco3-time"><span className="eco3-clock"><b>{Hb(y)}</b>{' '}{zb(y)}</span>{/* eslint-disable-next-line -- kept raw: eco3 range input is sized by the scene dock */}<input type="range" min="0" max="24" step="0.25" value={y} aria-label="Time of day in the scene" onInput={_ => {
    g(!1), v(Number(_.currentTarget.value))
  }} /></label>{/* eslint-disable-next-line -- kept raw: eco3-btn is a compact scene-dock control */}<button type="button" className="eco3-btn" aria-pressed={p} onClick={() => g(!0)} title="Follow your clock">Now</button>{/* eslint-disable-next-line -- kept raw: eco3-btn is a compact scene-dock control */}<button type="button" className="eco3-btn" aria-pressed={m} onClick={() => E(_ => !_)}>Auto-rotate</button></div></div>
}

// ---------------------------------------------------------------------------
// Shell/nav helpers (ported from the closure, bound to the unified registry)
// ---------------------------------------------------------------------------
const Kb = 300 * 1e3

const Lr = (n: string) => `#/${n}`

const Hr = 'hub'

const Ng = {
  get: () => fetchJson<any>('/api/hub/ecosystem'),
}

function Um(n: any) {
  return n.isOwner === !0
}

function rh(n: any, e: any) {
  const {
    user: t,
  } = e
  if (!n.roles.includes(t.role)) return !1
  const i = !!e.quality?.auditor
  switch (n.path) {
    case 'my-day':
    case 'notes':
      return Um(e)
    case 'coaching':
      return t.role !== 'agent' || !!t.specialist
    case 'aging':
      return !t.specialist
    case 'audit-queue':
    case 'my-auditor-kpis':
      return i
    case 'my-audits':
      return !t.specialist
    case 'disputes':
      return !0
    case 'calibration':
      return t.role !== 'agent' || i
    case 'kb-gaps':
      return t.role !== 'agent' || i || !!e.quality?.kbEditor
    default:
      return !0
  }
}

function ec(n: any, e: any) {
  return n.group === 'quality' && !e.quality ? n.roles.includes(e.user.role) : rh(n, e)
}

function im(n: any) {
  n.missing || !n.href || (n.external ? window.open(n.href, '_top') : location.assign(n.href))
}

function lm(n: string, e: (t: any) => boolean) {
  return n === 'hub' ? 'overview' : PAGES.find(t => t.group === n && e(t))?.path ?? 'overview'
}

function yf(n: string, e: any[], t: (a: any) => boolean) {
  const i = e.find(a => a.group === n && t(a))
  if (!i) return null
  const app = appForGroup(n),
    r = n !== 'hub' && app && (globalThis as any)
  void r
  return groupEntryLink(n, PAGES, t)
}

function Jb({ boot: n, msg: e, setMsg: t }: { boot: any; msg: string; setMsg: (m: string) => void }) {
  const {
    data: i,
    error: s,
    reload: r,
  } = Eo(Ng.get)
  return useEffect(() => {
    const o = setInterval(() => {
      document.hidden || r()
    }, Kb)
    return () => clearInterval(o)
  }, [r]), <div className="eco3-page">{i ? <Scene3D health={i} onSelect={o => {
    if (appForGroup(o) !== Hr) {
      const c = yf(o, PAGES as any[], l => ec(l, n))
      c && !c.missing ? im(c) : t(c ? 'That app is not connected yet. An admin adds its web app URL in Admin, Connected apps.' : 'You have no page in that system.')
      return
    }
    location.href = Lr(lm(o, c => rh(c, n)))
  }} /> : <div className="eco3-page-msg">{s ? <Ft><p>Ecosystem health did not load: {s}</p><Button className="btn" onClick={r}>Try again</Button></Ft> : <p>Loading the ecosystem</p>}</div>}<header className="eco3-head"><h1>Ecosystem</h1>{i?.asOf ? <span>Health as of {new Date(i.asOf).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}</span> : null}{e ? <span role="status">{e}</span> : null}<a href={Lr('overview')}>Hub home</a><small className="eco3-credit"><a href={As.source} target="_blank" rel="noopener noreferrer">Camel model</a>{' by'}{' '}<a href={As.authorUrl} target="_blank" rel="noopener noreferrer">{As.author}</a>,{' '}<a href={As.licenceUrl} target="_blank" rel="noopener noreferrer">{As.licence}</a></small></header></div>
}

/** Zb — ecosystem page component (verbatim port). */
export function EcosystemPage() {
  const e = Pr(),
    t = e?.user.role === 'admin' || e?.user.role === 'tl',
    [i, s] = useState('')
  return useEffect(() => {
    const r = document.title
    return document.title = 'Ecosystem, CX Helm', () => {
      document.title = r
    }
  }, []), !e || !t ? <div className="eco3-page"><div className="eco3-page-msg"><p>The ecosystem map is for team leads and admins.</p><a href={Lr('overview')}>Go to Hub home</a></div></div> : <Jb boot={e} msg={i} setMsg={s} />
}
