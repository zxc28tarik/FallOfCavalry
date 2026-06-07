/**
 * Modular Atlas Frame Validator
 *
 * Validates that layered render outputs from Blender follow the expected
 * directory structure and frame synchronization rules.
 *
 * Usage:
 *   node scripts/validate-modular-atlas-frames.js [rootPath]
 *
 * Default rootPath: renders/
 *
 * Expected structure:
 *   <root>/<unitId>/<layerId>/<action>/<direction>/<frame>.png
 *
 * Exit 0 = pass, Exit 1 = fail
 */

import fs from 'node:fs';
import path from 'node:path';

// ── PNG header reader (no dependency needed for dimensions) ──────────────────

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readPngDimensions(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(24);
    const bytesRead = fs.readSync(fd, header, 0, 24, 0);
    if (bytesRead < 24) return null;
    if (!header.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
    const width = header.readUInt32BE(16);
    const height = header.readUInt32BE(20);
    return { width, height };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// ── Frame name validation ────────────────────────────────────────────────────

const FRAME_PATTERN = /^(\d{4})\.png$/;

function isValidFrameName(name) {
  return FRAME_PATTERN.test(name);
}

function getFrameNumber(name) {
  const m = name.match(FRAME_PATTERN);
  return m ? parseInt(m[1], 10) : -1;
}

// ── Directory helpers ────────────────────────────────────────────────────────

function listDirs(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
}

function listFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(d => d.isFile())
    .map(d => d.name)
    .sort();
}

// ── Main validation ──────────────────────────────────────────────────────────

function validate(rootPath) {
  const errors = [];
  const stats = {
    units: 0,
    layers: 0,
    actions: new Set(),
    directions: new Set(),
    totalFrames: 0,
  };

  if (!fs.existsSync(rootPath)) {
    console.error(`\n[ERROR] Root path does not exist: ${rootPath}`);
    console.error('  Beklenen yapı: renders/<unitId>/<layerId>/<action>/<direction>/<frame>.png');
    console.error('  Henüz asset gelmemiş olabilir — renders/ klasörünü oluşturun.\n');
    process.exit(1);
  }

  const units = listDirs(rootPath);
  if (units.length === 0) {
    console.error(`\n[ERROR] No unit directories found in: ${rootPath}`);
    console.error('  Beklenen: renders/azap_01/, renders/sipahi_01/ vb.\n');
    process.exit(1);
  }

  for (const unitId of units) {
    stats.units++;
    const unitPath = path.join(rootPath, unitId);
    const layers = listDirs(unitPath);

    if (layers.length === 0) {
      errors.push(`unit=${unitId} — no layer directories found (empty unit folder)`);
      continue;
    }

    // Collect all actions and directions across layers for cross-check
    // Structure: actionDirFrames[action][direction][layer] = frameNames[]
    const actionDirFrames = {};

    for (const layerId of layers) {
      stats.layers++;
      const layerPath = path.join(unitPath, layerId);
      const actions = listDirs(layerPath);

      if (actions.length === 0) {
        errors.push(`unit=${unitId} layer=${layerId} — no action directories found (empty layer folder)`);
        continue;
      }

      for (const action of actions) {
        stats.actions.add(action);
        const actionPath = path.join(layerPath, action);
        const directions = listDirs(actionPath);

        if (directions.length === 0) {
          errors.push(`unit=${unitId} layer=${layerId} action=${action} — no direction directories found`);
          continue;
        }

        for (const direction of directions) {
          stats.directions.add(direction);
          const dirPath = path.join(layerPath, action, direction);
          const files = listFiles(dirPath);

          if (files.length === 0) {
            errors.push(`unit=${unitId} layer=${layerId} action=${action} direction=${direction} — empty directory (no frames)`);
            continue;
          }

          // Validate frame names
          const validFrames = [];
          for (const file of files) {
            if (!file.endsWith('.png')) continue; // ignore non-png silently
            if (!isValidFrameName(file)) {
              errors.push(`unit=${unitId} layer=${layerId} action=${action} direction=${direction} — invalid frame name: ${file}`);
            } else {
              validFrames.push(file);
            }
          }

          // Check sequential numbering
          const frameNumbers = validFrames.map(getFrameNumber).sort((a, b) => a - b);
          for (let i = 0; i < frameNumbers.length; i++) {
            if (frameNumbers[i] !== i) {
              const expected = String(i).padStart(4, '0') + '.png';
              errors.push(`unit=${unitId} layer=${layerId} action=${action} direction=${direction} — gap in sequence: expected ${expected} at position ${i}`);
              break;
            }
          }

          stats.totalFrames += validFrames.length;

          // Store for cross-layer comparison
          if (!actionDirFrames[action]) actionDirFrames[action] = {};
          if (!actionDirFrames[action][direction]) actionDirFrames[action][direction] = {};
          actionDirFrames[action][direction][layerId] = validFrames;
        }
      }
    }

    // ── Cross-layer synchronization checks ──────────────────────────────────

    // Check that all layers have the same set of actions
    const allActions = Object.keys(actionDirFrames).sort();
    const layerActions = {};
    for (const layerId of layers) {
      const layerPath = path.join(unitPath, layerId);
      layerActions[layerId] = listDirs(layerPath).sort();
    }
    for (const layerId of layers) {
      const la = layerActions[layerId];
      if (!la || la.length === 0) continue;
      for (const action of allActions) {
        if (!la.includes(action)) {
          errors.push(`unit=${unitId} layer=${layerId} — missing action: ${action} (other layers have it)`);
        }
      }
    }

    // Check direction consistency and frame count per action+direction
    for (const action of allActions) {
      const dirMap = actionDirFrames[action];
      if (!dirMap) continue;
      const allDirs = Object.keys(dirMap).sort();

      // Check all layers have same directions for this action
      for (const direction of allDirs) {
        const layerFrameMap = dirMap[direction];
        const presentLayers = Object.keys(layerFrameMap);

        // Find reference frame count (from first layer that has frames)
        let refLayer = null;
        let refFrames = null;
        for (const lid of presentLayers) {
          if (layerFrameMap[lid].length > 0) {
            refLayer = lid;
            refFrames = layerFrameMap[lid];
            break;
          }
        }
        if (!refFrames) continue;

        const refCount = refFrames.length;
        const refSet = new Set(refFrames);

        for (const lid of presentLayers) {
          if (lid === refLayer) continue;
          const frames = layerFrameMap[lid];

          // Frame count mismatch
          if (frames.length !== refCount) {
            errors.push(
              `unit=${unitId} action=${action} direction=${direction} layer=${lid} — ` +
              `frame count mismatch: expected=${refCount} actual=${frames.length}`
            );
          }

          // Missing specific frames
          for (const refFrame of refFrames) {
            if (!frames.includes(refFrame)) {
              errors.push(
                `unit=${unitId} action=${action} direction=${direction} layer=${lid} — ` +
                `missing frame: ${refFrame}`
              );
            }
          }

          // Extra frames not in reference
          for (const frame of frames) {
            if (!refSet.has(frame)) {
              errors.push(
                `unit=${unitId} action=${action} direction=${direction} layer=${lid} — ` +
                `extra frame: ${frame} (not in reference layer ${refLayer})`
              );
            }
          }
        }
      }

      // Check missing directions across layers
      for (const layerId of layers) {
        const layerPath = path.join(unitPath, layerId, action);
        if (!fs.existsSync(layerPath)) continue;
        const layerDirs = listDirs(layerPath).sort();
        for (const dir of allDirs) {
          if (!layerDirs.includes(dir)) {
            errors.push(
              `unit=${unitId} action=${action} layer=${layerId} — ` +
              `missing direction: ${dir} (other layers have it)`
            );
          }
        }
      }
    }

    // ── PNG dimension consistency check ─────────────────────────────────────

    // For each unit, check that all frames share the same dimensions
    let unitDimension = null;
    let unitDimFile = null;

    for (const layerId of layers) {
      const layerPath = path.join(unitPath, layerId);
      const actions = listDirs(layerPath);
      for (const action of actions) {
        const actionPath = path.join(layerPath, action);
        const directions = listDirs(actionPath);
        for (const direction of directions) {
          const dirPath = path.join(layerPath, action, direction);
          const files = listFiles(dirPath).filter(f => isValidFrameName(f));
          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const dim = readPngDimensions(filePath);
            if (!dim) continue;
            if (!unitDimension) {
              unitDimension = dim;
              unitDimFile = path.relative(rootPath, filePath);
            } else if (dim.width !== unitDimension.width || dim.height !== unitDimension.height) {
              const relPath = path.relative(rootPath, filePath);
              errors.push(
                `unit=${unitId} — dimension mismatch: ${relPath} is ${dim.width}×${dim.height}, ` +
                `expected ${unitDimension.width}×${unitDimension.height} (reference: ${unitDimFile})`
              );
              // Only report first mismatch per unit to avoid flood
              break;
            }
          }
        }
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────

  console.log('');
  if (errors.length === 0) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  MODULAR FRAME VALIDATION PASSED ✅');
    console.log('═══════════════════════════════════════════════════════');
  } else {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  MODULAR FRAME VALIDATION FAILED ❌');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    for (const err of errors) {
      console.log(`  [ERROR] ${err}`);
    }
  }

  console.log('');
  console.log(`  Units checked:      ${stats.units}`);
  console.log(`  Layers checked:     ${stats.layers}`);
  console.log(`  Actions checked:    ${[...stats.actions].sort().join(', ') || '(none)'}`);
  console.log(`  Directions checked: ${[...stats.directions].sort().join(', ') || '(none)'}`);
  console.log(`  Total PNG frames:   ${stats.totalFrames}`);
  if (errors.length > 0) {
    console.log(`  Errors:             ${errors.length}`);
  }
  console.log('');

  return errors.length === 0 ? 0 : 1;
}

// ── Entry point ──────────────────────────────────────────────────────────────

const rootArg = process.argv[2] || 'renders';
const rootPath = path.resolve(rootArg);

console.log(`\nValidating modular atlas frames in: ${rootPath}`);
const exitCode = validate(rootPath);
process.exit(exitCode);
