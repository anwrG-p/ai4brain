import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Paths are relative to the repo root, whatever the working directory. No dependencies.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docPath = path.join(ROOT, 'docs/architecture/SEQUENCE_DIAGRAMS.md')
if (!fs.existsSync(docPath)) {
  console.error(`Missing ${docPath}.\nUsage: node scripts/update_sequence_diagrams_md.mjs   (rewrites docs/architecture/SEQUENCE_DIAGRAMS.md in place)`)
  process.exit(1)
}
const content = fs.readFileSync(docPath, 'utf8')

const diagramsData = [
  {
    id: '01-high-level-closed-loop',
    title: 'High-Level 5-Subsystem Closed-Loop Overview',
    svg: './diagrams/01-high-level-closed-loop.svg',
    png: './diagrams/01-high-level-closed-loop.png',
  },
  {
    id: '02-seq1-assessment-telemetry-streaming',
    title: 'Sequence Diagram 1: Assessment Execution & Telemetry Streaming (Member 1 → Member 3)',
    svg: './diagrams/02-seq1-assessment-telemetry-streaming.svg',
    png: './diagrams/02-seq1-assessment-telemetry-streaming.png',
  },
  {
    id: '03-seq2-latent-representation-encoding',
    title: 'Sequence Diagram 2: Latent Representation Encoding & Task Blueprints Cache (Member 3 → Member 5)',
    svg: './diagrams/03-seq2-latent-representation-encoding.svg',
    png: './diagrams/03-seq2-latent-representation-encoding.png',
  },
  {
    id: '04-seq3-prototype-explainability-xai',
    title: 'Sequence Diagram 3: State Transition & Prototype Explainability XAI (Member 3 → Member 2)',
    svg: './diagrams/04-seq3-prototype-explainability-xai.svg',
    png: './diagrams/04-seq3-prototype-explainability-xai.png',
  },
  {
    id: '05-seq4-low-latency-task-cache',
    title: 'Sequence Diagram 4: Low-Latency Task Next & Runtime Adaptive Execution (Member 5 → Member 1)',
    svg: './diagrams/05-seq4-low-latency-task-cache.svg',
    png: './diagrams/05-seq4-low-latency-task-cache.png',
  },
  {
    id: '06-seq5-profile-ingestion-dashboard',
    title: 'Sequence Diagram 5: Profile Ingestion, Radar Chart & Dashboard Analytics (Members 3 & 2 → Member 4)',
    svg: './diagrams/06-seq5-profile-ingestion-dashboard.svg',
    png: './diagrams/06-seq5-profile-ingestion-dashboard.png',
  },
  {
    id: '07-consumer-ux-flow',
    title: 'Consumer UX Flow: First Click to De-Cluttered Dashboard',
    svg: './diagrams/07-consumer-ux-flow.svg',
    png: './diagrams/07-consumer-ux-flow.png',
  },
  {
    id: '08-emily-emotion-color-adaptation',
    title: 'EMILY Behavioral Emotion Tracking & Human-Approved Color Adaptation',
    svg: './diagrams/08-emily-emotion-color-adaptation.svg',
    png: './diagrams/08-emily-emotion-color-adaptation.png',
  },
  {
    id: '09-telemetry-jepa-cache',
    title: 'Assessment Telemetry, Brain Twin (SAT-JEPA + 3x3 GMM), and <10ms Task Cache',
    svg: './diagrams/09-telemetry-jepa-cache.svg',
    png: './diagrams/09-telemetry-jepa-cache.png',
  },
  {
    id: '10-ai-coach-guardrails-collab',
    title: 'Explainable AI Coach, Non-Clinical Firewall & Dynamic Collaboration Scorer',
    svg: './diagrams/10-ai-coach-guardrails-collab.svg',
    png: './diagrams/10-ai-coach-guardrails-collab.png',
  },
  {
    id: '11-human-ux-review-jargon-gate',
    title: 'Human-in-the-Loop UX Review & Jargon Gate Workflow (?review_mode=true)',
    svg: './diagrams/11-human-ux-review-jargon-gate.svg',
    png: './diagrams/11-human-ux-review-jargon-gate.png',
  },
]

// Extract blocks
let diagramIdx = 0
const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/g

const updatedContent = content.replace(mermaidRegex, (fullMatch, code) => {
  const diag = diagramsData[diagramIdx]
  diagramIdx++
  if (!diag) return fullMatch

  return `![${diag.title}](${diag.svg})

> 📊 **Rendered Visual Diagram**: [🔍 Open Vector SVG](${diag.svg}) · [🖼️ View High-DPI Retina PNG](${diag.png})

<details open>
<summary><b>Mermaid Diagram Specification & Code</b></summary>

\`\`\`mermaid
${code.trim()}
\`\`\`

</details>`
})

// Clean up any extra trailing backticks or headers
let finalContent = updatedContent.trim()
if (finalContent.endsWith('```')) {
  finalContent = finalContent.substring(0, finalContent.lastIndexOf('```')).trim()
}

// Add interactive viewer banner at top if not present
if (!finalContent.includes('sequence_diagrams_viewer.html')) {
  finalContent = finalContent.replace(
    "> **Source of Truth**: Root `README.md` · `docs/ui/contracts.md` · `assessment_engine/`",
    `> **Source of Truth**: Root \`README.md\` · \`docs/ui/contracts.md\` · \`assessment_engine/\`  
> 🚀 **Interactive Visual Viewer**: Open [\`sequence_diagrams_viewer.html\`](./sequence_diagrams_viewer.html) in any browser to zoom, pan, inspect, and export all 11 sequence diagrams interactively.`
  )
}

fs.writeFileSync(docPath, finalContent, 'utf8')
console.log(`Updated ${docPath} with rendered image embeds and viewer link.`)
