from pathlib import Path
from keystone import Ks, KS_ARCH_X86, KS_MODE_16
source = '''
push word ptr [0x8b7a]
push word ptr [0x8b7c]
pushf
pusha
cmp byte ptr cs:[0x10f0], 1
jne draw
cmp byte ptr [0xc3a], 0xff
je draw
cmp bx, 0x1242
jb draw
cmp bx, 0x29b2
jae draw
cmp byte ptr [bx], al
jne draw
mov ax, bx
sub ax, 0x1242
xor dx, dx
mov cx, 50
div cx
cmp dx, 26
jae draw
cmp al, byte ptr [0x1241]
je draw
mov si, 0x2d57
mov cx, 30
crew:
cmp al, byte ptr [si]
je draw
inc si
loop crew
mov byte ptr [0x8b7a], 9
mov byte ptr [0x8b7c], 9
draw:
popa
popf
.byte 0xff, 0x5e, 0x06
pushf
push ax
push bx
mov bx, sp
mov ax, word ptr ss:[bx+6]
mov byte ptr [0x8b7c], al
mov ax, word ptr ss:[bx+8]
mov byte ptr [0x8b7a], al
pop bx
pop ax
popf
add sp, 4
dec word ptr [bp-0x12]
.byte 0xcb
'''
payload = bytes(Ks(KS_ARCH_X86, KS_MODE_16).asm(source, addr=0xf00)[0])
assert len(payload) < 0x1f0
Path('.juno-dev/name-hook.bin').write_bytes(payload)
print(payload.hex(' '))
