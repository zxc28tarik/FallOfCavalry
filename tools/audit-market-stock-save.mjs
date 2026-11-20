#!/usr/bin/env node
/**
 * Read-only V1.29 market stock audit.
 * node tools/audit-market-stock-save.mjs --input path/to/save.json
 * node tools/audit-market-stock-save.mjs --input save.json --output audit.csv
 *
 * It never edits the input file, never loads a save into gameplay and never
 * chooses which historical ledger is authoritative.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TRADE_ITEMS } from '../js/constants.js';
import {
  auditSavedMarketStocks, marketStockAuditCsv,
} from '../js/systems/market-stock-audit.js';

const option = key => {
  const i = process.argv.indexOf(key);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
};
const input = option('--input');
if (!input) {
  console.error('Usage: node tools/audit-market-stock-save.mjs --input save.json [--output audit.csv] [--all]');
  process.exitCode = 2;
} else {
  try {
    const document = JSON.parse(readFileSync(resolve(input), 'utf8'));
    const snapshot = document?.data?.game ? document.data : document;
    if (!snapshot?.game || typeof snapshot.game !== 'object') {
      throw new Error('Expected a save payload with game.settlementsMarkets and game.markets');
    }
    const result = auditSavedMarketStocks(snapshot, TRADE_ITEMS);
    const csv = marketStockAuditCsv(result, {
      conflictsOnly: !process.argv.includes('--all'),
    });
    const output = option('--output');
    if (output) writeFileSync(resolve(output), csv);
    else process.stdout.write(csv);
    console.error('[market-stock-audit] '+JSON.stringify({
      readOnly: result.readOnly, cityLedgers: result.settlementCount,
      itemRows: result.rowCount, counts: result.counts,
      output: output ? resolve(output) : 'stdout',
    }));
  } catch (error) {
    console.error('[market-stock-audit] ERROR '+String(error));
    process.exitCode = 1;
  }
}
