// Gera arte SVG determinística para as fixtures (substitui as imagens do Figma — ver ARCHITECTURE.md).
import { mkdirSync, writeFileSync } from 'node:fs'
const out = new URL('../public/nfts/', import.meta.url)
mkdirSync(out, { recursive: true })
let seed = 42
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const palettes = [['#A259FF','#377DF7','#FF6250'],['#FF1CF7','#B03AFF','#00F0FF'],['#F9D423','#FF4E50','#1D2671'],['#43E97B','#38F9D7','#0F2027'],['#FFB86C','#FF5E62','#6A3093'],['#00C9FF','#92FE9D','#2B2B2B']]
for (let i = 1; i <= 48; i++) {
  const [a, b, c] = palettes[i % palettes.length]
  let shapes = ''
  for (let s = 0; s < 7; s++) {
    const x = Math.round(rnd() * 400), y = Math.round(rnd() * 400), r = Math.round(30 + rnd() * 120)
    const col = [a, b, c][s % 3]
    shapes += s % 2 ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity="${(0.4 + rnd() * 0.5).toFixed(2)}"/>`
      : `<rect x="${x - r / 2}" y="${y - r / 2}" width="${r}" height="${r}" rx="${Math.round(rnd() * 40)}" transform="rotate(${Math.round(rnd() * 90)} ${x} ${y})" fill="${col}" opacity="0.7"/>`
  }
  writeFileSync(new URL(`${i}.svg`, out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#2B2B2B"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="6"/></filter></defs><rect width="400" height="400" fill="url(#g)"/><g filter="url(#b)">${shapes}</g></svg>`)
}
for (let i = 1; i <= 12; i++) {
  const [a, b] = palettes[i % palettes.length]
  writeFileSync(new URL(`avatar-${i}.svg`, out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" fill="${a}"/><circle cx="60" cy="48" r="22" fill="${b}"/><ellipse cx="60" cy="108" rx="38" ry="28" fill="${b}"/></svg>`)
}
console.log('art generated')
