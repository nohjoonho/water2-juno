import base64,re
from pathlib import Path
from keystone import Ks, KS_ARCH_X86, KS_MODE_16
ks=Ks(KS_ARCH_X86, KS_MODE_16)
path=Path('enhancements.js')
source=path.read_text(encoding='utf-8')
old=base64.b64decode(source.split('const ammoPayload=')[1].split("'")[1])
# Retain the call sites (and therefore the verified MZ relocations) in the original prefix.
prefix=bytearray(old[:0x6f])
tail=bytes(ks.asm('''
.byte 0xe8,0x8e,0x06
inc word ptr [bp-6]
jmp 0xb37
done:
pop di
pop si
pop cx
mov sp,bp
pop bp
.byte 0xc3
''',addr=0xb6f)[0])
done=0xb6f+len(tail)-7
assert prefix[0x3d]==0x73 and -128<=done-0xb3f<=127
prefix[0x3e]=(done-0xb3f)&255
payload=bytes(prefix)+tail
helper=bytes(ks.asm('''
mov dx,10
cmp word ptr [si+6],dx
jb topup
mov word ptr [si+6],dx
jmp finish
topup:
mov dx,word ptr [di+0x17]
sub dx,ax
jb finish
push dx
mov di,10
sub di,word ptr [si+6]
cmp word ptr [0x123c],0
jne budget
mov ax,word ptr [0x123a]
xor dx,dx
div word ptr [bp-2]
cmp di,ax
jbe budget
mov di,ax
budget:
pop dx
or di,di
jz finish
cmp dx,di
jae buy
push di
sub di,dx
mov ax,word ptr [si]
xor dx,dx
mov cx,10
div cx
cmp ax,di
jbe water
mov ax,di
water:
sub di,ax
mul cx
sub word ptr [si],ax
or di,di
jz reclaimed
mov ax,word ptr [si+2]
xor dx,dx
div cx
cmp ax,di
jbe food
mov ax,di
food:
sub di,ax
mul cx
sub word ptr [si+2],ax
reclaimed:
mov dx,di
pop di
sub di,dx
buy:
mov ax,di
add word ptr [si+6],ax
mul word ptr [bp-2]
sub word ptr [0x123a],ax
sbb word ptr [0x123c],dx
finish:
.byte 0xc3
''',addr=0x1200)[0])
assert len(payload)<0x100 and len(helper)<0x100
Path('.juno-dev/ammo-target.bin').write_bytes(payload)
Path('.juno-dev/ammo-target-helper.bin').write_bytes(helper)
source=re.sub(r"const ammoPayload=Uint8Array.from\(atob\('[^']+'\)","const ammoPayload=Uint8Array.from(atob('"+base64.b64encode(payload).decode()+"')",source,count=1)
insertion="  const ammoTargetHelper=hex('"+helper.hex(' ')+"');\n"
if 'const ammoTargetHelper=' in source:
 source=re.sub(r"  const ammoTargetHelper=hex\('[^']+'\);\n",insertion,source)
else:
 source=source.replace('  const ammoKeys=',insertion+'  const ammoKeys=')
path.write_text(source,encoding='utf-8')
print(f'S target payload {len(payload)} bytes, helper {len(helper)} bytes; exit {done:04x}')
