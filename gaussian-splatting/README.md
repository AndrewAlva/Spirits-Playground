# Gaussian Splatting Demo

A 3D Gaussian Splatting renderer built with [Spark](https://github.com/sparkjsdev/spark) and Three.js, running entirely in the browser with no build step.

## Running locally

Clone the repo and navigate to this folder:

```bash
git clone https://github.com/AndrewAlva/Spirits-Playground.git
cd Spirits-Playground/gaussian-splatting
```

Serve it with any static file server — required because the demo uses ES module import maps:

```bash
# Option A: Node.js
npx serve .

# Option B: Python
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

## Controls

| Input | Action |
|---|---|
| Left-drag | Orbit |
| Scroll | Zoom |
| Right-drag | Pan |

## How it works

- **Spark** (`@sparkjsdev/spark`) handles splat loading, per-frame depth sorting, and compositing on top of Three.js
- The scene loads a `.spz` splat file (Spark's compressed Gaussian Splatting format) directly from Spark's CDN
- `OrbitControls` from Three.js provides the camera navigation
- All dependencies are loaded via CDN import maps — no `npm install` needed
