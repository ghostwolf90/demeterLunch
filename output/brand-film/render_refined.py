from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import subprocess, math
OUT=Path(__file__).resolve().parent
W,H,FPS,DURATION=720,1280,60,10
ART=Image.open('/Users/bit_lai/Desktop/好好吃飯_行政資料區/haohaofood.png').convert('RGB')
FONT='/System/Library/Fonts/STHeiti Light.ttc'
INK=(95,69,49); ORANGE=(187,82,37); BG=(252,248,238)
fonts={s:ImageFont.truetype(FONT,s) for s in (25,29,42,46,60)}
def smooth(x):
 x=max(0,min(1,x)); return x*x*x*(x*(x*6-15)+10)
def ramp(t,start,duration):return smooth((t-start)/duration)
def label(canvas,words,y,size,color,alpha,shift=0):
 layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer)
 d.text((W/2,y+shift),words,font=fonts[size],fill=(*color,round(255*alpha)),anchor='mt')
 canvas.alpha_composite(layer)
# Retain the supplied artwork as one composition; soften only its outer paper edge.
art=ART.resize((600,600),Image.Resampling.LANCZOS).convert('RGBA')
mask=Image.new('L',(600,600),0);ImageDraw.Draw(mask).rounded_rectangle((35,35,565,565),radius=95,fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(26));art.putalpha(mask)
base=Image.new('RGBA',(W,H),(*BG,255))
# Quiet warm light at the bottom, with no hard shape crossing the illustration.
glow=Image.new('RGBA',(W,H));gd=ImageDraw.Draw(glow);gd.ellipse((-160,920,880,1580),fill=(235,191,132,45));glow=glow.filter(ImageFilter.GaussianBlur(95));base.alpha_composite(glow)
proc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'好好吃飯_品牌短片_柔順版.mp4')],stdin=subprocess.PIPE)
for n in range(FPS*DURATION):
 t=n/FPS;im=base.copy()
 # A single slow arrival settles into stillness instead of continuous bobbing.
 arrival=ramp(t,.1,2.4); scale=.965+.035*arrival
 tx=W/2;ty=658+20*(1-arrival)
 inv=1/scale
 layer=art.transform((W,H),Image.Transform.AFFINE,(inv,0,300-tx*inv,0,inv,300-ty*inv),Image.Resampling.BICUBIC)
 im.alpha_composite(layer)
 a=ramp(t,.25,1)*(1-ramp(t,2.65,.85))
 label(im,'孩子今天，',168,46,INK,a,10*(1-ramp(t,.25,1)))
 label(im,'午餐吃了什麼？',235,46,INK,a,10*(1-ramp(t,.4,1)))
 b=ramp(t,3.15,1.05)
 label(im,'把午餐的線索',168,42,INK,b,10*(1-b))
 b2=ramp(t,3.4,1.05)
 label(im,'變成晚餐的靈感',235,42,INK,b2,10*(1-b2))
 c=ramp(t,5.3,1.15)
 label(im,'好好吃飯',955,60,ORANGE,c,12*(1-c))
 c2=ramp(t,5.65,1.05)
 label(im,'孩子午餐，晚餐靈感',1040,29,INK,c2,7*(1-c2))
 label(im,'haohaofood.cc',1130,25,(135,109,85),ramp(t,6.05,1))
 if n in (90,210,480):im.convert('RGB').save(OUT/f'柔順版_{n//60:02d}秒.jpg')
 proc.stdin.write(im.convert('RGB').tobytes())
proc.stdin.close();assert proc.wait()==0
