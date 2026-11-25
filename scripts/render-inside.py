"""Render the scroll film from the product GLB (Python, NumPy, Pillow and Mitsuba 3).
Usage: python scripts/render-inside.py scratch_dir start_frame end_frame [pixels] [samples]
"""
import io
import json
import math
import struct
import sys
from pathlib import Path

import mitsuba as mi
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

mi.set_variant('scalar_rgb')
scratch = Path(sys.argv[1])
scratch.mkdir(exist_ok=True, parents=True)
width = int(sys.argv[4]) if len(sys.argv) > 4 else 832
samples = int(sys.argv[5]) if len(sys.argv) > 5 else 10
T = mi.ScalarTransform4f
source = Path(__file__).resolve().parents[1] / 'public/models/aer-one.glb'
data = source.read_bytes()
header_size = struct.unpack_from('<I', data, 12)[0]
doc = json.loads(data[20:20 + header_size])
binary = data[28 + header_size:]


def buffer(index):
    view = doc['bufferViews'][index]
    return binary[view['byteOffset']:view['byteOffset'] + view['byteLength']]


def array(index):
    acc = doc['accessors'][index]
    dtype = {5123: '<u2', 5125: '<u4', 5126: '<f4'}[acc['componentType']]
    components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[acc['type']]
    return np.frombuffer(buffer(acc['bufferView']), dtype=dtype,
                         count=acc['count'] * components,
                         offset=acc.get('byteOffset', 0)).reshape(-1, components)


def mesh_file(name, pos, normal, uv, faces):
    file = scratch / (name + '.ply')
    vertices = np.column_stack([pos, normal, uv]).astype('<f4')
    faces = np.asarray(faces, dtype='<i4').reshape(-1, 3)
    records = np.empty(len(faces), dtype=[('n', 'u1'), ('ids', '<i4', (3,))])
    records['n'], records['ids'] = 3, faces
    hdr = ('ply\nformat binary_little_endian 1.0\nelement vertex %d\n' % len(pos)
           + ''.join('property float %s\n' % k for k in ('x','y','z','nx','ny','nz','s','t'))
           + 'element face %d\nproperty list uchar int vertex_indices\nend_header\n' % len(faces))
    file.write_bytes(hdr.encode() + vertices.tobytes() + records.tobytes())
    return str(file)


def rgb(values):
    return {'type': 'rgb', 'value': values}


def metal(color, amount, roughness):
    return {'type': 'principled', 'base_color': rgb(color), 'metallic': amount,
            'roughness': roughness}


