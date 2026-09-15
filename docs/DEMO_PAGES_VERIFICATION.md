# Demo page integration — 15 September 2026

Preview: https://marswindnet-bwejujgi6-tharm-s-projects.vercel.app

- Copied all 13 source sensor files byte-for-byte into `public/sensor/`.
- Hero secondary action is now **Meet the sensor**, same-tab `/sensor/`, retaining its styling.
- Masthead links **View model results** to `/ml-gallery/index.html`.
- Removed the custom wind panel and live generation actions from this release. Existing illustrative city, scenarios, saved comparisons, monitoring and presentation modes remain.
- Added static sensor directory routing to Vite development/preview and Vercel. Included the results gallery in deployment.
- Preserved the supplied sensor and gallery contents. Build output was checked byte-for-byte against both public folders.

## Verification

149 regression tests passed. Lint and production build passed. The existing large Three.js chunk warning remains.

Browser checks through the main app and Vercel preview confirmed hero navigation, loaded sensor images, a working WebGL sensor model, rotation, component selection and deployment folding. Desktop 1440×900 and mobile 390×844 were inspected; mobile sensor layout has no horizontal overflow. All 12 gallery plots loaded locally and on Vercel. The gallery and sensor page both fit 390 px without horizontal overflow.

Hosted model work is deferred. Prepared gateway/service code remains in the repository, but this release uses direct static results links. No trained full-field inference or physical hardware validation is claimed.

## Integration files

- `src/App.tsx`, `src/components/VideoHero.tsx`, `src/components/Controls.tsx`
- `src/state/useMarsWindNet.ts` (allows the app to choose its initial illustrative scenario)
- `src/App.interaction.test.tsx`, `src/components/VideoHero.test.tsx`
- `vite.config.ts`, `vercel.json`, `.vercelignore`, `.oxlintrc.json`
- `public/sensor/**`, `public/ml-gallery/**`
- `README.md`, `docs/HOSTED_INFERENCE.md`
