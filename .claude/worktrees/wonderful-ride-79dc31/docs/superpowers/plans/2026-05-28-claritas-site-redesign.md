# Claritas Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully rewrite `docs/index.html` as a single self-contained file (all CSS inline, no build step) with a sticky navbar, fullscreen hero video, features strip, Visão Geral + Vantagens section, three Sticky Split feature sections, and preserved Ko-fi + Footer.

**Architecture:** Single HTML file with `<style>` block in `<head>` and all JS at bottom of `<body>`. No external dependencies except Google Fonts (Inter). IntersectionObserver drives both `.reveal` entrance animations and Sticky Split image switching.

**Tech Stack:** Vanilla HTML/CSS/JS. CSS custom properties for theming. IntersectionObserver API. `localStorage` for theme persistence.

---

### Task 1: HTML Scaffold + Full CSS (base styles, theme vars, reset, typography, reveal, header/hero/kofi/footer CSS)

**Files:**
- Modify: `docs/index.html` (full rewrite)

- [ ] **Step 1: Write the new file skeleton**

Create `docs/index.html` with this skeleton (replace entire file):

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Claritas — Capture. Organize. Export.</title>
<meta name="description" content="...">
<link rel="icon" href="assets/icon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script>var t=localStorage.getItem('claritas-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}</script>
<style>
/* === CSS VARS === */
:root {
  --bg:#080c14; --surface:#0e1420; --surface-2:#131a28; --surface-3:#192033;
  --border:#1c2538; --border-hi:#263248;
  --text:#dde4f0; --muted:#506070; --muted-2:#8ba0bc;
  --accent:#00c4db; --accent-dim:rgba(0,196,219,0.08); --accent-glow:rgba(0,196,219,0.22);
  --radius:12px; --header-bg:rgba(8,12,20,0.85);
  --gradient-start:#00c4db; --gradient-end:#00e8ff;
  --hero-glow:rgba(0,196,219,0.07);
}
html[data-theme="light"] {
  --bg:#f9f4e8; --surface:#f2e9d2; --surface-2:#ede0c4; --surface-3:#e6d4b0;
  --border:#e2cfa0; --border-hi:#c8ae78;
  --text:#43280e; --muted:#c4a882; --muted-2:#8a6b52;
  --accent:#009bb3; --accent-dim:rgba(0,155,179,0.1); --accent-glow:rgba(0,155,179,0.28);
  --header-bg:rgba(249,244,232,0.92);
  --hero-glow:rgba(0,155,179,0.09);
  --gradient-start:#007a91; --gradient-end:#009bb3;
}
/* === RESET + BASE === */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}
/* ... more CSS here ... */
</style>
</head>
<body>
<!-- NAVBAR -->
<!-- HERO -->
<!-- FEATURES STRIP -->
<!-- VISAO GERAL + VANTAGENS -->
<!-- MODO CLIPBOARD -->
<!-- MODO CAPTURA -->
<!-- GOOGLE DRIVE SYNC -->
<!-- KOFI -->
<!-- FOOTER -->
<script>/* JS here */</script>
</body>
</html>
```

- [ ] **Step 2: Write the full CSS block** (see detailed CSS in tasks below per section)

- [ ] **Step 3: Verify file is valid HTML** — open in browser, confirm no parse errors in dev tools

---

### Task 2: Navbar HTML + CSS

**Files:**
- Modify: `docs/index.html`

- [ ] **Step 1: Write navbar HTML**

```html
<header id="site-header">
  <div class="header-inner">
    <!-- Left: logo + nav links -->
    <div class="header-left">
      <a href="#" class="logo" aria-label="Claritas">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="var(--accent)" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <span>Claritas</span>
      </a>
      <button class="hamburger" id="hamburger-btn" aria-label="Menu" aria-expanded="false">☰</button>
      <nav class="nav-links" id="nav-links">
        <a href="#visao-geral">Visão Geral</a>
        <a href="#vantagens">Vantagens</a>
        <a href="#modo-clipboard">Modo Clipboard</a>
        <a href="#modo-captura">Modo Captura</a>
        <a href="#google-drive-sync">Google Drive Sync</a>
      </nav>
    </div>
    <!-- Right: theme pills + download -->
    <div class="header-right">
      <div class="theme-pills" role="group" aria-label="Tema">
        <button class="pill-btn" id="pill-light" data-theme-set="light">Claritas</button>
        <button class="pill-btn" id="pill-dark" data-theme-set="dark">Dark</button>
      </div>
      <a href="https://github.com/LucasLima38/Claritas/releases/latest" class="btn-download" target="_blank" rel="noopener">↓ Download</a>
    </div>
  </div>
