# MarsWindNet environment assets

Generated on 15 September 2026 using the built-in OpenAI image generation tool. These images are authored illustrations, not NASA images, measured terrain, a real site, CFD output, or structural-analysis results. Originals remain in the generation directory; selected outputs were copied without modifying their pixels.

| Asset | Original output | Dimensions | Usage |
| --- | --- | --- | --- |
| `mars-panorama.png` | `exec-6f3676d4-84da-4780-baf9-925ae3f60bc2.png` | 2161 × 728 | Page atmosphere only. The lateral illumination and ridges do not join into a 360° environment, so it is intentionally not wrapped around the 3D scene. |
| `regolith-albedo.png` | `exec-d12d7d27-52c5-48e4-9fd4-de18ef637602.png` | 1254 × 1254 | Ground colour map. Mirrored repeat avoids hard sampling discontinuities; lighting, shadows and decorative micro-bump are calculated separately. |

The generated outputs used by the app are included beside this document. Original generation identifiers are retained above for provenance.

The 3D environment uses procedural sky/haze and a deterministic terrain height field. The analytical 0–500 m × 0–500 m region and a 100 m surrounding margin remain geometrically flat. Distant relief, sky colour, material detail and page imagery are visual presentation and are excluded from the CFD mask. Neither asset contains buildings, people, vehicles, text or logos.

## Panorama prompt

Use case: photorealistic-natural. Asset type: environmental panorama for a realistic interactive Mars settlement visualisation, not a standalone city picture. Generate a wide 3:1 panoramic landscape photograph of Mars with a vivid iron-oxide red regolith plain, distant irregular eroded mesas and low ridges, and a dusty copper-red atmospheric sky. The landscape must feel real and immense, with weathered geological strata and subtle atmospheric depth, not a game or low-poly scene. Horizon at approximately 55 percent down the image; upper region mostly uncluttered russet/copper sky, gently luminous near the horizon. Low warm sun illumination from image upper-left but NO visible solar disk and NO lens flare; moderate soft contrast so it can complement a separately lit 3D scene. Keep the central lower foreground quiet, flat, low-contrast and free of prominent rocks. This is environment only: absolutely NO buildings, domes, solar panels, landing pads, people, vehicles, sensors, artificial lights, grids, captions, logos, symbols or typography. No gigantic dust wall, no mountains shaped like simple pyramids, no blue Earth sky, no glossy CGI finish. Natural geological realism, detailed but restrained colours. Make the left and right sky colours compatible for use as a wide backdrop; it is not a survey or scientific measurement.

## Regolith prompt

Use case: photorealistic-natural. Asset type: seamless square albedo colour texture for the ground of a 3D Martian settlement. Generate a straight-down orthographic macro photograph of dry iron-oxide Mars regolith: warm rust-red and burnt-sienna fine dust, tiny granular grit, softly varying mineral flecks and a very subtle natural mottled pattern. It should represent roughly a 4 metre by 4 metre patch of mostly compact fine soil, absolutely no large stones or distinct landmarks. Tile seamlessly on all four edges, evenly distributed detail without a central subject and without repeated obvious motifs. Flat diffuse illumination, pure surface base colour, NO directional lighting, NO cast shadows, NO ambient occlusion baked into image, NO highlights or vignetting, NO perspective or horizon. The texture will receive real lighting and shadows in Three.js; do not pre-light it. Balanced midtone albedo, iron-oxide red-brown rather than orange sand or saturated crimson. No rocks larger than small grit, no plants, no footprints, no vehicle tracks, no cracks crossing the whole tile, no manmade objects, no text, logos, symbols or borders. High-resolution realistic PBR colour texture, square 1024 by 1024 if possible.

## Inspection

Both outputs were visually inspected. The panorama has natural-looking rock formations and a clear central foreground; it is suitable as a page backdrop. Its edges are not compatible with seamless 360° use. The albedo is a fairly even granular red-brown surface; any residual generated colour variation is illustrative. Rendered asset loading and combined scene acceptance are checked separately in the browser.
