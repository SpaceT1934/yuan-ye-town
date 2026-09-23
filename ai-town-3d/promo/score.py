"""Original procedural instrumental score; no sampled recordings."""
import numpy as np
import wave
from pathlib import Path
sr=44100;duration=61;beat=.625
mix=np.zeros((int(sr*duration),2),np.float32)
rng=np.random.default_rng(1934)
def add(midi,start,length,gain=.1,kind='bell',pan=0):
    n=int(length*sr);t=np.arange(n)/sr;f=440*2**((midi-69)/12)
    if kind=='pad':
        sig=sum(np.sin(2*np.pi*f*r*t)*a for r,a in [(1,.6),(1.002,.22),(2,.12),(3,.05)])
        env=np.minimum(t/.7,1)*np.minimum((length-t)/1.0,1)
    elif kind=='bass':
        sig=np.sin(2*np.pi*f*t)+.15*np.sin(4*np.pi*f*t);env=np.minimum(t/.015,1)*np.exp(-t*2)
    else:
        sig=np.sin(2*np.pi*f*t)+.26*np.sin(2*np.pi*f*2*t)*np.exp(-t*3)+.08*np.sin(2*np.pi*f*3*t)
        env=np.minimum(t/.008,1)*np.exp(-t*2.8)*np.minimum((length-t)/.06,1)
    y=(sig*env*gain).astype(np.float32);i=int(start*sr);end=min(i+n,len(mix));y=y[:end-i]
    if len(y):mix[i:end,0]+=y*np.sqrt((1-pan)/2);mix[i:end,1]+=y*np.sqrt((1+pan)/2)
chords=[[47,54,59,62,66],[43,50,55,59,62],[38,50,57,62,66],[45,52,57,61,64]]
melody=[74,73,71,66,69,71,74,78,76,74,73,69,71,74,73,71]
for bar in range(24):
    start=bar*2.5;ch=chords[bar%4]
    for j,note in enumerate(ch[1:]):add(note,start,3.5,.045,'pad',(j-1.5)*.3)
    if bar<3 or bar>=9:
        for j in range(8):add(ch[1+j%4]+12,start+j*beat/2,1.5,.042 if bar<9 else .062,pan=(-.35 if j%2 else .35))
    for j in range(2):add(melody[(bar*2+j)%16],start+j*1.25,2.3,.068,pan=.1)
    if bar>=9:
        for j in range(4):add(ch[0],start+j*beat,.6,.13,'bass')
        for j in range(8):
            at=int((start+j*beat/2)*sr);n=int(.07*sr);t=np.arange(n)/sr
            hiss=rng.normal(0,1,n);hiss=np.diff(hiss,prepend=0)*np.exp(-t*65)*.009
            mix[at:at+n]+=hiss[:,None]
        for j in [0,2]:
            at=int((start+j*beat)*sr);t=np.arange(int(.25*sr))/sr
            kick=np.sin(2*np.pi*(48*t+7*(1-np.exp(-t*30))))*np.exp(-t*22)*.17
            mix[at:at+len(t)]+=kick[:,None]
dry=mix.copy()
for delay,gain in [(.157,.13),(.313,.1),(.467,.075),(.641,.05)]:
    shift=int(delay*sr);mix[shift:]+=dry[:-shift,::-1]*gain
fade=np.minimum(np.arange(len(mix))/sr/1.5,1)*np.minimum((duration-np.arange(len(mix))/sr)/3,1)
mix*=fade[:,None];mix*=.82/max(.82,float(np.max(np.abs(mix))))
with wave.open(str(Path(__file__).with_name('original-score.wav')),'wb') as output:
    output.setnchannels(2);output.setsampwidth(2);output.setframerate(sr);output.writeframes((mix*32767).astype(np.int16).tobytes())
print({'duration':duration,'peak':float(np.max(np.abs(mix))),'rms':float(np.sqrt(np.mean(mix**2)))})
