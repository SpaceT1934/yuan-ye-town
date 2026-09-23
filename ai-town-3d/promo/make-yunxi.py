import asyncio,json,subprocess
from pathlib import Path
import edge_tts

ROOT=Path(__file__).resolve().parent
async def main():
    lines=json.loads((ROOT/'narration.json').read_text());out=ROOT/'voice-yunxi';out.mkdir(exist_ok=True)
    lines[2]['text']='各自的身份、关系和目标，影响着居民新的选择。'
    lines[6]['text']='市长定期改选，声望、信任与经济影响结果。'
    sem=asyncio.Semaphore(2)
    async def make(i,line):
        async with sem:
            line['file']=f'{i}-concise.mp3' if i in (2,6) else f'{i}.mp3'
            target=out/line['file']
            for attempt in range(3):
                try:
                    if not target.exists() or target.stat().st_size<1000:
                        await edge_tts.Communicate(line['text'],'zh-CN-YunxiNeural',rate='-5%').save(str(target))
                    break
                except Exception:
                    if attempt==2:raise
                    await asyncio.sleep(1)
            duration=float(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(target)]))
            line['duration']=duration;line['tempo']=max(1,duration/(line['end']-line['start']-.15))
            print(i,duration,round(line['tempo'],3),flush=True)
    await asyncio.gather(*(make(i,line) for i,line in enumerate(lines)))
    (out/'timing.json').write_text(json.dumps(lines,ensure_ascii=False,indent=2))
asyncio.run(main())
