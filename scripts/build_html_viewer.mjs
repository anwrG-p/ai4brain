import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Paths are relative to the repo root, whatever the working directory. No dependencies.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docPath = path.join(ROOT, 'docs/architecture/SEQUENCE_DIAGRAMS.md')
const diagramsDir = path.join(ROOT, 'docs/architecture/diagrams')
const outputPath = path.join(ROOT, 'docs/architecture/sequence_diagrams_viewer.html')

if (!fs.existsSync(docPath)) {
  console.error(`Missing ${docPath}.\nUsage: node scripts/build_html_viewer.mjs   (reads docs/architecture/SEQUENCE_DIAGRAMS.md and diagrams/, writes sequence_diagrams_viewer.html)`)
  process.exit(1)
}

const diagramsMeta = [
  // null: a brand v2 consumer flow (section 7, diagrams 1, 2 and 4), kept as Mermaid source only, never rendered.
  { id: '01-high-level-closed-loop', num: 'Overview', title: '5-Subsystem Closed-Loop Overview', category: 'Core Architecture' },
  { id: '02-seq1-assessment-telemetry-streaming', num: 'Seq 1', title: 'Assessment Execution & Telemetry Streaming (M1 → M3)', category: 'Core Architecture' },
  { id: '03-seq2-latent-representation-encoding', num: 'Seq 2', title: 'Latent Representation Encoding & Task Blueprints Cache (M3 → M5)', category: 'Core Architecture' },
  { id: '04-seq3-prototype-explainability-xai', num: 'Seq 3', title: 'State Transition & Prototype Explainability XAI (M3 → M2)', category: 'Core Architecture' },
  { id: '05-seq4-low-latency-task-cache', num: 'Seq 4', title: 'Low-Latency Task Next & Runtime Adaptive Execution (M5 → M1)', category: 'Core Architecture' },
  { id: '06-seq5-profile-ingestion-dashboard', num: 'Seq 5', title: 'Profile Ingestion, Radar Chart & Dashboard Analytics (M3 & M2 → M4)', category: 'Core Architecture' },
  null,
  null,
  { id: '09-telemetry-jepa-cache', num: 'UX Flow 3', title: 'Assessment Telemetry, Brain Twin SAT-JEPA, and Task Cache', category: 'Consumer UX & Governance' },
  null,
  { id: '11-human-ux-review-jargon-gate', num: 'UX Flow 5', title: 'Human-in-the-Loop UX Review & Jargon Gate Workflow', category: 'Consumer UX & Governance' },
]

// Read content and mermaid blocks
const content = fs.readFileSync(docPath, 'utf8')
const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/g
let match
const mermaidCodes = []
while ((match = mermaidRegex.exec(content)) !== null) {
  mermaidCodes.push(match[1].trim())
}

