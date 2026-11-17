# FallOfCavalry Web — Agent Working Rules

This file applies to the **web game repository** `zxc28tarik/FallOfCavalry` only. The Unity desktop game is a separate repository and MUST NOT be edited or treated as the same project without explicit user authorization.

## Mandatory GitHub persistence for planning
- The user requires **every new or revised project plan, roadmap, progress tree, Markdown decision record, technical audit, QA checklist, work-order, and comparable planning artifact to be saved to this GitHub repository** during the same task as its creation.
- Use `docs/plans/` for versioned plans and update `docs/plans/README.md` when a plan is added or superseded. Use the relevant existing domain directory for active long-lived development logs.
- Commit source files (`.md`, `.csv`, `.json`, relevant scripts) rather than keeping the only copy in a chat, ZIP, or sandbox link. If an editable binary companion cannot be uploaded, commit its structured source and disclose the exception.
- A file is NOT considered GitHub-saved until a real commit is reachable from the repository, preferably the default branch after any PR merge. Always verify the result and provide a commit or PR URL.
- Do not say “saved to GitHub” if the document exists only locally, in a tool workspace, or on an unmerged branch. If GitHub is unavailable, say so explicitly and keep the local files for recovery.
- Keep an audit trail: source date, scope, status, decisions vs proposals, dependencies, acceptance criteria, and evidence. Do not silently overwrite an approved user decision. Review user-facing architecture decisions with the user before marking them approved.

## Visual work decisions
- Visual rebuild is **new 2D artwork from scratch** for terrain, environment, map objects, villages, cities, castles, battle backgrounds, UI and effects; no 3D workflow.
- **Soldier visuals are the final visual phase** and must not be started before the prerequisite visual gates and user approval.
- Existing gameplay data and saves should be preserved; old artwork may remain as temporary placeholders.
- User delivers/approves 2D art. Agents provide technical integration and QA in the web repository.
- Do not start bulk artwork generation or alter game architecture merely because a plan mentions it.

## Development discipline
- Check actual current `main` HEAD before changes. Use small focused branches/PRs when appropriate; do not touch Unity or unrelated repositories.
- Mark a task DONE only with reproducible code, test/evidence and recorded commit; otherwise distinguish PLANNED, IN PROGRESS and BLOCKED.
- Update the relevant plan/task table and commit that update with the implementation; keep documentation and implementation synchronized.

## Repository hygiene
- Never commit scratch artifacts under `output/`, `tmp/`, `screenshots/`, `.vite/`, Python caches or devserver logs.
- Keep executable validation scripts in `tools/` or `scripts/` rather than ignored scratch folders.
- When cleaning, classify each candidate by usage and source provenance, preserve unique user-provided material, and document exact removal/restore steps under `docs/plans/`.
- Do not delete shared/duplicate Git refs without exact SHA matching, PR/dependency checks, and clear authorization. Unity's canonical repository must remain untouched.

## Retired legacy renderer and external asset handling
- The retired `CanvasRenderer`/old `MapRenderer`/old `SpriteGenerator` lineage and vendor-derived `assets/settlements`, `assets/stronghold` and `homm3-map-art.json` must not be silently reintroduced.
- The browser game's current authoritative rendering entrypoint is `js/managers/RenderManager.js` (legacy-world fallback modules remain active). New 2D art should be original and integrated according to `docs/plans/2d-visual-rebuild-v1/`.
- When removing more modules/assets, first verify active runtime imports, test references, runtime string paths, source provenance and rollbacks; retain historical planning documents.
