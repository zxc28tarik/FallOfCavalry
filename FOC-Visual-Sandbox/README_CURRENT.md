# Fall of Cavalry — Current Web RTS checkpoint (ZIP 9)

**Authoritative playable HTML:** `FOC-Visual-Sandbox/FallOfCavalry_PLAYABLE_RTS.html`  
**Source:** user-provided `Yeni Sıkıştırılmış Klasör (2)(9).zip` (26 November 2026).  
**HTML SHA-256:** `7001df5af12d97e0c21ac56a8b556b6237f2ca5897edb4ebf53df4eadcd9edf6`.

This directory is the active WebGL/HTML RTS continuation checkpoint. The repository's existing root web application and Unity repository are not replaced. Future development must apply to this HTML (or its intentionally extracted equivalent), preserving fixes already present. This checkpoint is not a claim that RC02/GFX-01 or the integrated-mesh character migration is finished.

## Source archives

- `archives/FOC_ZIP9_Source_2026-11-26.tar.xz` — source code, older stage working files, scripts and documentation (without screenshots).
- `archives/FOC_ZIP9_Clean_Complete.tar.xz.part00` through `part04` — reconstructable full clean archive, including screenshots and ancillary project files; excludes browser profile/session/cookie/credential caches, Python bytecode caches and temporary inspection page.
- Reconstruct full archive by concatenating parts in numeric order; original `tar.xz` SHA-256: `42678753f0bf376d65169453759e489fb90001685c77e04d42aa0c0309ce4944`.
- The original uploaded ZIP is not published because it contained `temp_chrome_profile` including files potentially containing browser sessions/cookies.

## Binding decisions for further work

- **No detachable/modular armor or weapons:** each equipment combination is a distinct fixed soldier archetype until the user explicitly changes this decision.
- **Create new visually continuous mesh-based bodies**, not recycled `makePart` primitive piles. Do not restore old models as the final answer.
- Every change belongs in the **actual playable HTML RTS**, not a standalone showcase or test scene.
- Preserve real gameplay and previously completed RC02 fixes; verify gameplay/render with real tests before declaring success.
- 24 fixed archetype keys exist in data, but fully integrated continuous 3D character meshes have **not** been verified as complete.

## Rebuild the archived source

```sh
cd FOC-Visual-Sandbox/archives
cat FOC_ZIP9_Clean_Complete.tar.xz.part?? > FOC_ZIP9_Clean_Complete.tar.xz
sha256sum FOC_ZIP9_Clean_Complete.tar.xz
tar -xJf FOC_ZIP9_Clean_Complete.tar.xz
```
