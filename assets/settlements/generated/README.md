# Settlement Sprite Drop Zone

Place prompt-generated transparent PNG sprites here.

Priority order used by the renderer:

1. `assets/settlements/generated/factions/<faction>/<type>.png`
2. `assets/settlements/generated/<faction>-<type>.png`
3. `assets/settlements/generated/<type>.png`

`<type>` values:

- `city`
- `town`
- `fort`
- `village`

`<faction>` values should match ids like:

- `ottoman`
- `hre`
- `polish`
- `spanish`
- `venice`
- `bandit`

Technical rules:

- Format: `PNG` with alpha.
- Background: fully transparent.
- Sprite only: no grass, no trees, no terrain tile, no sky.
- Keep baked light from top-left for consistency.