// Index i still lines up with the i-th mermaid block; null entries are skipped.
const diagrams = diagramsMeta.flatMap((meta, i) => {
  if (!meta) return []
  const svgPath = path.join(diagramsDir, `${meta.id}.svg`)
  const svgContent = fs.existsSync(svgPath) ? fs.readFileSync(svgPath, 'utf8') : ''
  return [{
    ...meta,
    code: mermaidCodes[i] || '',
    svg: svgContent,
    svgFile: `diagrams/${meta.id}.svg`,
    pngFile: `diagrams/${meta.id}.png`,
  }]
})

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SynapseTwin Sequence Diagrams & Architecture Viewer</title>
  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --text: #0F172A;
      --text-muted: #64748B;
      --border: #E2E8F0;
      --primary: #0F766E;
      --primary-light: #CCFBF1;
      --accent: #FFC83D;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      background: #FFFFFF;
      border-bottom: 2px solid var(--border);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .badge {
      background: #0F766E;
      color: #FFFFFF;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    h1 {
      font-size: 18px;
      font-weight: 700;
      color: #0F172A;
    }
    .header-links a {
      color: var(--primary);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 12px;
      border: 1px solid var(--primary);
      border-radius: 6px;
      transition: all 0.15s ease;
    }
    .header-links a:hover {
      background: var(--primary);
      color: #FFFFFF;
    }
    .app-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    /* Sidebar */
    aside {
      width: 340px;
      background: #FFFFFF;
      border-right: 1px solid var(--border);
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }
    .nav-category {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-top: 12px;
      margin-bottom: 4px;
      padding-left: 8px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid transparent;
      cursor: pointer;
      text-align: left;
      font-size: 13px;
      color: var(--text);
      background: transparent;
      transition: all 0.15s ease;
      width: 100%;
    }
    .nav-item:hover {
      background: #F1F5F9;
      border-color: #CBD5E1;
    }
    .nav-item.active {
      background: #E6FFFA;
      border-color: #0F766E;
      color: #0F766E;
      font-weight: 600;
    }
    .nav-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      background: #E2E8F0;
      border-radius: 4px;
      color: #475569;
      flex-shrink: 0;
    }
    .nav-item.active .nav-badge {
      background: #0F766E;
      color: #FFFFFF;
    }
    .nav-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* Viewer stage */
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg);
    }
    .toolbar {
      padding: 12px 24px;
      background: #FFFFFF;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .title-box h2 {
      font-size: 16px;
      font-weight: 700;
      color: #0F172A;
    }
    .btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #FFFFFF;
      cursor: pointer;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .btn:hover {
      background: #F8FAFC;
      border-color: #94A3B8;
    }
    .btn-primary {
      background: #0F766E;
      color: #FFFFFF;
      border-color: #0F766E;
    }
    .btn-primary:hover {
      background: #0D655E;
    }
    .viewport {
      flex: 1;
      overflow: auto;
      padding: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(#CBD5E1 1px, transparent 1px);
      background-size: 20px 20px;
    }
    .diagram-card {
      background: #FFFFFF;
      border: 2px solid #1E293B;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 6px 6px 0px #1E293B;
      max-width: 100%;
      max-height: 100%;
      overflow: auto;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      transform-origin: center center;
    }
    .diagram-card svg {
      display: block;
      margin: 0 auto;
      max-width: 100%;
      height: auto;
    }
    /* Code drawer */
    .code-panel {
      background: #0F172A;
      color: #F8FAFC;
      border-top: 2px solid #1E293B;
      max-height: 220px;
      overflow-y: auto;
      padding: 16px 24px;
      font-family: "JetBrains Mono", Consolas, Monaco, monospace;
      font-size: 12px;
      line-height: 1.5;
      display: none;
    }
    .code-panel.open {
      display: block;
    }
    .code-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      color: #94A3B8;
      font-weight: bold;
    }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <span class="badge">CISTAC 1.0</span>
      <h1>SynapseTwin Sequence Diagrams & Architecture Visualizer</h1>
    </div>
    <div class="header-links">
      <a href="SEQUENCE_DIAGRAMS.md">📄 Open SEQUENCE_DIAGRAMS.md</a>
    </div>
  </header>

  <div class="app-body">
    <aside id="nav-list"></aside>

    <main>
      <div class="toolbar">
        <div class="title-box">
          <h2 id="active-title">Loading...</h2>
        </div>
        <div class="btn-group">
          <button class="btn" onclick="zoomIn()">➕ Zoom In</button>
          <button class="btn" onclick="zoomOut()">➖ Zoom Out</button>
          <button class="btn" onclick="resetZoom()">↺ Reset</button>
          <button class="btn" onclick="toggleCode()">💻 Toggle Mermaid Source</button>
          <a id="btn-svg" class="btn" href="#" download>📥 SVG</a>
          <a id="btn-png" class="btn btn-primary" href="#" download>🖼️ Retina PNG</a>
        </div>
      </div>

      <div class="viewport" id="viewport">
        <div class="diagram-card" id="diagram-card">
          <div id="svg-container"></div>
        </div>
      </div>

      <div class="code-panel" id="code-panel">
        <div class="code-header">
          <span>MERMAID SOURCE CODE</span>
          <button class="btn" style="padding:2px 8px; font-size:11px;" onclick="copyCode()">📋 Copy</button>
        </div>
        <pre><code id="mermaid-code"></code></pre>
      </div>
    </main>
  </div>

  <script>
    const diagrams = ${JSON.stringify(diagrams)};
    let activeIndex = 0;
    let currentScale = 1.0;

    function renderNav() {
      const nav = document.getElementById('nav-list');
      let currentCat = '';
      diagrams.forEach((d, idx) => {
        if (d.category !== currentCat) {
          currentCat = d.category;
          const catEl = document.createElement('div');
          catEl.className = 'nav-category';
          catEl.textContent = currentCat;
          nav.appendChild(catEl);
        }
        const item = document.createElement('button');
        item.className = 'nav-item' + (idx === 0 ? ' active' : '');
        item.innerHTML = \`<span class="nav-badge">\${d.num}</span><span class="nav-label">\${d.title}</span>\`;
        item.onclick = () => selectDiagram(idx);
        nav.appendChild(item);
      });
    }

    function selectDiagram(idx) {
      activeIndex = idx;
      currentScale = 1.0;
      updateTransform();
      const d = diagrams[idx];
      document.getElementById('active-title').textContent = d.title;
      document.getElementById('svg-container').innerHTML = d.svg;
      document.getElementById('mermaid-code').textContent = d.code;
      document.getElementById('btn-svg').href = d.svgFile;
      document.getElementById('btn-png').href = d.pngFile;

      document.querySelectorAll('.nav-item').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
      });
    }

    function zoomIn() {
      currentScale = Math.min(2.5, currentScale + 0.15);
      updateTransform();
    }

    function zoomOut() {
      currentScale = Math.max(0.4, currentScale - 0.15);
      updateTransform();
    }

    function resetZoom() {
      currentScale = 1.0;
      updateTransform();
    }

    function updateTransform() {
      const card = document.getElementById('diagram-card');
      card.style.transform = \`scale(\${currentScale})\`;
    }

    function toggleCode() {
      const panel = document.getElementById('code-panel');
      panel.classList.toggle('open');
    }

    function copyCode() {
      const code = diagrams[activeIndex].code;
      navigator.clipboard.writeText(code);
      alert('Mermaid source copied to clipboard!');
    }

    renderNav();
    selectDiagram(0);
  </script>
</body>
</html>
`

fs.writeFileSync(outputPath, html, 'utf8')
console.log(`Generated HTML viewer at ${outputPath}`)
