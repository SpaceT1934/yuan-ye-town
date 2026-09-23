from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'promo/face-audit')
names=json.loads((root/'names.json').read_text());font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',20)
for half in range(2):
    sheet=Image.new('RGB',(1200,4*440),'#182323');draw=ImageDraw.Draw(sheet)
    for row,i in enumerate(range(half*4,min(half*4+4,len(names)))):
        for col,mode in enumerate(['idle-0','walk-0','walk-0.65']):
            im=Image.open(root/f'{i}-{mode}.png').resize((400,400));sheet.paste(im,(col*400,row*440));draw.text((col*400+12,row*440+408),names[i]+' · '+mode,font=font,fill='white')
    sheet.save(root/f'sheet-{half}.jpg')
