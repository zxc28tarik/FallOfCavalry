#!/usr/bin/env python3
"""Offline validation only; no source repository changes."""
import json,collections
from pathlib import Path
p=Path(__file__).resolve().parent
j=json.loads((p/'02_GOREV_VERITABANI.json').read_text(encoding='utf-8'))
tasks=j['tasks']; phases=j['phases']; m={x['id']:x for x in tasks}
assert len(m)==len(tasks),'duplicate task id'
assert len(phases)==15,'expected 15 phases'
assert sum(x['id'].endswith('-GATE') for x in tasks)==15,'stage gate count'
assert len(tasks)==215,'expected 215 tasks + gates'
assert sum(x['id'].startswith('G14-') for x in tasks)>0
assert all(set(x['dependencies']).issubset(m) for x in tasks)
assert all(x['id'] not in x['dependencies'] for x in tasks)
assert all(x['status']=='EN_SON_BLOKLU' for x in tasks if x['id'].startswith('G14-'))
assert all(x['status']=='PLANLANDI' for x in tasks if not x['id'].startswith('G14-'))
assert all(x['deliverable'] and x['acceptance'] and x['owner'] for x in tasks)
state={};topo=[]
def visit(u):
 if state.get(u)==1: raise AssertionError('cycle '+u)
 if state.get(u)==2: return
 state[u]=1
 for v in m[u]['dependencies']:visit(v)
 state[u]=2;topo.append(u)
for u in m:visit(u)
assert topo.index('G13-GATE')<topo.index('G14-01')
for x in phases:
 gate=x['gate_id']
 assert gate in m
 stage=[u for u in tasks if u['phase']==x['code'] and u['id']!=gate]
 assert set(u['id'] for u in stage)==set(m[gate]['dependencies'])
print('VALID: 15 phases, 200 work tasks + 15 gates = 215 rows, unique IDs, valid dependencies, DAG, soldiers last and blocked; no task falsely completed.')
