import base64,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
from unicorn import Uc, UC_ARCH_X86, UC_MODE_16, UC_HOOK_CODE
from unicorn.x86_const import *
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page();page.goto('http://127.0.0.1:8785/')
 fixtures=json.loads(Path('.juno-dev/fixtures.json').read_text())
 result=page.evaluate('''fixtures=>{
 const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const u16=(a,p)=>a[p]|a[p+1]<<8;
 const w16=(a,p,v)=>{a[p]=v&255;a[p+1]=v>>>8;};
 const checks=[];const outputs=[];
 for(const fixture of fixtures){
  const exe=bytes(fixture.exe),menu=bytes(fixture.menu);
  for(let bits=0;bits<16;bits++){
   const options={buildReduction:25,fastTravel:true,rareEquipment:!!(bits&1),disableSeaEvents:!!(bits&2),freezeSupplies:!!(bits&4),highlightNames:!!(bits&8)};
   const prepared=UW2Enhancements.prepare(exe,menu,options);
   const heap=new Uint8Array(2*1024*1024),image=0x20000,load=image/16,ds=image+0x355b0;
   heap.set(prepared.subarray(0x5400),image);
   const table=u16(prepared,24);
   for(let i=0;i<u16(prepared,6);i++){
    const t=table+i*4,pos=image+u16(prepared,t+2)*16+u16(prepared,t);
    w16(heap,pos,u16(heap,pos)+load);
   }
   const baseline=heap.slice(),api=UW2Enhancements.connect({HEAPU8:heap});
   api.apply({...options,rareEquipment:!options.rareEquipment,disableSeaEvents:!options.disableSeaEvents,freezeSupplies:!options.freezeSupplies,highlightNames:!options.highlightNames});
   api.apply(options);
   if(heap.some((v,i)=>v!==baseline[i]))throw Error('Restore mismatch '+fixture.name+bits);
   heap[ds+0x1241]=2;w16(heap,ds+0xc67a,0x1242+100);
   const port=0x697c+7*37;
   heap[ds+0x1242+100+0x23]=30;heap[ds+0xc3a]=7;w16(heap,ds+0xc6e2,port);
   w16(heap,ds+port,500);w16(heap,ds+port+4,600);
   api.maintain({strongLuck:true,maxPort:true});
   if(heap[ds+0x1242+100+0x23]!==100||u16(heap,ds+port)!==1000||u16(heap,ds+port+4)!==1000)throw Error('Data enhancement failed');
   heap[ds+0x1242+100+0x23]=40;w16(heap,ds+port,400);api.maintain({strongLuck:false,maxPort:false});
   if(heap[ds+0x1242+100+0x23]!==40||u16(heap,ds+port)!==400)throw Error('Disabled enhancement changed data');
   heap[ds+0xc3a]=255;api.maintain({maxPort:true});if(u16(heap,ds+port)!==400)throw Error('At sea town write');
   w16(heap,ds+0xc67a,0);api.maintain({strongLuck:true});if(heap[ds+0x1242+100+0x23]!==40)throw Error('Title screen write');
   outputs.push({name:fixture.name,bits,code:Object.fromEntries([0x1de4a,0x1defb,0x1e1ab,0x35b1c].map(p=>[p,Array.from(prepared.slice(p,p+5))]))});
  }
  checks.push(fixture.name+': 16 option combinations, runtime restore, luck/port guards passed');
 }
 return {checks,outputs};
 }''',fixtures)
 b.close()
print('\n'.join(result['checks']))
native=0
for output in result['outputs']:
 a={int(k):bytes(v) for k,v in output['code'].items()};bits=output['bits']
 for off,n,field in [(0x1de4a,3,2),(0x1defb,2,0),(0x1e1ab,3,2)]:
  u=Uc(UC_ARCH_X86,UC_MODE_16);u.mem_map(0,0x10000);u.mem_write(0x1000,a[off][:n]);u.reg_write(UC_X86_REG_SI,0x2000);u.reg_write(UC_X86_REG_AX,7);u.mem_write(0x2000+field,(123).to_bytes(2,'little'));u.emu_start(0x1000,0x1000+n)
  assert int.from_bytes(u.mem_read(0x2000+field,2),'little')==(123 if bits&4 else 116)
  native+=1
 # Special sea event branch must reach the normal discovery scan, without consuming event records.
 if bits&2:
  u=Uc(UC_ARCH_X86,UC_MODE_16);u.mem_map(0,0x10000);u.mem_write(0x1000,a[0x35b1c]);u.emu_start(0x1000,0x2000,count=1);assert u.reg_read(UC_X86_REG_IP)==0x107d;native+=1
