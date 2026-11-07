import base64,json,struct
from pathlib import Path
from playwright.sync_api import sync_playwright
from unicorn import Uc,UC_ARCH_X86,UC_MODE_16
from unicorn.x86_const import *
fixtures=json.loads(Path('.juno-dev/fixtures.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,channel='chrome')
 page=b.new_page();page.add_script_tag(content=Path('enhancements.js').read_text(encoding='utf-8'))
 prepared=page.evaluate('''fixtures=>fixtures.map(f=>{
 const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const a=UW2Enhancements.prepare(bytes(f.exe),bytes(f.menu),{buildReduction:0,fastTravel:false});
 let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));
 return {name:f.name,code:btoa(s)};
})''',fixtures)
 b.close()
def run(exe,ammunition,water=100,food=100,money=1000000,capacity=500,cargo=0,mode='S',repeat=1):
 load=0x1000;image=load*16;ds=image+0x355b0;cs=load+0x4600;ss=load+0x41cb
 image_bytes=bytearray(exe[0x5400:])
 word=lambda a,p:struct.unpack_from('<H',a,p)[0]
 for i in range(word(exe,6)):
  t=word(exe,24)+i*4;pos=word(exe,t+2)*16+word(exe,t)
  struct.pack_into('<H',image_bytes,pos,(word(image_bytes,pos)+load)&65535)
 u=Uc(UC_ARCH_X86,UC_MODE_16);u.mem_map(0,0x200000);u.mem_write(image,bytes(image_bytes))
 def w(p,v):u.mem_write(ds+p,struct.pack('<H',v))
 def r(p):return struct.unpack('<H',u.mem_read(ds+p,2))[0]
 w(0xc6da,0x2db2);w(0xc6e2,0x697c);w(0x57ce+0x17,capacity)
 u.mem_write(ds+0x697c+0x10,b'\x00')
 u.mem_write(ds+0x123a,struct.pack('<I',money))
 for slot in range(10):
  u.mem_write(ds+0x2db2+0x2b+slot*9,bytes(9))
 for slot,ammo in enumerate(ammunition):
  ship=0x2db2+0x2b+slot*9;sup=0x5210+slot*30
  u.mem_write(ds+ship+8,b'\x10');u.mem_write(ds+sup+0x16,b'\xff'*5)
  w(sup,water);w(sup+2,food);w(sup+4,0);w(sup+6,ammo)
  if cargo:
   u.mem_write(ds+sup+0x16,b'\x01');w(sup+0xc,cargo)
 u.reg_write(UC_X86_REG_CS,cs);u.reg_write(UC_X86_REG_DS,ds//16);u.reg_write(UC_X86_REG_ES,ds//16);u.reg_write(UC_X86_REG_SS,ss)
 for _ in range(repeat):
  u.mem_write(cs*16+1,bytes([2 if mode=='S' else 1]))
  u.reg_write(UC_X86_REG_SP,0xefe);u.mem_write(ss*16+0xefe,struct.pack('<H',0x11f0))
  u.emu_start(cs*16+0xd00,cs*16+0x11f0,count=1000000)
  assert u.reg_read(UC_X86_REG_IP)==0x11f0,'Did not return'
  assert u.reg_read(UC_X86_REG_SP)==0xf00,'Stack not balanced'
 result={'ammo':[r(0x5210+i*30+6) for i in range(len(ammunition))],
         'water':[r(0x5210+i*30) for i in range(len(ammunition))],
         'food':[r(0x5210+i*30+2) for i in range(len(ammunition))],
         'money':struct.unpack('<I',u.mem_read(ds+0x123a,4))[0]}
 for i in range(len(ammunition)):
  assert result['water'][i]//10+result['food'][i]//10+result['ammo'][i]+cargo<=capacity
 assert result['money']<=money
 return result
cases=0
for fixture in prepared:
 exe=base64.b64decode(fixture['code'])
 for ammo in [0,1,5,9,10,11,20,50,100]:
  for number in [0,1,3,10]:
   initial=[ammo]*number
   first=run(exe,initial)
   assert first['ammo']==[10]*number,(fixture['name'],initial,first)
   repeated=run(exe,initial,repeat=3)
   assert repeated==first,('Repeated S changed supplies or charged again',initial,first,repeated)
   cases+=2
 for capacity in [500,510]:
  for water,food in [(2500,2500),(0,5000),(5000,0),(9,4999)]:
   # Keep every initial ship within capacity; full mixed-ammunition fleets
   # require 510 capacity, while the 500-capacity case starts with no ammo.
   initial=[0,0,0] if capacity==500 else [0,5,9]
   result=run(exe,initial,water=water,food=food,capacity=capacity)
   assert result['ammo']==[10,10,10],result
   cases+=1
 result=run(exe,[0,0],water=2500,food=2500,capacity=500)
 assert result['ammo']==[10,10] and result['water']==[2400,2400],result
 cases+=1
 result=run(exe,[0,5,20],money=0)
 assert result['ammo']==[0,5,10],result
 cases+=1
 result=run(exe,[0,5],money=60)
 assert result['ammo']==[1,5] and result['money']==0,result
 cases+=1
 result=run(exe,[0],water=0,food=0,cargo=497)
 assert result['ammo']==[3] and result['money']==1000000-3*60,result
 cases+=1
 result=run(exe,[20],mode='A')
 assert result['ammo']==[20],result
 cases+=1
 print(fixture['name']+': original game instructions + S dispatch, repeat, empty/full fleet, budget, cargo limit and A regression passed',flush=True)
print(f'{cases} full 16-bit S/A execution cases passed')
