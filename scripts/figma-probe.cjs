// Amostra cores dos frames do Figma (uso interno de desenvolvimento).
const sharp = require('sharp')
const [file, ...pts] = process.argv.slice(2)
;(async () => {
  const img = sharp(file); const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  for (const p of pts) { const [x, y] = p.split(',').map(Number); const i = (y * info.width + x) * info.channels
    console.log(p, '#' + [0, 1, 2].map((k) => data[i + k].toString(16).padStart(2, '0')).join('')) }
})()