def font(size):
    for file in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 'DejaVuSans-Bold.ttf'):
        try:
            return ImageFont.truetype(file, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def label_map(name, background):
    rng = np.random.default_rng(42)
    noise = rng.normal(0, 2.8, (768, 768, 1))
    image = Image.fromarray(np.uint8(np.clip(np.array(background) + noise, 0, 255)))
    pen = ImageDraw.Draw(image)
    if name == 'processor':
        # The laser-etched lid and pin-one indicator are flush with the package.
        pen.text((70, 56), 'AER', fill='#bab6a8', font=font(70))
        pen.text((65, 228), 'A1', fill='#dedad0', font=font(240))
        pen.line((75,548,684,548), fill='#75726b', width=3)
        pen.text((75, 574), 'SYSTEM IN PACKAGE', fill='#c1bbab', font=font(42))
        pen.ellipse((70,676,93,699), fill='#c99658')
    if name == 'cell':
        pen.text((64,110),'AER',font=font(96),fill='#535655')
        pen.text((67,277),'Li-ion',font=font(88),fill='#575958')
        for x in range(72, 462, 9):
            pen.rectangle((x,530,x+int(rng.integers(1,6)),625),fill='#62635d')
    if name == 'board':
        for side in (-1,1):
            for i in range(33):
                x = 384 + side*(18+i*5)
                y = 110+i*14
                out = 384 + side*(245+(i%6)*14)
                pen.line([(x,370),(x,y),(out,y+side*(out-x)*.35),(out,y+68)],fill='#827e50',width=2)
                pen.ellipse((out-4,y+64,out+4,y+72),fill='#c9a466')
        pen.text((42,660),'AER  /  LOGIC',font=font(31),fill='#d5cfb6')
    file = scratch/(name+'.png')
    image.save(file)
    return {'type':'bitmap','filename':str(file)}


def rounded(name, w, h, depth, radius, bevel):
    # Closed, stepped fillets with smooth radial normals and planar top UVs.
    verts, norms, uvs, faces = [], [], [], []
    def add(x,y,z,n):
        verts.append((x,y,z)); norms.append(n); uvs.append((x/w+.5,.5-y/h))
    ring_count = 0
    for top in (False, True):
        for j in range(5):
            angle = (4-j if not top else j)*math.pi/8
            inset = bevel*(1-math.cos(angle))
            rz = (depth/2-bevel+bevel*math.sin(angle))*(1 if top else -1)
            start = len(verts)
            for k,(sx,sy) in enumerate(((1,1),(-1,1),(-1,-1),(1,-1))):
                for a in range(9):
                    theta=(k+a/8)*math.pi/2
                    nx,ny=math.cos(theta),math.sin(theta)
                    add(sx*(w/2-radius)+(radius-inset)*nx,sy*(h/2-radius)+(radius-inset)*ny,rz,
                        (nx*math.cos(angle),ny*math.cos(angle),math.sin(angle)*(1 if top else -1)))
            ring_count=len(verts)-start
            if start:
                for i in range(ring_count):
                    a=start+i; b=start+(i+1)%ring_count
                    faces.extend([(a-ring_count,b-ring_count,b),(a-ring_count,b,a)])
    for i in range(1,ring_count-1):
        faces.extend([(0,i+1,i),(start,start+i,start+i+1)])
    return mesh_file(name,verts,norms,uvs,faces)


assembly = []
dial = scratch/'oled.png'
dial.write_bytes(buffer(doc['images'][2]['bufferView']))
shell = metal([.46,.49,.5],.94,.26)
rubber = metal([.025,.028,.03],0,.54)
dark = metal([.014,.016,.018],.12,.34)
gold = metal([.85,.51,.19],.89,.23)
ceramic = metal([.24,.23,.20],.62,.35)
materials=[shell,rubber,dark,{'type':'thindielectric','int_ior':1.22},
           metal([.004,.005,.006],0,.4),metal([.012,.02,.026],.35,.17),metal([.7,.74,.75],1,.16)]
for m,mesh in enumerate(doc['meshes']):
    for j,p in enumerate(mesh['primitives']):
        k=p['material']; attrs=p['attributes']
        file=mesh_file(f'housing-{m}-{j}',array(attrs['POSITION'])*1000,array(attrs['NORMAL']),
                       array(attrs['TEXCOORD_0']),array(p['indices']))
        shape={'type':'ply','filename':file,'bsdf':materials[k]}
        if k==4:
            shape['emitter']={'type':'area','radiance':{'type':'bitmap','filename':str(dial)}}
        layer = {4:'glass',5:'oled'}.get(m,'body')
        assembly.append((layer,shape,T()))

def piece(layer,file,material,x,y,z,scale=None):
    xf=T().translate([x,y,z])
    if scale: xf=xf@T().scale(scale)
    assembly.append((layer,{'type':'ply','filename':file,'bsdf':material},xf))

def printed(name,color,metallic,rough):
    return {'type':'principled','base_color':label_map(name,color),'metallic':metallic,'roughness':rough}

cell=rounded('pouch',26,28,2.7,3.8,.46)
piece('cell',cell,printed('cell',[158,162,160],.78,.31),0,1.3,6.6)
board=rounded('substrate',29.5,33.5,.87,4,.22)
piece('board',board,printed('board',[25,56,48],.3,.33),0,0,3.6)
block=rounded('smd',1,1,1,.12,.08)
def block_at(layer,mat,x,y,z,w,h,d):
    piece(layer,block,mat,x,y,z,[w,h,d])
for row in range(3):
    for i in range(7):
        x=-9.2+row*1.95; y=-8.2+i*2.35
        block_at('board',ceramic,x,y,4.35,.92,1.55,.47)
        for end in (-.62,.62):
            block_at('board',shell,x,y+end,4.36,1.01,.31,.52)
for x,y,w,h in [(-6,11,7,4),(7,10,5,4),(-5,-11,6,3),(8,-10,5,4)]:
    block_at('board',dark,x,y,4.4,w,h,.7)
for i in range(18):
    block_at('board',gold,12.7,-9+i*1.05,4.08,.94,.46,.12)
block_at('cell',gold,-8,15.1,6.6,5.1,4.3,.18)
piece('chip',rounded('chip-carrier',10.7,10.7,.58,.49,.12),metal([.035,.10,.079],.34,.3),3,0,4.5)
piece('chip',rounded('chip-lid',9.65,9.65,.83,.5,.18),printed('processor',[45,46,46],.62,.29),3,0,5.17)
for side in (-1,1):
    for i in range(17):
        v=(i-8)*.55
        block_at('chip',gold,3+v,side*5.15,4.81,.26,.49,.19)
        block_at('chip',gold,3+side*5.15,v,4.81,.49,.26,.19)

def studio():
    h,w=256,512
    y,x=np.mgrid[:h,:w]; a=(x+.5)*2*math.pi/w; b=(y+.5)*math.pi/h
    dirs=np.stack((np.sin(a)*np.sin(b),np.cos(b),-np.cos(a)*np.sin(b)),axis=-1)
    sky=np.broadcast_to([.115,.102,.091],(h,w,3)).copy()
    for pos,u,v,color in [((-.8,.9,.4),.84,.85,(4.3,4.4,4.5)),((.45,.42,1),.18,1.3,(4.1,4,3.9)),
                          ((1,.24,-.7),.6,.9,(2.25,1.28,.8)),((-.5,-.4,-1),.42,1.2,(2,2.2,2.3))]:
        axis=np.array(pos)/np.linalg.norm(pos); side=np.cross([0,1,0],axis);side/=np.linalg.norm(side)
        up=np.cross(axis,side); z=dirs@axis
        uvs=np.maximum(np.abs((dirs@side)/u),np.abs((dirs@up)/v))/np.maximum(z,.001)
        sky+=np.clip(8*(1-uvs),0,1)[:,:,None]*(z>0)[:,:,None]*color
    return mi.Bitmap(sky.astype('f'))

environment=studio()
def ease(p,start,end):
    t=np.clip((p-start)/(end-start),0,1)
    return t*t*(3-2*t)

def camera(p):
    # Catmull-Rom gives the orbital camera a continuous tangent between shots.
    keys=np.array([
        [0, -26, 15, -16, 0,0,-13, 144],
        [.16, 24, 14, -22, 0,0,-9, 107],
        [.31, 82, 15, -17, 0,0,-9, 113],
        [.46, 37, 38, 4, 0,0,0, 139],
        [.67, 68, 23, 36, 0,0,12, 194],
        [.80, 77, 18, 30, 2,0,15, 204],
        [.91, 45, 28, 0, 35,-2,31, 87],
        [1, 17, 23,-13, 43,-2,36, 27]])
    i=min(len(keys)-2,np.searchsorted(keys[:,0],p,side='right')-1)
    a,b=keys[i],keys[i+1]; before=keys[max(0,i-1)]; after=keys[min(i+2,len(keys)-1)]
    dt=b[0]-a[0];t=(p-a[0])/dt
    va=(b[1:]-before[1:])/(b[0]-before[0])*dt
    vb=(after[1:]-a[1:])/(after[0]-a[0])*dt
    return (2*t**3-3*t*t+1)*a[1:]+(t**3-2*t*t+t)*va+(-2*t**3+3*t*t)*b[1:]+(t**3-t*t)*vb

def camera_basis(p):
    yaw,pitch,roll,x,y,z,dist=camera(p)
    yaw,pitch,roll=np.radians([yaw,pitch,roll])
    vec=np.array([math.sin(yaw)*math.cos(pitch),math.sin(pitch),math.cos(yaw)*math.cos(pitch)])
    right=np.cross([0,1,0],vec)
    right/=np.linalg.norm(right)
    up=np.cross(vec,right)*math.cos(roll)+right*math.sin(roll)
    target=np.array([x,y,z])
    eye=target+dist*vec
    return eye,target,vec,up,np.cross(up,vec)

def clean_oled(image, i):
    # Composite the emissive panel analytically. A Monte Carlo path through
    # thin glass otherwise introduces temporal noise in unlit OLED pixels.
    p=i/160
    eye,_,vec,up,right=camera_basis(p)
    dial_z=9.18+39*ease(p,.40,.73)
    if eye[2] <= dial_z or p>.84:
        return image
    w,h=image.size
    v,u=np.mgrid[:h,:w].astype('f')
    tan=math.tan(math.radians(20))
    sx=((u+.5)/w*2-1)*tan
    sy=(1-(v+.5)/h*2)*tan
    ray=-vec+sx[:,:,None]*right+sy[:,:,None]*up
    t=(dial_z-eye[2])/np.minimum(-1e-5,ray[:,:,2])
    xx=eye[0]+t*ray[:,:,0]; yy=eye[1]+t*ray[:,:,1]
    # Signed distance to the rounded-rectangle emitting area.
    qx=np.abs(xx)-9.65; qy=np.abs(yy)-12.75
    edge=np.hypot(np.maximum(qx,0),np.maximum(qy,0))+np.minimum(np.maximum(qx,qy),0)-7.50
    mask=(edge < -.04) & (t>0) & (ray[:,:,2]<-.015)
    if not mask.any(): return image
    px,py=xx[mask],yy[mask]
    tx=np.clip((.5+px/34.3)*(art.shape[1]-1),0,art.shape[1]-1.001)
    ty=np.clip((.5-py/40.5)*(art.shape[0]-1),0,art.shape[0]-1.001)
    ix,iy=tx.astype(int),ty.astype(int)
    fx,fy=(tx-ix)[:,None],(ty-iy)[:,None]
    ink=((1-fx)*art[iy,ix]+fx*art[iy,ix+1])*(1-fy)+((1-fx)*art[iy+1,ix]+fx*art[iy+1,ix+1])*fy
    # Studio reflection on the curved cover progressively leaves with the glass.
    rim=np.exp(-np.maximum(0,-edge[mask])*.95)
    angle=np.arctan2(-ray[:,:,0][mask],-ray[:,:,2][mask])
    pool=np.exp(-((angle-.32+.15*px/17.15+.09*py/20.25)/.29)**2)
    light=(1-ease(p,.36,.46))*(2+16*pool+rim*(23+32*pool))
    out=np.asarray(image).copy()
    blend=np.clip((-edge[mask]-.04)*3.2,0,1)[:,None]
    out[mask]=np.uint8(np.clip(out[mask]*(1-blend)+(ink+light[:,None])*blend,0,255))
    return Image.fromarray(out)

art=np.asarray(Image.open(dial).convert('RGB').resize((768,908),Image.Resampling.LANCZOS),dtype='f')

def render(i):
    p=i/160
    eye,target,_,up,_=camera_basis(p)
    scene={'type':'scene','integrator':{'type':'path','max_depth':5,'hide_emitters':True},
           'sky':{'type':'envmap','bitmap':environment},
           'sensor':{'type':'perspective','fov':40,'near_clip':.2,
                     'to_world':T().look_at(origin=eye.tolist(),target=target.tolist(),up=up.tolist()),
                     'film':{'type':'hdrfilm','width':width,'height':width,'pixel_format':'rgba',
                             'rfilter':{'type':'gaussian','stddev':.45}}}}
    shifts={'body':[0,0,-14*ease(p,.46,.75)],
            'glass':[-9*ease(p,.68,.94),0,56*ease(p,.36,.72)],
            'oled':[0,0,39*ease(p,.40,.73)],
            'cell':[0,0,23*ease(p,.49,.75)],
            'board':[0,0,10*ease(p,.54,.78)],
            'chip':[40*ease(p,.73,.96),-2*ease(p,.74,.96),10*ease(p,.54,.78)+21*ease(p,.71,.96)]}
    for j,(layer,shape,local) in enumerate(assembly):
        scene['s%d'%j]={**shape,'to_world':T().translate(shifts[layer])@local}
    radiance=np.asarray(mi.render(mi.load_dict(scene),spp=samples,seed=5))
    a=np.clip(radiance[:,:,3:4],0,1)
    col=np.maximum(0,radiance[:,:,:3]/np.maximum(a,.0001))
    col=col/(.95+.19*col)
    srgb=np.where(col<=.00313,12.92*col,1.055*np.maximum(col,0)**(1/2.4)-.055)
    # Continuous copper cyclorama, with a broad amber pool and dark perimeter.
    v,u=np.mgrid[:width,:width]/(width-1)
    glow=np.exp(-1.6*((u-.62)**2+(v-.41)**2))[:,:,None]
    bg=(np.array([42,19,18])+glow*np.array([155,77,39]))/255
    color=np.clip(srgb,0,1)*a+bg*(1-a)
    image = Image.fromarray(np.uint8(np.clip(color,0,1)*255+.5))
    image = image.filter(ImageFilter.MedianFilter(3))
    clean_oled(image,i).save(scratch/f'f{i:03}.png', compress_level=2)
    print(i,flush=True)
def write_anchors(destination):
    anchors=[]
    for i in range(161):
        p=i/160
        eye,_,vec,up,right=camera_basis(p)
        if p<.40: anchors.append(None);continue
        if p<.58: point=[-13-9*ease(p,.68,.94),7,10+56*ease(p,.36,.72)]
        elif p<.70: point=[-8,16,6.6+23*ease(p,.49,.75)]
        elif p<.88: point=[12.7,-5,4.1+10*ease(p,.54,.78)]
        else: point=[3+5.15+40*ease(p,.73,.96),-2*ease(p,.74,.96),4.8+10*ease(p,.54,.78)+21*ease(p,.71,.96)]
        delta=np.array(point)-eye
        side=-2*(delta@vec)*math.tan(math.radians(20))
        anchors.append([round(50+100*(delta@right)/side,2),round(50-100*(delta@up)/side,2)])
    destination.write_text(json.dumps(anchors,separators=(',',':'))+'\n')

write_anchors(scratch/'anchors.json')
for frame in range(int(sys.argv[2]),int(sys.argv[3])+1):
    render(frame)
def export_film(frames, output):
    output.mkdir(exist_ok=True, parents=True)
    for index in range(27):
        sheet=Image.new('RGB',(3*832,2*832))
        for tile in range(6):
            frame=min(160,index*6+tile)
            with Image.open(frames/f'f{frame:03}.png') as im:
                sheet.paste(im,((tile%3)*832,(tile//3)*832))
        sheet.save(output/f'film-{index}.webp', quality=85, method=4)
    for index,frame in enumerate([0,47,86,102,124,160]):
        with Image.open(frames/f'f{frame:03}.png') as im:
            im.save(output/f'shot-{index}.webp', quality=92, method=6)

if len(sys.argv)>6:
    export_film(scratch,Path(sys.argv[6]))
