import struct,json
p=r'D:\AMySpace\AMe\lzh_show\project\TTFarm\src\scene\professionalModels\horse.glb'
d=open(p,'rb').read()
magic,ver,length=struct.unpack('<III',d[:12])
off=12
while off<length:
    clen,ctype=struct.unpack('<II',d[off:off+8]); off+=8
    chunk=d[off:off+clen]; off+=clen
    if ctype==0x4E4F534A:
        j=json.loads(chunk.decode('utf-8').rstrip('\x00 '))
        break
print('nodes',len(j.get('nodes',[])))
print([n.get('name') for n in j.get('nodes',[])])
print('meshes',[(m.get('name'),len(m.get('primitives',[]))) for m in j.get('meshes',[])])
print('animations',[(a.get('name'),len(a.get('channels',[]))) for a in j.get('animations',[])])
print('skins',[(s.get('name'),len(s.get('joints',[]))) for s in j.get('skins',[])])
