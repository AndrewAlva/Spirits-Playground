# Gaussian Splatting Demo

A 3D Gaussian Splatting renderer built with [Spark](https://github.com/sparkjsdev/spark) and Three.js, running entirely in the browser.

Two versions are available:
- **`index.html`** — zero-dependency, CDN-based, single file
- **`src/pages/index.astro`** — Astro version, npm-based, Vite-bundled

---

## Option A — Plain HTML (no build step)

Just serve the file with any static server:

```bash
git clone https://github.com/AndrewAlva/Spirits-Playground.git
cd Spirits-Playground/gaussian-splatting

# Node.js
npx serve .

# or Python
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

You can also deploy `index.html` directly to any static host (Netlify drag-and-drop, GitHub Pages, Vercel, etc.) with no configuration — all dependencies load from CDN.

---

## Option B — Astro (npm)

```bash
git clone https://github.com/AndrewAlva/Spirits-Playground.git
cd Spirits-Playground/gaussian-splatting

npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

### Build for production

```bash
npm run build   # outputs to dist/
npm run preview # preview the production build locally
```

The `dist/` folder is a fully static site — deploy it anywhere.

---

## Controls

| Input | Action |
|---|---|
| Left-drag | Orbit |
| Scroll | Zoom |
| Right-drag | Pan |

## How it works

- **Spark** (`@sparkjsdev/spark`) handles splat loading, per-frame depth sorting, and compositing on top of Three.js
- The scene loads a `.spz` splat file (Spark's compressed Gaussian Splatting format) from Spark's CDN
- `OrbitControls` from Three.js provides camera navigation
- In the plain HTML version, all dependencies are loaded via a CDN import map
- In the Astro version, Vite bundles the npm packages at build time