print(f'{native} supply/sea instruction cases passed')
payload=Path('.juno-dev/name-hook.bin').read_bytes()
source=Path('enhancements.js').read_text(encoding='utf-8');assert payload==bytes.fromhex(re.search(r"const nameHook=hex\('([^']+)'\)",source)[1])
name_cases=0
for enabled in [0,1]:
 for town in [7,255]:
  for hired in [False,True]:
   for offset in [0,1,12,13,25,26]:
    u=Uc(UC_ARCH_X86,UC_MODE_16);u.mem_map(0,0x100000)
    cs,ds,ss=0x4600,0x8000,0x7000
    u.mem_write(cs*16+0xf00,payload);u.mem_write(cs*16+0x10f0,bytes([enabled]));u.mem_write(0x10123,b'\xcb')
    u.reg_write(UC_X86_REG_CS,cs);u.reg_write(UC_X86_REG_DS,ds);u.reg_write(UC_X86_REG_SS,ss);u.reg_write(UC_X86_REG_SP,0xfe00);u.reg_write(UC_X86_REG_BP,0xff00)
    u.mem_write(ss*16+0xfe00,bytes.fromhex('00 01 00 20'));u.mem_write(ss*16+0xff06,bytes.fromhex('23 01 00 10'));u.mem_write(ss*16+0xff00-0x12,b'\x03\x00')
    u.mem_write(ds*16+0x8b7a,b'\x0f\x00\x00\x00');u.mem_write(ds*16+0xc3a,bytes([town]));u.mem_write(ds*16+0x1241,b'\x00');u.mem_write(ds*16+0x2d57,bytes([5 if hired else 255])+b'\xff'*29)
    ptr=0x1242+5*50+offset;u.mem_write(ds*16+ptr,b'A');u.reg_write(UC_X86_REG_AX,65);u.reg_write(UC_X86_REG_BX,ptr);u.reg_write(UC_X86_REG_CX,0xabc);u.reg_write(UC_X86_REG_DX,0xdef);u.reg_write(UC_X86_REG_SI,0x123);u.reg_write(UC_X86_REG_DI,0x456)
    observed=[]
    def capture(uc,address,size,data):
     if address==0x10123:observed.append(bytes(uc.mem_read(ds*16+0x8b7a,3)))
    u.hook_add(UC_HOOK_CODE,capture);u.emu_start(cs*16+0xf00,0x20100,count=200)
    highlighted=enabled and town!=255 and not hired and offset<26
    assert observed==[bytes([9,0,9]) if highlighted else bytes([15,0,0])],(enabled,town,hired,offset,observed)
    assert bytes(u.mem_read(ds*16+0x8b7a,4))==bytes([15,0,0,0])
    assert u.reg_read(UC_X86_REG_SP)==0xfe04
    assert u.reg_read(UC_X86_REG_AX)==65 and u.reg_read(UC_X86_REG_BX)==ptr
    assert [u.reg_read(r) for r in [UC_X86_REG_CX,UC_X86_REG_DX,UC_X86_REG_SI,UC_X86_REG_DI]]==[0xabc,0xdef,0x123,0x456]
    assert bytes(u.mem_read(ss*16+0xff00-0x12,2))==b'\x02\x00'
    name_cases+=1
print(f'{name_cases} name-rendering cases passed: colors, crew exclusion, port guard, registers and stack')
Path('.juno-dev/verification-result.txt').write_text('\n'.join(result['checks'])+f'\n{native} supply/sea cases; {name_cases} name rendering cases passed\n',encoding='utf-8')
