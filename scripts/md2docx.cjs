// Converte DOCUMENTACAO.md em .docx (subconjunto de Markdown usado no documento).
const fs = require('fs')
const d = require('docx')
const [, , input, output] = process.argv
const lines = fs.readFileSync(input, 'utf8').replace(/\r/g, '').split('\n')

const ACCENT = '7A3FD6', DARK = '17161C', MUTED = '4A4458', BAND = 'EEE9F6', BORDER = 'D9D2E6'
const PAGE_W = 11906 - 2 * 1134 // A4 menos margens de 2 cm

function runs(text, base = {}) {
  const out = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0, m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new d.TextRun({ text: text.slice(last, m.index), ...base }))
    const t = m[0]
    if (t.startsWith('**')) out.push(new d.TextRun({ text: t.slice(2, -2), bold: true, ...base }))
    else out.push(new d.TextRun({ text: t.slice(1, -1), font: 'Consolas', color: ACCENT, ...base }))
    last = m.index + t.length
  }
  if (last < text.length) out.push(new d.TextRun({ text: text.slice(last), ...base }))
  return out
}
const clean = (t) => t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

const children = []
let i = 0, firstPart = true
while (i < lines.length) {
  const line = lines[i]
  if (!line.trim() || line.trim() === '---') { i++; continue }
  if (line.startsWith('```')) {
    const code = []; i++
    while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
    i++
    code.forEach((c, k) => children.push(new d.Paragraph({
      shading: { type: d.ShadingType.CLEAR, fill: 'F3F0F8' },
      spacing: { before: k === 0 ? 120 : 0, after: k === code.length - 1 ? 160 : 0 },
      indent: { left: 200 },
      children: [new d.TextRun({ text: c || ' ', font: 'Consolas', size: 19, color: DARK })],
    })))
    continue
  }
  if (line.startsWith('|')) {
    const rows = []
    while (i < lines.length && lines[i].startsWith('|')) {
      if (!/^\|[\s:-]+\|/.test(lines[i]) || /[A-Za-zÀ-ú0-9]/.test(lines[i])) rows.push(lines[i].split('|').slice(1, -1).map((c) => clean(c.trim())))
      i++
    }
    const cols = rows[0].length
    const lens = rows[0].map((_, c) => Math.max(...rows.map((r) => (r[c] || '').length), 6))
    const total = lens.reduce((a, b) => a + b, 0)
    const widths = lens.map((l) => Math.floor((l / total) * PAGE_W))
    widths[cols - 1] += PAGE_W - widths.reduce((a, b) => a + b, 0)
    const border = { style: d.BorderStyle.SINGLE, size: 4, color: BORDER }
    children.push(new d.Table({
      width: { size: PAGE_W, type: d.WidthType.DXA }, columnWidths: widths,
      rows: rows.map((r) => Array.from({ length: cols }, (_, k) => r[k] ?? '')).map((r, ri) => new d.TableRow({
        tableHeader: ri === 0,
        children: r.map((cell, ci) => new d.TableCell({
          width: { size: widths[ci], type: d.WidthType.DXA },
          shading: { type: d.ShadingType.CLEAR, fill: ri === 0 ? ACCENT : ri % 2 === 0 ? BAND : 'FFFFFF' },
          borders: { top: border, bottom: border, left: border, right: border },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new d.Paragraph({ children: runs(cell, ri === 0 ? { bold: true, color: 'FFFFFF', size: 19 } : { size: 19 }) })],
        })),
      })),
    }))
    children.push(new d.Paragraph({ spacing: { after: 120 }, children: [] }))
    continue
  }
  const h = /^(#{1,3}) (.*)$/.exec(line)
  if (h) {
    const level = h[1].length, text = clean(h[2]).replace(/`/g, '')
    if (level === 1 && text.startsWith('Parte')) {
      children.push(new d.Paragraph({ heading: d.HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new d.TextRun(text)] }))
      firstPart = false
    } else if (level === 1) {
      children.push(new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [new d.TextRun(text)] }))
    } else {
      children.push(new d.Paragraph({ heading: level === 2 ? d.HeadingLevel.HEADING_2 : d.HeadingLevel.HEADING_3, children: [new d.TextRun(text)] }))
    }
    i++; continue
  }
  const b = /^(\s*)- (.*)$/.exec(line)
  if (b) {
    children.push(new d.Paragraph({ numbering: { reference: 'bullets', level: b[1].length >= 2 ? 1 : 0 }, children: runs(clean(b[2])) }))
    i++; continue
  }
  const n = /^(\d+)\. (.*)$/.exec(line)
  if (n) {
    const ref = `num-${children.length}`
    // agrupa a lista numerada contígua sob uma referência própria (reinicia em 1)
    while (i < lines.length && /^\d+\. /.test(lines[i])) {
      children.push(new d.Paragraph({ numbering: { reference: 'numbers', level: 0, instance: Number(ref.slice(4)) }, children: runs(clean(lines[i].replace(/^\d+\. /, ''))) }))
      i++
      while (i < lines.length && /^\s{2,}- /.test(lines[i])) {
        children.push(new d.Paragraph({ numbering: { reference: 'bullets', level: 1 }, children: runs(clean(lines[i].trim().slice(2))) }))
        i++
      }
    }
    continue
  }
  children.push(new d.Paragraph({ spacing: { after: 120 }, children: runs(clean(line)) }))
  i++
}
void firstPart

const cover = [
  new d.Paragraph({ spacing: { before: 3000 }, children: [new d.TextRun({ text: 'DESAFIO FRONTEND · DOCUMENTAÇÃO', color: ACCENT, bold: true, size: 22 })] }),
  new d.Paragraph({ spacing: { before: 200 }, children: [new d.TextRun({ text: 'NFT Marketplace', bold: true, size: 72, color: DARK, font: 'Calibri Light' })] }),
  new d.Paragraph({ spacing: { before: 200 }, children: [new d.TextRun({ text: 'Tudo o que foi construído, como funciona, como instalar, rodar, testar e configurar.', size: 28, color: MUTED })] }),
  new d.Paragraph({ spacing: { before: 1200 }, children: [new d.TextRun({ text: 'React · TypeScript · TanStack Router & Query · Axios · Socket.IO · MSW · Tailwind + shadcn/ui · Playwright · Lighthouse', size: 20, color: MUTED })] }),
  new d.Paragraph({ pageBreakBefore: true, heading: d.HeadingLevel.HEADING_1, children: [new d.TextRun('Sumário')] }),
  new d.TableOfContents('Sumário', { hyperlink: true, headingStyleRange: '1-2' }),
  new d.Paragraph({ children: [new d.TextRun({ text: 'Se o sumário aparecer vazio, clique nele com o botão direito e escolha "Atualizar campo".', italics: true, size: 18, color: MUTED })] }),
]

const doc = new d.Document({
  title: 'NFT Marketplace — Documentação completa',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21, color: DARK }, paragraph: { spacing: { line: 276 } } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { size: 48, bold: true, color: DARK }, paragraph: { spacing: { after: 200 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 40, bold: true, color: ACCENT }, paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, color: DARK }, paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 1, border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, color: BORDER, space: 4 } } } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, color: ACCENT }, paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [0, 1].map((level) => ({ level, format: d.LevelFormat.BULLET, text: level ? '–' : '•', alignment: d.AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 + level * 360, hanging: 260 } } } })) },
      { reference: 'numbers', levels: [{ level: 0, format: d.LevelFormat.DECIMAL, text: '%1.', alignment: d.AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 300 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new d.Footer({ children: [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, children: [new d.TextRun({ text: 'NFT Marketplace — Documentação · ', color: MUTED, size: 16 }), new d.TextRun({ children: [d.PageNumber.CURRENT], color: MUTED, size: 16 })] })] }) },
    children: [...cover, ...children.slice(1)], // a capa substitui o título do Markdown
  }],
})
d.Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(output, buf); console.log('ok', output, buf.length) })