</header>
```

- [ ] **Step 2: Write navbar CSS**

```css
#site-header {
  position: sticky; top: 0; z-index: 200;
  background: var(--header-bg);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
  transition: box-shadow 0.3s;
}
#site-header.scrolled { box-shadow: 0 4px 24px rgba(0,0,0,0.18); }
.header-inner {
  max-width: 1100px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  height: 58px; padding: 0 2rem; gap: 1rem;
}
.header-left { display: flex; align-items: center; gap: 1.5rem; }
.logo { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 1.05rem; color: var(--text); }
.nav-links { display: flex; align-items: center; gap: 1.25rem; }
.nav-links a { font-size: 0.875rem; font-weight: 500; color: var(--muted-2); transition: color 0.2s; white-space: nowrap; }
.nav-links a:hover { color: var(--accent); }
.header-right { display: flex; align-items: center; gap: 0.75rem; }
.theme-pills { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.pill-btn { padding: 0.3rem 0.75rem; font-size: 0.8rem; font-weight: 600; border: none; cursor: pointer; background: transparent; color: var(--muted-2); transition: background 0.2s, color 0.2s; }
.pill-btn.active { background: var(--accent); color: #fff; }
.btn-download { background: #2563eb; color: #f5ede0; border-radius: 8px; padding: 0.45rem 1.1rem; font-weight: 600; font-size: 0.875rem; white-space: nowrap; transition: background 0.2s; }
.btn-download:hover { background: #1d4ed8; }
.hamburger { display: none; background: none; border: none; color: var(--text); font-size: 1.25rem; cursor: pointer; padding: 0.25rem 0.5rem; }

/* Mobile hamburger menu */
@media (max-width: 767px) {
  .hamburger { display: block; }
  .nav-links {
    display: none; flex-direction: column; align-items: flex-start; gap: 0;
    position: absolute; top: 58px; left: 0; right: 0;
    background: var(--header-bg); backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border); padding: 0.5rem 0; z-index: 199;
  }
  .nav-links.open { display: flex; }
  .nav-links a { padding: 0.75rem 2rem; width: 100%; font-size: 0.95rem; }
}
```

- [ ] **Step 3: Verify** — navbar appears sticky at top, pills visible, download button visible, links readable

---

### Task 3: Hero Section (preserve existing)

**Files:**
- Modify: `docs/index.html`

- [ ] **Step 1: Write hero HTML** (preserve from current file exactly)

```html
<section id="hero-section">
  <video class="hero-bg-video" autoplay muted loop playsinline>
    <source src="assets/videos/demo.mp4" type="video/mp4">
  </video>
  <div class="hero">
    <div class="hero-text reveal">
      <div class="hero-badge">Gratuito &amp; Open-Source</div>
      <h1>Seus esquemáticos,<br><span class="gradient">organizados em segundos</span></h1>
      <p class="hero-sub">Claritas monitora o clipboard do Altium Designer, converte esquemáticos para SVG instantaneamente e os organiza por projeto — sem configuração, sem cliques extras.</p>
      <div class="hero-ctas">
        <a href="https://github.com/LucasLima38/Claritas/releases/latest" class="btn-primary" target="_blank" rel="noopener">↓ Download grátis</a>
        <a href="https://github.com/LucasLima38/Claritas" class="btn-secondary" target="_blank" rel="noopener">Ver no GitHub</a>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Write hero CSS** (preserve from current file)

```css
#hero-section {
  position: relative; overflow: hidden;
  min-height: 96vh; display: flex; align-items: center;
}
#hero-section::before {
  content: ''; position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(160deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.42) 50%, rgba(0,0,0,0.72) 100%);
}
.hero-bg-video {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; z-index: 0;
}
.hero { position: relative; z-index: 2; padding: 7rem 2rem 6rem clamp(2rem,6vw,6rem); text-align: left; }
.hero-badge {
  display: inline-block; background: var(--accent-dim);
  border: 1px solid var(--accent-glow); border-radius: 20px;
  color: var(--accent); font-size: 0.78rem; font-weight: 600;
  padding: 0.3rem 0.9rem; margin-bottom: 1.25rem;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.hero h1 { font-size: clamp(2.2rem,5vw,3.6rem); font-weight: 700; line-height: 1.15; color: #fff; max-width: 680px; margin-bottom: 1.25rem; }
.gradient { background: linear-gradient(90deg, var(--gradient-start), var(--gradient-end)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.hero-sub { font-size: clamp(1rem,2vw,1.15rem); color: rgba(255,255,255,0.78); max-width: 520px; margin-bottom: 2rem; line-height: 1.7; }
.hero-ctas { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.btn-primary { background: var(--accent); color: #fff; font-weight: 700; font-size: 1rem; padding: 0.85rem 2rem; border-radius: var(--radius); transition: opacity 0.2s, transform 0.2s; }
.btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
.btn-secondary { background: rgba(255,255,255,0.1); color: #fff; font-weight: 600; font-size: 1rem; padding: 0.85rem 2rem; border-radius: var(--radius); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(8px); transition: background 0.2s; }
.btn-secondary:hover { background: rgba(255,255,255,0.18); }
```

- [ ] **Step 3: Verify** — hero fills viewport, video plays, text readable over gradient overlay

---

### Task 4: Features Strip

**Files:**
- Modify: `docs/index.html`

- [ ] **Step 1: Write features strip HTML**

```html
<section class="features-strip">
  <div class="features-strip-inner">
    <!-- Card 1: Modo Clipboard -->
    <div class="feature-card reveal">
      <div class="feature-card-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="2" width="6" height="4" rx="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>
        </svg>
      </div>
      <h3 class="feature-card-title">Modo Clipboard</h3>
      <p class="feature-card-desc">Detecta e converte esquemáticos automaticamente</p>
      <a href="#modo-clipboard" class="feature-card-link">Ver como funciona ↓</a>
    </div>
    <!-- Card 2: Modo Captura -->
    <div class="feature-card reveal">
      <div class="feature-card-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
        </svg>
      </div>
      <h3 class="feature-card-title">Modo Captura</h3>
      <p class="feature-card-desc">Capture qualquer janela ou região da tela</p>
      <a href="#modo-captura" class="feature-card-link">Ver como funciona ↓</a>
    </div>
    <!-- Card 3: Google Drive Sync -->
    <div class="feature-card reveal">
      <div class="feature-card-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
        </svg>
      </div>
      <h3 class="feature-card-title">Google Drive Sync</h3>
      <p class="feature-card-desc">Seus arquivos na nuvem, na sua própria conta</p>
      <a href="#google-drive-sync" class="feature-card-link">Ver como funciona ↓</a>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Write features strip CSS**

```css
.features-strip { background: var(--surface); border-bottom: 1px solid var(--border); padding: 3.5rem 2rem; }
.features-strip-inner { max-width: 1100px; margin: 0 auto; display: flex; gap: 1.5rem; }
.feature-card {
  flex: 1; background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 2rem 1.5rem;
  display: flex; flex-direction: column; gap: 0.75rem;
  transition: border-color 0.25s, transform 0.25s;
}
.feature-card:hover { border-color: var(--accent); transform: translateY(-3px); }
.feature-card-icon { color: var(--accent); }
.feature-card-title { font-size: 1.05rem; font-weight: 700; color: var(--text); }
.feature-card-desc { font-size: 0.88rem; color: var(--muted-2); line-height: 1.55; flex: 1; }
.feature-card-link { font-size: 0.85rem; font-weight: 600; color: var(--accent); margin-top: 0.25rem; }
.feature-card-link:hover { text-decoration: underline; }

@media (max-width: 767px) {
  .features-strip-inner { flex-direction: column; }
}
```

- [ ] **Step 3: Verify** — 3 cards in a row on desktop, single column on mobile

---

### Task 5: Visão Geral + Vantagens Section

**Files:**
- Modify: `docs/index.html`

- [ ] **Step 1: Write HTML**

```html
<section class="overview-section">
  <div class="overview-inner">
    <div class="section-eyebrow reveal">Visão Geral</div>
    <h2 class="section-title reveal" id="visao-geral">O que é o Claritas?</h2>
    <p class="overview-body reveal">Claritas é um aplicativo de desktop gratuito e open-source para Windows, criado para engenheiros de EDA. Ele monitora o clipboard e detecta automaticamente esquemáticos copiados do Altium Designer via Ctrl+C, converte-os para SVG em segundos, exibe uma prévia ao vivo e salva os arquivos de forma sequencial e organizada por projeto — com sincronização opcional pelo Google Drive.</p>

    <div class="advantages-grid" id="vantagens">
      <div class="adv-card reveal">
        <div class="adv-icon">⚡</div>
        <h3 class="adv-title">Clipboard automático</h3>
        <p class="adv-desc">Detecta esquemáticos copiados do Altium sem clique extra</p>
      </div>
      <div class="adv-card reveal">
        <div class="adv-icon">📁</div>
        <h3 class="adv-title">Organizado por projeto</h3>
        <p class="adv-desc">Salva com nome sequencial dentro de cada projeto</p>
      </div>
      <div class="adv-card reveal">
        <div class="adv-icon">☁️</div>
        <h3 class="adv-title">Sync com Google Drive</h3>
        <p class="adv-desc">Seus arquivos em nuvem, na sua própria conta</p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Write CSS**

```css
.overview-section { padding: 6rem 2rem; background: var(--bg); }
.overview-inner { max-width: 760px; margin: 0 auto; text-align: center; }
.section-eyebrow { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 0.75rem; }
.section-title { font-size: clamp(1.8rem,3.5vw,2.4rem); font-weight: 700; color: var(--text); margin-bottom: 1.5rem; }
.overview-body { font-size: 1.05rem; color: var(--muted-2); line-height: 1.75; margin-bottom: 3.5rem; }
.advantages-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.5rem; text-align: left; }
.adv-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.75rem 1.5rem; transition: border-color 0.25s; }
.adv-card:hover { border-color: var(--accent); }
.adv-icon { font-size: 1.75rem; margin-bottom: 0.75rem; }
.adv-title { font-size: 1rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem; }
.adv-desc { font-size: 0.875rem; color: var(--muted-2); line-height: 1.55; }

@media (max-width: 767px) {
  .advantages-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Verify** — centered text, 3-column advantage grid on desktop

---

### Task 6: Sticky Split Feature Sections — HTML + CSS

**Files:**
- Modify: `docs/index.html`

- [ ] **Step 1: Write HTML for all 3 feature sections**

Pattern for each section (repeat × 3):
```html
<section id="modo-clipboard" class="feature-section">
  <div class="feature-section-header reveal">
    <div class="section-eyebrow">Modo Clipboard</div>
    <h2 class="section-title">Modo Clipboard</h2>
    <p class="feature-subtitle">Copie do Altium, o Claritas faz o resto.</p>
  </div>
  <div class="feature-inner">
    <div class="feature-steps">
      <div class="step-block active" data-step="1" data-img="assets/screenshots/app-clipboard.png">
        <div class="step-num">Passo 1</div>
        <div class="step-title">Abra seu projeto no Altium</div>
        <div class="step-desc">Abra o projeto que deseja exportar no Altium Designer.</div>
      </div>
      <div class="step-block" data-step="2" data-img="assets/screenshots/app-clipboard.png">
        <div class="step-num">Passo 2</div>
        <div class="step-title">Copie o esquemático (Ctrl+C)</div>
        <div class="step-desc">Selecione e pressione Ctrl+C. O Claritas detecta automaticamente o conteúdo do clipboard.</div>
      </div>
      <div class="step-block" data-step="3" data-img="assets/screenshots/app-clipboard.png">
        <div class="step-num">Passo 3</div>
        <div class="step-title">Prévia automática e salve com um clique</div>
        <div class="step-desc">O SVG aparece instantaneamente na prévia. Salve no projeto com um único clique.</div>
      </div>
    </div>
    <div class="feature-media">
      <div class="feature-img-wrap">
        <img class="feature-img" src="assets/screenshots/app-clipboard.png" alt="Modo Clipboard" data-current="assets/screenshots/app-clipboard.png">
        <div class="progress-dots">
          <span class="pdot active" data-dot="1"></span>
          <span class="pdot" data-dot="2"></span>
          <span class="pdot" data-dot="3"></span>
        </div>
      </div>
    </div>
  </div>
</section>
```

Sections 2 and 3 follow the same pattern with different id/eyebrow/title/subtitle/steps/images.

- [ ] **Step 2: Write the 3 sections in order**

  Section 1 (`#modo-clipboard`): as above.

  Section 2 (`#modo-captura`, alt layout):
  - Eyebrow: "Modo Captura"
  - Title: "Modo Captura"
  - Subtitle: "Capture qualquer janela ou região da tela."
  - Step 1 img: `assets/screenshots/Captura de tela 2026-05-27 172428.png`
  - Step 2 img: `assets/screenshots/Captura de tela 2026-05-27 172428.png`
  - Step 3 img: `assets/screenshots/Captura de tela 2026-05-27 172504.png`

  Section 3 (`#google-drive-sync`):
  - Eyebrow: "Google Drive Sync"
  - Title: "Google Drive Sync"
  - Subtitle: "Seus arquivos na nuvem, na sua própria conta."
  - All 3 steps img: `assets/screenshots/Captura de tela 2026-05-27 172504.png`

- [ ] **Step 3: Write Sticky Split CSS**

```css
.feature-section { padding: 6rem 2rem; border-top: 1px solid var(--border); background: var(--bg); }
.feature-section:nth-of-type(even), .feature-section--alt { background: var(--surface); }
.feature-section-header { max-width: 1100px; margin: 0 auto 4rem; text-align: center; }
.feature-subtitle { font-size: 1.05rem; color: var(--muted-2); margin-top: 0.75rem; }
.feature-inner { max-width: 1100px; margin: 0 auto; display: flex; gap: 5rem; align-items: flex-start; }
.feature-steps { width: 40%; display: flex; flex-direction: column; gap: 0; padding-bottom: 30vh; }
.feature-media { width: 60%; position: sticky; top: 80px; }
.feature-img-wrap { background: var(--surface-2); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
.feature-img { width: 100%; height: auto; display: block; transition: opacity 0.3s ease; }
.progress-dots { display: flex; gap: 8px; justify-content: center; padding: 1rem 0; }
.pdot { width: 8px; height: 8px; border-radius: 50%; background: var(--border-hi); transition: background 0.3s, transform 0.3s; cursor: pointer; }
.pdot.active { background: var(--accent); transform: scale(1.3); }

/* Step blocks */
.step-block { padding: 2rem 1.5rem; border-left: 3px solid transparent; border-radius: 0 8px 8px 0; transition: border-color 0.3s, background 0.3s; cursor: default; margin-bottom: 0.5rem; }
.step-block.active { border-left-color: var(--accent); background: var(--accent-dim); }
.step-num { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-bottom: 0.4rem; opacity: 0.7; }
.step-block.active .step-num { opacity: 1; }
.step-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem; }
.step-desc { font-size: 0.9rem; color: var(--muted-2); line-height: 1.6; }

/* Mobile: single column */
@media (max-width: 767px) {
  .feature-inner { flex-direction: column-reverse; gap: 2rem; }
  .feature-steps, .feature-media { width: 100%; }
  .feature-media { position: static; }
  .feature-steps { padding-bottom: 0; }
}
```

- [ ] **Step 4: Verify** — on desktop, media panel sticks; step blocks take up space on left side

---

### Task 7: Sticky Split JS (IntersectionObserver + image fade + dots)

**Files:**
- Modify: `docs/index.html` (JS block at end of `<body>`)

- [ ] **Step 1: Write Sticky Split JS**

```javascript
(function () {
  var sections = document.querySelectorAll('.feature-section');
  sections.forEach(function (section) {
    var steps = section.querySelectorAll('.step-block');
    var img = section.querySelector('.feature-img');
    var dots = section.querySelectorAll('.pdot');
    if (!steps.length || !img) return;

    function activateStep(idx) {
      steps.forEach(function (s, i) { s.classList.toggle('active', i === idx); });
      dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
      var newSrc = steps[idx].getAttribute('data-img');
      if (!newSrc || img.getAttribute('data-current') === newSrc) return;
      img.style.opacity = '0';
      setTimeout(function () {
        img.src = newSrc;
        img.setAttribute('data-current', newSrc);
        img.style.opacity = '1';
      }, 300);
    }

    // Dots clickable
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { activateStep(i); });
    });

    if (!('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var idx = parseInt(entry.target.getAttribute('data-step'), 10) - 1;
          activateStep(idx);
        }
      });
    }, { threshold: 0.6, rootMargin: '0px 0px -15% 0px' });

    steps.forEach(function (step) { obs.observe(step); });
  });
})();
```

- [ ] **Step 2: Verify** — scroll through Modo Clipboard section; confirm image fades between steps, active step has left border + tinted background, dots update

---

### Task 8: Theme Pill JS + Hamburger JS + Scroll Shadow

**Files:**
- Modify: `docs/index.html` (JS block at end of `<body>`)

- [ ] **Step 1: Write theme pill JS** (replace old icon-toggle JS)

```javascript
(function () {
  var pillLight = document.getElementById('pill-light');
  var pillDark = document.getElementById('pill-dark');

  function setTheme(t) {
    if (t === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('claritas-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('claritas-theme', 'dark');
    }
    pillLight.classList.toggle('active', t === 'light');
    pillDark.classList.toggle('active', t !== 'light');
  }

  // Initial state
  var stored = localStorage.getItem('claritas-theme');
  setTheme(stored === 'light' ? 'light' : 'dark');

  pillLight.addEventListener('click', function () { setTheme('light'); });
  pillDark.addEventListener('click', function () { setTheme('dark'); });
})();
```

- [ ] **Step 2: Write hamburger JS**

```javascript
(function () {
  var btn = document.getElementById('hamburger-btn');
  var nav = document.getElementById('nav-links');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    btn.textContent = open ? '✕' : '☰';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // Close menu when link clicked
  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      nav.classList.remove('open');
      btn.textContent = '☰';
      btn.setAttribute('aria-expanded', 'false');
    });
  });
})();
```

- [ ] **Step 3: Write scroll shadow JS**

```javascript
(function () {
  var header = document.getElementById('site-header');
  if (!header) return;
  window.addEventListener('scroll', function () {
    header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
})();
```

- [ ] **Step 4: Verify** — pills highlight correct theme on click; hamburger toggles menu on mobile; header gains shadow on scroll

---

### Task 9: Ko-fi + Footer (preserve existing HTML verbatim)

**Files:**
- Modify: `docs/index.html`

- [ ] **Step 1: Write Ko-fi HTML** (copy verbatim from existing file)

```html
<div class="kofi-section reveal">
  <div class="kofi-box">
    <div class="kofi-text">
      <span class="kofi-badge">Gratuito &amp; Open Source</span>
      <span class="kofi-emoji">☕</span>
      <h3 class="kofi-title">Gostou do Claritas?</h3>
      <p class="kofi-desc">O Claritas é gratuito e sempre será. Se ele te economiza tempo no trabalho, um cafezinho ajuda a manter o domínio e o desenvolvimento ativo.</p>
    </div>
    <div class="kofi-action">
      <a href="https://ko-fi.com/vieiralucas9797" class="btn-kofi" target="_blank" rel="noopener">☕ Apoiar no Ko-fi</a>
      <p class="kofi-note">Qualquer valor já ajuda ✨</p>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Write Footer HTML** (copy verbatim)

```html
<footer>
  <p>Claritas é open-source sob licença <a href="https://github.com/LucasLima38/Claritas/blob/master/LICENSE" target="_blank" rel="noopener">MIT</a><span>·</span><a href="https://github.com/LucasLima38/Claritas" target="_blank" rel="noopener">GitHub</a><span>·</span><a href="privacy.html">Privacidade</a></p>
</footer>
```

- [ ] **Step 3: Write Ko-fi + Footer CSS** (preserve from existing file)

```css
.kofi-section { padding: 5rem 2rem; background: var(--surface); border-top: 1px solid var(--border); }
.kofi-box { position: relative; overflow: hidden; background: linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%); border: 1px solid rgba(0,196,219,0.22); border-radius: 24px; padding: 4.5rem 4rem; display: flex; align-items: center; gap: 3rem; max-width: 900px; margin: 0 auto; }
html[data-theme="light"] .kofi-box { border-color: rgba(0,155,179,0.22); }
.kofi-text { flex: 1; }
.kofi-badge { display: inline-block; background: var(--accent-dim); border: 1px solid var(--accent-glow); border-radius: 20px; color: var(--accent); font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.75rem; }
.kofi-emoji { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
.kofi-title { font-size: 1.6rem; font-weight: 700; color: var(--text); margin-bottom: 0.75rem; }
.kofi-desc { font-size: 0.95rem; color: var(--muted-2); line-height: 1.7; max-width: 420px; }
.kofi-action { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; flex-shrink: 0; }
.btn-kofi { background: #FF5E5B; color: #fff; font-size: 1.05rem; font-weight: 700; padding: 1rem 2.1rem; border-radius: 12px; white-space: nowrap; box-shadow: 0 4px 20px rgba(255,94,91,0.38); transition: opacity 0.2s, transform 0.2s; }
.btn-kofi:hover { opacity: 0.9; transform: translateY(-2px); }
.kofi-note { font-size: 0.8rem; color: var(--muted); text-align: center; }

footer { text-align: center; padding: 2rem 1.5rem 3rem; border-top: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 0.82rem; }
footer p { display: flex; align-items: center; justify-content: center; gap: 0.6rem; flex-wrap: wrap; }
footer a { color: var(--muted-2); }
footer a:hover { color: var(--accent); }
footer span { color: var(--border-hi); }

@media (max-width: 767px) {
  .kofi-box { flex-direction: column; padding: 2.5rem 1.5rem; text-align: center; gap: 2rem; }
  .kofi-desc { max-width: 100%; }
}
```

- [ ] **Step 4: Verify** — Ko-fi box has gradient background, red button, footer shows correctly

---

### Task 10: Reveal Animation CSS + JS, Mobile Responsive Polish

**Files:**
- Modify: `docs/index.html`

- [ ] **Step 1: Write reveal CSS**

```css
.reveal { opacity: 0; transform: translateY(32px); transition: opacity 0.55s ease, transform 0.55s ease; }
.reveal.visible { opacity: 1; transform: translateY(0); }
```

- [ ] **Step 2: Write reveal JS** (preserve from existing file)

```javascript
(function () {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
})();
```

- [ ] **Step 3: Add mobile responsive polishing CSS**

```css
@media (max-width: 519px) {
  .hero h1 { font-size: 1.9rem; }
  .kofi-box { padding: 2rem 1.25rem; }
}
```

- [ ] **Step 4: Final verification checklist**
  - [ ] Desktop: navbar sticky, all 5 links visible, pills + download button visible
  - [ ] Dark mode: all backgrounds match `--bg`, `--surface` etc.
  - [ ] Light mode: backgrounds match warm beige palette
  - [ ] Hero: video background plays, text readable
  - [ ] Features strip: 3 cards, hover border turns accent color
  - [ ] Visão Geral: centered text, 3 advantage cards below
  - [ ] Modo Clipboard: scroll through steps, image fades, dots update
  - [ ] Modo Captura: same
  - [ ] Google Drive Sync: same
  - [ ] Ko-fi: gradient box, red button
  - [ ] Footer: links work
  - [ ] Mobile < 768px: hamburger appears, features stack vertically, sticky split goes single column
  - [ ] Anchor links scroll to correct sections

- [ ] **Step 5: Commit**

```bash
git add docs/index.html
git add -f docs/superpowers/plans/2026-05-28-claritas-site-redesign.md
git commit -m "feat(site): full redesign — sticky navbar, hero, features strip, sticky split, visão geral"
```
