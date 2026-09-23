"""Generate audition clips only; never changes the movie or the running town."""
import asyncio,json
from pathlib import Path
import edge_tts

TEXT='这里是原野小镇。一次偶然的相遇，也许就会改变两个人的故事。有人忙着交易，有人参与选举，也有人为了新的法律争论不休。而他们的每一次选择，都会留在这个世界的记忆里。'
VOICES=[('01-晓晓-女声','zh-CN-XiaoxiaoNeural'),('02-晓伊-女声','zh-CN-XiaoyiNeural'),('03-云希-男声','zh-CN-YunxiNeural'),('04-云扬-男声','zh-CN-YunyangNeural')]
async def main():
    out=Path(__file__).parent/'voice-auditions';out.mkdir(exist_ok=True)
    async def make(label,voice):
        target=out/(label+'.mp3')
        if target.exists() and target.stat().st_size>10000:return
        await edge_tts.Communicate(TEXT,voice,rate='-5%').save(str(target))
        print(label,'done',flush=True)
    await asyncio.gather(*(make(*v) for v in VOICES))
    (out/'manifest.json').write_text(json.dumps({'text':TEXT,'rate':'-5%','voices':VOICES,'type':'synthetic neural voice auditions; no music'},ensure_ascii=False,indent=2))
asyncio.run(main())
