import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parent
for name in ['eric','carla','claudia','Male_Adult_08','Female_Adult_01']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    folder=Path('/tmp/ai-town-rigged-source')/name if name in ['eric','carla','claudia'] else ROOT/'reference-assets/cast'/name
    files=list(folder.rglob('*yup_t.fbx')) or list(folder.rglob('*.fbx'))
    bpy.ops.import_scene.fbx(filepath=str(files[0]),use_anim=False)
    for obj in list(bpy.data.objects):
        if obj.type=='MESH' and any(s in obj.name.lower() for s in ['midpoly','lowpoly','ultralowpoly']):bpy.data.objects.remove(obj,do_unlink=True)
    for mat in bpy.data.materials:
        images=list(folder.rglob('*_dif.jpg'))
        if not images:
            part='opacity' if 'opacity' in mat.name.lower() else 'head' if 'head' in mat.name.lower() else 'body'
            images=list(folder.glob('*_'+part+'_color.tga'))
        if not images:continue
        image=bpy.data.images.load(str(images[0]));image.scale(min(2048,image.size[0]),min(2048,image.size[1]));image.pack()
        mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();bs=nodes.new('ShaderNodeBsdfPrincipled');bs.inputs['Roughness'].default_value=.8
        tex=nodes.new('ShaderNodeTexImage');tex.image=image;out=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);mat.node_tree.links.new(bs.outputs['BSDF'],out.inputs['Surface'])
        if 'opacity' in mat.name.lower():mat.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha']);mat.surface_render_method='DITHERED'
    print('BONES',name,[(o.name,[b.name for b in o.data.bones]) for o in bpy.data.objects if o.type=='ARMATURE'],flush=True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/assets/scanned'/f'{name}.glb'),export_format='GLB',export_image_format='JPEG',export_jpeg_quality=88,export_animations=False)
