"""Convert official Renderpeople free FBX samples into compact browser assets.
Run with Blender --background --python convert-scans.py. Sources stay in /tmp.
"""
import bpy
from pathlib import Path

SOURCE = Path('/tmp/ai-town-scans-source')
OUTPUT = Path('/Users/jan/Documents/Codex/city/ai-town-3d/public/assets/scanned')
for name in ['sophia', 'nathan', 'manuel']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    folder = SOURCE / name
    fbx = next(folder.glob('*.fbx'))
    bpy.ops.import_scene.fbx(filepath=str(fbx), use_anim=True)
    image = bpy.data.images.load(str(next(folder.glob('*_dif.jpg'))))
    image.scale(2048, 2048)
    image.pack()
    normal = bpy.data.images.load(str(next(folder.glob('*_norm.jpg'))))
    normal.colorspace_settings.name = 'Non-Color'
    normal.scale(2048, 2048)
    normal.pack()
    for mat in bpy.data.materials:
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        nodes.clear()
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.inputs['Roughness'].default_value = 0.8
        output = nodes.new('ShaderNodeOutputMaterial')
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = image
        ntex = nodes.new('ShaderNodeTexImage')
        ntex.image = normal
        nmap = nodes.new('ShaderNodeNormalMap')
        nmap.inputs['Strength'].default_value = 0.45
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        mat.node_tree.links.new(ntex.outputs['Color'], nmap.inputs['Color'])
        mat.node_tree.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
        mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_set(1)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT / (name + '.glb')), export_format='GLB',
        export_image_format='JPEG', export_jpeg_quality=88, export_animations=True,
        export_animation_mode='ACTIONS', export_force_sampling=True)
    print('EXPORTED', name, flush=True)
