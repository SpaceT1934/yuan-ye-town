"""Read a cold copy of Convex SQLite; never start the backend or modify its DB."""
import sqlite3, json, base64, struct, sys
from pathlib import Path

db, destination = sys.argv[1:]
connection = sqlite3.connect('file:' + db + '?mode=ro', uri=True)
connection.execute('PRAGMA query_only=ON')
def decode(value):
    if isinstance(value, list): return [decode(item) for item in value]
    if isinstance(value, dict):
        if set(value) == {'$integer'}: return int.from_bytes(base64.b64decode(value['$integer']), 'little', signed=True)
        if set(value) == {'$float'}: return struct.unpack('<d',base64.b64decode(value['$float']))[0]
        return {key:decode(item) for key,item in value.items()}
    return value
def latest(table_id):
    return [decode(json.loads(row[0])) for row in connection.execute('''
      SELECT d.json_value FROM documents d JOIN
      (SELECT id, MAX(ts) ts FROM documents WHERE table_id=? GROUP BY id) latest
      ON d.id=latest.id AND d.ts=latest.ts
      WHERE d.table_id=? AND d.deleted=0 AND d.json_value IS NOT NULL
    ''', (table_id, table_id))]
metadata_id = bytes.fromhex('42E9A95FADF6B0E0EFB2D0A7101750D8')
metadata = {}
for raw_id, raw_json in connection.execute('SELECT id,json_value FROM documents WHERE table_id=? AND deleted=0 ORDER BY ts', (metadata_id,)):
    item=json.loads(raw_json)
    if item.get('state')=='active': metadata[item['name']]=raw_id
tables=['worlds','maps','playerDescriptions','agentDescriptions','societyResidents','societyWorlds','societyRelationships','societyLaws','societyEvents','engines','worldStatus']
result={'source':'PCUbuntu paused SQLite copy; original DB read-only', 'tables':{name:latest(metadata[name]) for name in tables}}
memories=latest(metadata['memories'])
result['memorySummaries']={}
for memory in memories:
    p=memory['playerId']; result['memorySummaries'].setdefault(p,[]).append(memory)
for p, items in result['memorySummaries'].items():
    items.sort(key=lambda x:x['_creationTime'],reverse=True)
    result['memorySummaries'][p]={'count':len(items),'reflections':sum(m.get('data',{}).get('type')=='reflection' for m in items),'recent':[{k:m.get(k) for k in ['description','importance','_creationTime','data']} for m in items[:5]]}
Path(destination).write_text(json.dumps(result,ensure_ascii=False,allow_nan=False),encoding='utf-8')
print(json.dumps({name:len(rows) for name,rows in result['tables'].items()}))
connection.close()
