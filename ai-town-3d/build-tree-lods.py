"""Create browser LODs from our existing tree; original asset is untouched."""
import bpy, os
root=os.path.dirname(os.path.abspath(__file__))
for level,leaf_budget,wood_budget in [('mid',8000,1200),('far',1800,220)]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(root,'public/assets/environment/island_tree_01.glb'))
    for obj in list(bpy.data.objects):
        if obj.type!='MESH': continue
        material=' '.join(m.name for m in obj.data.materials if m).lower()
        target=leaf_budget if 'leaves' in material else wood_budget
        if len(obj.data.polygons)>target:
            bpy.context.view_layer.objects.active=obj
            mod=obj.modifiers.new('Distance detail','DECIMATE')
            mod.ratio=target/len(obj.data.polygons)
            bpy.ops.object.modifier_apply(modifier=mod.name)
        print(level,obj.name,len(obj.data.polygons))
    bpy.ops.export_scene.gltf(filepath=os.path.join(root,f'public/assets/environment/island_tree_01-{level}.glb'),export_format='GLB',export_animations=False)
