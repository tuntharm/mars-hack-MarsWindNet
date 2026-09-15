# ML briefing gallery (standalone)

Static HTML. **Not imported by the React app.** Do not add a route in `src/` unless Tharm asks Codex to integrate it.

## Location

| What | Path |
| --- | --- |
| Page | [`public/ml-gallery/index.html`](index.html) |
| Plots | [`public/ml-gallery/plots/`](plots/) |
| Dev URL | http://127.0.0.1:5173/ml-gallery/index.html (use this exact path; `/ml-gallery/` is the SPA) |
| File URL | open `index.html` directly |

Vite serves everything under `public/` as static files. The main city demo stays at `/`.

## For Codex

1. Leave `src/App.tsx` and city/3D routes alone unless explicitly integrating.
2. To hang this off the main site later: link to `/ml-gallery/` or iframe this folder. Copy captions from `index.html` talk-order sections 01–05.
3. Images are copies of `ML/reports/*.png`. Regenerate reports with `python -m marswindnet_ml.plot_sim_style` then recopy into `plots/` if figures change.
