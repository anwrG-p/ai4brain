import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const playwrightPath = path.resolve('frontend/node_modules/@playwright/test')
const { chromium } = require(playwrightPath)

const docPath = path.resolve('docs/architecture/SEQUENCE_DIAGRAMS.md')
const outputDir = path.resolve('docs/architecture/diagrams')

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const titles = [
  { id: '01-high-level-closed-loop', title: 'High-Level 5-Subsystem Closed-Loop Overview' },
  { id: '02-seq1-assessment-telemetry-streaming', title: 'Sequence 1: Assessment Execution & Telemetry Streaming (M1 → M3)' },
  { id: '03-seq2-latent-representation-encoding', title: 'Sequence 2: Latent Representation Encoding & Task Blueprints Cache (M3 → M5)' },
  { id: '04-seq3-prototype-explainability-xai', title: 'Sequence 3: State Transition & Prototype Explainability XAI (M3 → M2)' },
  { id: '05-seq4-low-latency-task-cache', title: 'Sequence 4: Low-Latency Task Next & Runtime Adaptive Execution (M5 → M1)' },
  { id: '06-seq5-profile-ingestion-dashboard', title: 'Sequence 5: Profile Ingestion, Radar Chart & Dashboard Analytics (M3 & M2 → M4)' },
  { id: '07-consumer-ux-flow', title: 'Consumer UX Flow: First Click to De-Cluttered Dashboard' },
  { id: '08-emily-emotion-color-adaptation', title: 'EMILY Behavioral Emotion Tracking & Human-Approved Color Adaptation' },
  { id: '09-telemetry-jepa-cache', title: 'Assessment Telemetry, Brain Twin SAT-JEPA, and Task Cache' },
  { id: '10-ai-coach-guardrails-collab', title: 'Explainable AI Coach, Non-Clinical Firewall & Collaboration Scorer' },
  { id: '11-human-ux-review-jargon-gate', title: 'Human-in-the-Loop UX Review & Jargon Gate Workflow' },
]

const content = fs.readFileSync(docPath, 'utf8')
const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/g
let match
const diagrams = []
let index = 0

while ((match = mermaidRegex.exec(content)) !== null) {
  const code = match[1].trim()
  const meta = titles[index] || { id: `diagram_${index + 1}`, title: `Diagram ${index + 1}` }
  diagrams.push({
    ...meta,
    code,
    index: index + 1,
  })
  index++
}

console.log(`Processing ${diagrams.length} diagrams...`)

async function run() {
  const browser = await chromium.launch({ channel: 'msedge' })
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 2, // Crisp retina-quality PNGs
  })

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #ffffff;
          padding: 32px;
          margin: 0;
        }
        .diagram-wrapper {
          display: inline-block;
          background: #ffffff;
          padding: 24px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        svg {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          height: auto !important;
        }
      </style>
    </head>
    <body>
      <div id="render-target"></div>
    </body>
    </html>
  `)

  await page.waitForFunction(() => typeof window.mermaid !== 'undefined')
  await page.evaluate(() => {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      sequence: {
        mirrorActors: false,
        useMaxWidth: false,
        boxMargin: 12,
        messageMargin: 40,
        noteMargin: 15,
        actorMargin: 50,
      },
    })
  })

  // Clean old diagram_*.svg files
  const oldFiles = fs.readdirSync(outputDir).filter(f => f.includes('diagram_'))
  for (const f of oldFiles) {
    fs.unlinkSync(path.join(outputDir, f))
  }

  for (const diag of diagrams) {
    console.log(`Rendering [${diag.index}/11]: ${diag.title}...`)
    const result = await page.evaluate(async (d) => {
      const renderId = `m_${d.index}`
      try {
        const { svg } = await window.mermaid.render(renderId, d.code)
        document.getElementById('render-target').innerHTML = `<div id="box" class="diagram-wrapper">${svg}</div>`
        return { success: true, svg }
      } catch (err) {
        return { success: false, error: err.message || String(err) }
      }
    }, diag)

    if (result.success) {
      // Save SVG
      const svgPath = path.join(outputDir, `${diag.id}.svg`)
      fs.writeFileSync(svgPath, result.svg, 'utf8')

      // Save crisp PNG
      const element = await page.$('#box')
      if (element) {
        const pngPath = path.join(outputDir, `${diag.id}.png`)
        await element.screenshot({ path: pngPath })
        console.log(`Saved: ${diag.id}.svg and ${diag.id}.png`)
      }
    } else {
      console.error(`Failed to render diagram ${diag.index}:`, result.error)
    }
  }

  await browser.close()
  console.log('Rendering complete!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
