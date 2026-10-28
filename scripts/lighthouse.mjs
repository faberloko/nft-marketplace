// Executa Lighthouse 3x por página e perfil contra o build otimizado (npm run build && npm run preview), reporta medianas.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import os from 'node:os'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'
import { BASE_URL, CATEGORIES, PAGES, RUNS, TARGETS } from '../lighthouse/config.mjs'

const outDir = new URL('../lighthouse/reports/', import.meta.url)
mkdirSync(outDir, { recursive: true })
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

async function waitFor(url, ms = 60_000) {
  const t = Date.now()
  while (Date.now() - t < ms) { try { if ((await fetch(url)).ok) return } catch { /* aguardando */ } await new Promise((r) => setTimeout(r, 500)) }
  throw new Error(`servidor não respondeu: ${url}`)
}

let server
if (!process.env.LH_BASE_URL) {
  server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' })
  await waitFor(BASE_URL)
}
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] })
const results = []
try {
  for (const formFactor of ['mobile', 'desktop']) {
    for (const page of PAGES) {
      const runs = []
      for (let i = 1; i <= RUNS; i++) {
        const r = await lighthouse(`${BASE_URL}${page.path}`, { port: chrome.port, output: ['html', 'json'], onlyCategories: CATEGORIES, logLevel: 'error' }, formFactor === 'desktop' ? desktopConfig : undefined)
        const base = `${page.name}-${formFactor}-run${i}`
        writeFileSync(new URL(`${base}.html`, outDir), r.report[0]); writeFileSync(new URL(`${base}.json`, outDir), r.report[1])
        const lhr = r.lhr
        runs.push({
          ...Object.fromEntries(CATEGORIES.map((c) => [c, Math.round(lhr.categories[c].score * 100)])),
          LCP: lhr.audits['largest-contentful-paint'].numericValue, CLS: lhr.audits['cumulative-layout-shift'].numericValue, TBT: lhr.audits['total-blocking-time'].numericValue,
        })
        console.log(base, runs.at(-1))
      }
      const med = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, median(runs.map((x) => x[k]))]))
      results.push({ page: page.name, path: page.path, formFactor, median: med, runs })
    }
  }
} finally {
  await chrome.kill(); server?.kill()
}
const pkg = (n) => JSON.parse(readFileSync(new URL(`../node_modules/${n}/package.json`, import.meta.url))).version
const env = { date: new Date().toISOString(), node: process.version, lighthouse: pkg('lighthouse'), chrome: chrome.process?.spawnfile ?? 'auto', playwright: pkg('@playwright/test'), os: `${os.type()} ${os.release()} ${os.arch()}`, cpus: os.cpus()[0]?.model, runsPerPage: RUNS, baseUrl: BASE_URL, scenario: 'default (mocks MSW ativos, latência realista)' }
writeFileSync(new URL('summary.json', outDir), JSON.stringify({ env, targets: TARGETS, results }, null, 2))
const fmt = (v, k) => (k === 'CLS' ? v.toFixed(3) : k === 'LCP' || k === 'TBT' ? `${Math.round(v)} ms` : `${v}${v < TARGETS[k] ? ' ⚠' : ''}`)
const keys = [...CATEGORIES, 'LCP', 'CLS', 'TBT']
const md = [`# Lighthouse — medianas de ${RUNS} execuções`, '', '```json', JSON.stringify(env, null, 2), '```', '', `| Página | Perfil | ${keys.join(' | ')} |`, `|---|---|${keys.map(() => '---').join('|')}|`,
  ...results.map((r) => `| ${r.page} | ${r.formFactor} | ${keys.map((k) => fmt(r.median[k], k)).join(' | ')} |`), '', '⚠ = abaixo da meta (ver justificativa no ARCHITECTURE.md).'].join('\n')
writeFileSync(new URL('summary.md', outDir), md)
console.log(md)
