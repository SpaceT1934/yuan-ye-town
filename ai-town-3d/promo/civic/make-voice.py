import asyncio, json, subprocess
from pathlib import Path
import edge_tts

ROOT=Path(__file__).resolve().parent
async def main():
    lines=json.loads((ROOT/'narration.json').read_text())
    output=ROOT/'voice';output.mkdir(exist_ok=True)
    offset=0
    for line in lines:
        line['offset']=offset;line['start']=offset+.55;line['end']=offset+line['length']-.55
        target=output/line.get('file',line['shot']+'.mp3')
        for attempt in range(3):
            try:
                if not target.exists() or target.stat().st_size<1000:
                    await edge_tts.Communicate(line['text'],'zh-CN-YunxiNeural',rate='-5%').save(str(target))
                break
            except Exception:
                if attempt==2:raise
                await asyncio.sleep(1)
        duration=float(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(target)]))
        line['duration']=duration;line['tempo']=max(1,duration/(line['end']-line['start']))
        if line['tempo']>1.2:raise RuntimeError(f"Narration too long; shorten text: {line['shot']} {line['tempo']}")
        print(line['shot'],duration,line['tempo'],flush=True);offset+=line['length']-.5
    (ROOT/'timing.json').write_text(json.dumps(lines,ensure_ascii=False,indent=2))
asyncio.run(main())
