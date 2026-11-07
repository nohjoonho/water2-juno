/* UW2 stability revision 1. Resident extension code is separate from the runtime heap/stack.
 * V25 town travel and build-day helper derived from the user-supplied patch by 힘들고.
 */
(() => {
  'use strict';
  const HEADER=0x5400, STACK=0x41cb, CODE=0x4600, BASE=HEADER+STACK*16;
  const hex=s=>Uint8Array.from(s.trim().split(/\s+/),v=>parseInt(v,16));
  const eq=(a,p,b)=>b.every((v,i)=>a[p+i]===v);
  const u16=(a,p)=>a[p]|a[p+1]<<8;
  const w16=(a,p,v)=>{a[p]=v&255;a[p+1]=(v>>>8)&255;};
  const size=a=>{w16(a,2,a.length%512);w16(a,4,Math.ceil(a.length/512));};
  const travelPayload=Uint8Array.from(atob('LscGIggAAJpOE3AfgD46DP90OC6APiAI/XUOLqAhCC6iIAjoigAwwMsugD4gCP50Gi6BPiIINUx0CS6BPiIIAEx1CC7GBiAI/jDAy5CQkJAugD4gCP50IHIJmua2tw+IRv7LU1FSVleaYAjLQV9eWllbsP+IRv7LmgAJy0GIRv4IwH4Ii/Q2xwQbucvLkJCQLqAgCDz+cwkuxgYgCP8w5MuaIV8AAMuQkJCQkJCQkJBQU1FSMOQuoCAIicPR4zDkioeMCInCMOSKh40IicFJgPsGdQFBkJCJ0IPoDHkCMcCD+Eh+A7hIAKNADCnCiRZEDInIg+gNeQIxwIP4SH4DuEgAo0IMKcFBiQ5GDLgEAJpqZQAAWllbWMMAAAAAAAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAw5M0WLqMiCArAdAMw5MuKxLQBywAAAAAAAAAAAAAAAC6APiAIA3UHLsYGIAj/y5rYtLcPy4te9scHwPrHRwLFw8ZHBAAx9jH/i4SMCD3//3QaCcB0FotC6IlD6In70euJ8NHoLoiHJAiDxwKDxgKD/hhy1Yn60erDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABVieWB7BgBU1FSVle4OgCNnuj+jVbomuxVmy3oV/+QkJC4MACQkJCNXujHBrqpAACaZg1wHzz/dBToRACQkJAuoiEILsYGIAj9MMDrCC7GBiAI/7D/X15aWVuJ7F3LkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkFMw5InDLoqHJAhbw5CQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkExGVFYyNQ=='),c=>c.charCodeAt(0));
  const ammoPayload=Uint8Array.from(atob('LsYGAQAAVYnlg+wIUVZXix7ixjHAikcQg8AyuXgA9+G5ZAAx0vfxiUb+mgQutw+JRvzHRvoAAItG+jtG/HNvicPR4zHAiod0BYlG+JouWwAAicaLRviaTlsAAInDikcHmnBbAACJx4tG+JosXAAAi1UXKcJ2M4P6CnYDugoAideDPjwSAHUOoToSMdL3dv45x3YCiccJ/3QVifgBRAb3Zv4pBjoSGRY8Ev9G+uuJX15Ziexdww=='),c=>c.charCodeAt(0));
  const ammoKeys=Uint8Array.from(atob('LoA+AAAAdCg8QXQcPGF0GC6APgAAAXUYPFN0BDxzdRAuxgYBAALrBi7GBgEAAbAwiEb+yw=='),c=>c.charCodeAt(0));
  const marker=hex('4c 46 54 56 32 35');
  const buildOriginal=hex('b9 64 00 2b d2 f7 f1 88 47 23');
  const points=[
    [0x2072e,'9a 4e 13 70 1f','9a 00 07 cb 41'],
    [0x2079d,'0e e8 b5 fe 88 46 fe','9a 50 07 cb 41 90 90'],
    [0x20450,'9a 21 5f 00 00','9a 90 07 cb 41'],
    [0x07e99,'32 e4 cd 16 0a','ea 40 08 cb 41']
  ];
  const validateMenu=a=>{
    const start=(a[116]<<8)|a[117],end=(a[118]<<8)|a[119];
    if(start<122||end> a.length||a[start]!==6||a[start+1]!==12)throw Error('빠른 이동 메뉴 구조가 지원 버전과 다릅니다.');
    const names=Array.from(a.slice(start+2,end));
    if(names.filter(v=>v===0).length!==12)throw Error('빠른 이동 시설 목록이 올바르지 않습니다.');
  };
  function prepare(input,menu,options){
    validateMenu(menu);
    if(u16(input,8)*16!==HEADER||u16(input,14)!==STACK)throw Error('지원하지 않는 게임 실행 파일입니다.');
    if(!eq(input,0x19032,hex('9a 60 00 cb 41 90 90')))throw Error('A 자동보급 패치 연결을 확인하지 못했습니다.');
    const a=new Uint8Array(Math.max(input.length,BASE+0xf00));a.set(input);
    for(const [p,before] of points)if(!eq(a,p,hex(before)))throw Error('편의 기능의 대상 코드가 변경되었습니다.');
    if(!eq(a,0x30a72,buildOriginal))throw Error('건조 기간 계산 코드가 변경되었습니다.');
    for(let p=BASE+0x440;p<BASE+0x452;p++)if(a[p]!==0)throw Error('건조 보조 코드 공간이 사용 중입니다.');
    for(let p=BASE+0x700;p<BASE+0x9b6;p++)if(a[p]!==0)throw Error('빠른 이동 코드 공간이 사용 중입니다.');
    a.set(travelPayload,BASE+0x700);
    // A normal far-call wrapper: never rewrite a return address or replace
    // the global keyboard/menu handlers. Consume one host travel request,
    // show the original facility menu, redraw, and return to the same frame.
    a.set(hex('9a 4e 13 70 1f 2e 81 3e 22 08 00 4c 75 30 2e c7 06 22 08 00 00 50 53 51 52 56 57 9a 00 09 cb 41 3c ff 74 0b 2e a0 21 08 2e a2 20 08 e8 81 00 2e c6 06 20 08 ff 5f 5e 5a 59 5b 58 30 c0 cb cb'),BASE+0x700);
    for(const [p,,after] of points.slice(0,1))a.set(hex(after),p);
    // The town input wrapper is the only quick-travel hook. Disabling it restores the original call.
    if(!options.fastTravel)a.set(hex(points[0][1]),points[0][0]);
    const build=hex('51 52 b9 64 00 f7 e1 b9 10 27 f7 f1 88 47 23 5a 59 cb');
    w16(build,3,100-options.buildReduction);a.set(build,BASE+0x440);
    a.set(hex('9a 40 04 cb 41 90 90 90 90 90'),0x30a72);
    // Source S patch adds up to ten cannonballs. Then call the original A routine.
    if(!eq(a,BASE+0x2f,hex('2e c6 06 01 00 00 e8 58 00')) ||
       !eq(a,BASE+0x60,hex('9a 81 3f b7 0f 2e 80 3e 00 00 00 74 10 3c 41 74 04 3c 61 75 08 2e c6 06 01 00 01 b0 30 88 46 fe cb')))
      throw Error('S 보급과 연결할 A 입력 코드가 일치하지 않습니다.');
    for(let p=BASE+0xb00;p<BASE+0xd12;p++)if(a[p]!==0)throw Error('포탄 보급 코드 공간이 사용 중입니다.');
    a.set(hex('e8 1f 00 90 90 90 90 90 90'),BASE+0x2f);
    const relay=new Uint8Array(15).fill(0x90);relay[0]=0xe9;w16(relay,1,0xd00-(0x51+3));a.set(relay,BASE+0x51);
    a.set(hex('9a 81 3f b7 0f e9 98 0b'),BASE+0x60);
    a.set(ammoPayload,BASE+0xb00);a.set(ammoKeys,BASE+0xc00);
    a.set(hex('53 55 50 53 31 30'),BASE+0xc40);
    const dispatch=hex('2e fe 0e 01 00 75 04 e8 00 00 c3 e8 00 00 e8 00 00 c3');
    w16(dispatch,8,0x90-(0xd00+10));
    w16(dispatch,12,0xb00-(0xd00+14));
    w16(dispatch,15,0x90-(0xd00+17));
    a.set(dispatch,BASE+0xd00);
    const count=u16(a,6),table=u16(a,24),relocs=[];const seen=new Set();
    for(let i=0;i<count;i++){const off=u16(a,table+i*4),seg=u16(a,table+i*4+2);const linear=seg*16+off;relocs.push([off,seg]);seen.add(linear);}
    const extra=[0x20731,0x30a75].map(p=>p-HEADER);
    for(const off of [0xb2d,0xb4f,0xb59,0xb63,0xb6d,0x703,0x71e,0x812,0x919,0x933])extra.push(STACK*16+off);
    for(const linear of extra)if(!seen.has(linear)){relocs.push([linear&15,Math.floor(linear/16)]);seen.add(linear);}
    if(table+relocs.length*4>HEADER)throw Error('실행 파일 헤더 공간이 부족합니다.');
    for(let p=table+count*4;p<table+relocs.length*4;p++)if(a[p]!==0)throw Error('실행 파일 헤더에 다른 패치가 있습니다.');
    for(let i=0;i<relocs.length;i++){w16(a,table+i*4,relocs[i][0]);w16(a,table+i*4+2,relocs[i][1]);}
    w16(a,6,relocs.length);
    // The legacy patch used SS:0000..0D12, which belongs to the game's
    // downward-growing stack. Day advancement can overwrite executable code.
    // Move the entire extension above the original stack and relocate both
    // its address operands and the MZ relocation-table locations.
    const oldStart=STACK*16,newStart=CODE*16,length=0xf00;
    if(newStart<oldStart+u16(a,16))throw Error('패치 코드와 게임 스택이 겹칩니다.');
    const moved=new Uint8Array(HEADER+newStart+length);moved.set(a);
    moved.set(a.subarray(HEADER+oldStart,HEADER+oldStart+length),HEADER+newStart);
    moved.fill(0,HEADER+oldStart,HEADER+oldStart+length);
    for(let i=0;i<relocs.length;i++){
      let [off,seg]=relocs[i],linear=seg*16+off;
      const value=u16(a,HEADER+linear);
      if(linear>=oldStart&&linear<oldStart+length){linear+=newStart-oldStart;off=linear&15;seg=Math.floor(linear/16);}
      if(value===STACK)w16(moved,HEADER+linear,CODE);
      w16(moved,table+i*4,off);w16(moved,table+i*4+2,seg);
    }
    // Borland startup shrinks the DOS memory block to DGROUP+1000h.
    // Reserve the extension as resident code while retaining the original
    // C heap limit, so malloc cannot reuse either extension code or scratch.
    const startup=0x8765;
    if(!eq(a,startup,hex('8c c3 2b de f7 db')))throw Error('게임 시작 메모리 예약 코드가 다릅니다.');
    const reserve=hex('8c c3 2b de f7 db 81 c3 00 00 cb');
    w16(reserve,8,CODE+length/16-(0x355b+0x1000));
    moved.set(reserve,HEADER+newStart+0xe00);
    moved.set(hex('9a 00 0e 00 46 90'),startup);
    const hookLinear=startup+3-HEADER;
    w16(moved,table+relocs.length*4,hookLinear&15);
    w16(moved,table+relocs.length*4+2,Math.floor(hookLinear/16));
    w16(moved,6,relocs.length+1);
    // Original DGROUP, runtime heap limit and stack addresses remain intact.
    size(moved);return moved;
  }
  function connect(em){
    let cached=null;
    const signature=hex('55 89 e5 83 ec 14 53 51 52 56 57 9a 04 2e');
    function valid(a,b){return b>=0&&eq(a,b+0x90,signature)&&eq(a,b+0x9b0,marker)&&u16(a,b+0x9e)>0xfb7;}
    function locate(){
      const a=em.HEAPU8;if(!a)throw Error('게임 메모리가 아직 준비되지 않았습니다.');
      if(cached!==null&&valid(a,cached))return {a,b:cached,load:u16(a,cached+0x9e)-0xfb7,image:cached-CODE*16,ds:cached-CODE*16+0x355b*16};
      const hits=[];
      for(let i=0;i<a.length-signature.length;i++)if(a[i]===signature[0]&&eq(a,i,signature)&&valid(a,i-0x90))hits.push(i-0x90);
      if(hits.length!==1)throw Error('게임을 시작하거나 저장한 게임을 불러온 뒤 다시 눌러 주세요.');
      cached=hits[0];return locate();
    }
    return {
      apply(options){
        const {a,b,load,image}=locate();
        w16(a,b+0x443,100-options.buildReduction);
        const hook=hex(options.fastTravel?points[0][2]:points[0][1]);
        w16(hook,3,(options.fastTravel?CODE:0x1f70)+load);
        a.set(hook,image+points[0][0]-HEADER);
      },
      requestTravel(){
        const {a,b,ds}=locate();
        if(a[ds+0xc3a]===0xff)throw Error('항구 마을 화면에서 사용해 주세요.');
        w16(a,b+0x822,0x4c00);
      },
      money(){const {a,ds}=locate();return new DataView(a.buffer,a.byteOffset+ds+0x123a,4).getUint32(0,true);},
      addMoney(){
        const {a,ds}=locate();const view=new DataView(a.buffer,a.byteOffset+ds+0x123a,4);
        const before=view.getUint32(0,true),after=Math.min(99999999,before+1000000);
        if(before>99999999)throw Error('소지금 값이 예상 범위를 벗어났습니다.');
        view.setUint32(0,after,true);return {before,after,added:after-before};
      }
    };
  }
  window.UW2Enhancements={prepare,connect};
})();
