"""Maintenance-only: freeze engines in a fresh, stopped recovery clone.

Never run on a live database or the source volume. Changes only non-indexed
pause flags/generation in existing latest documents; all gameplay is retained.
"""
import json, sqlite3, sys

db = sqlite3.connect(sys.argv[1])
assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
metadata_id = bytes.fromhex('42E9A95FADF6B0E0EFB2D0A7101750D8')
tables = {}
for ident, value in db.execute('SELECT id,json_value FROM documents WHERE table_id=? AND deleted=0 ORDER BY ts', (metadata_id,)):
    item = json.loads(value)
    if item.get('state') == 'active': tables[item['name']] = ident
with db:
    for table in ['worldStatus', 'engines']:
        rows = db.execute('SELECT d.id,d.ts,d.json_value FROM documents d JOIN (SELECT id,MAX(ts) ts FROM documents WHERE table_id=? GROUP BY id) l ON d.id=l.id AND d.ts=l.ts WHERE d.table_id=? AND d.deleted=0', (tables[table], tables[table])).fetchall()
        assert len(rows) == 1, (table, len(rows))
        ident, ts, raw = rows[0]
        item = json.loads(raw)
        if table == 'worldStatus':
            assert item['worldId'] == 'm17egvyawz4s4ef1b2bfr9zbks8dgbce'
            item['status'] = 'stoppedByDeveloper'
        else:
            assert item['generationNumber'] in (41512, 41513)
            item['running'] = False
            item['generationNumber'] = 41513
        db.execute('UPDATE documents SET json_value=? WHERE table_id=? AND id=? AND ts=?', (json.dumps(item,separators=(',', ':')),tables[table],ident,ts))
        print(table, 'paused')
assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
db.close()
