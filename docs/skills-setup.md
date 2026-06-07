# FallOfCavalry Skill Setup

Project-specific Claude Code skills are kept local under `.claude/skills/`.
That directory is intentionally ignored by git, so these skills must be
recreated when moving to a new machine or fresh checkout.

## Installed local skills

| Skill | Purpose |
|-------|---------|
| `foc-rendering-pipeline` | Active renderer map, dimetric rendering rules, settlement/terrain pitfalls |
| `foc-validation` | Required validation flow and known acceptable warnings |
| `foc-worldgen` | `generateMapData()` pipeline, settlement placement, MapData rules |
| `foc-architecture` | Manager init order, GameState conventions, project navigation |

## Expected layout

```text
.claude/skills/
  foc-rendering-pipeline/SKILL.md
  foc-validation/SKILL.md
  foc-worldgen/SKILL.md
  foc-architecture/SKILL.md
```

## Reinstall

Create each directory under `.claude/skills/` and place the corresponding
`SKILL.md` file inside it:

```powershell
New-Item -ItemType Directory -Force -Path .claude\skills\foc-rendering-pipeline
New-Item -ItemType Directory -Force -Path .claude\skills\foc-validation
New-Item -ItemType Directory -Force -Path .claude\skills\foc-worldgen
New-Item -ItemType Directory -Force -Path .claude\skills\foc-architecture
```

After reinstalling, run:

```powershell
npm.cmd run validate:static
```

## Notes

- Keep skill bodies concise. Put stable project guardrails in skills, not full
  historical progress logs.
- Keep `CLAUDE.md` as the lightweight always-loaded project guide.
- Keep long historical session notes in `progress.md` or archived docs.
