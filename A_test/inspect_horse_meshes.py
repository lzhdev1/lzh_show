import struct,json
p=r'D:\AMySpace\AMe\lzh_show\project\TTFarm\src\scene\professionalModels\horse.glb'
d=open(p,'rb').read(); off=12; L=struct.unpack('<I',d[8:12])[0]
while off<L:
 clen,ctype=struct.unpack('<II',d[off:off+8]); off+=8; chunk=d[off:off+clen]; off+=clen
 if ctype==0x4E4F534A:
  j=json.loads(chunk.decode('utf-8').rstrip('\x00 ')); break
for i,n in enumerate(j['nodes']):
 if 'mesh' in n:
  m=j['meshes'][n['mesh']]
  print(i,n.get('name'),'mesh',n['mesh'],m.get('name'),'skin',n.get('skin'),'prims',len(m['primitives']))
print('materials',[(i,m.get('name'),m.get('pbrMetallicRoughness',{}).get('baseColorFactor')) for i,m in enumerate(j.get('materials',[]))])
print('scene roots',j['scenes'][0].get('nodes'))
