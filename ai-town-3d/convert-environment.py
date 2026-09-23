import bpy, os
root=os.path.dirname(os.path.abspath(__file__))
for name in ['island_tree_01','tree_stump_01','rock_moss_set_01']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(root,'reference-assets/environment',name,name+'.gltf'))
    if name=='island_tree_01':
        for obj in list(bpy.data.objects):
            if obj.type!='MESH': continue
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active=obj
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.separate(type='MATERIAL')
            bpy.ops.object.mode_set(mode='OBJECT')
    for obj in list(bpy.data.objects):
        if obj.type!='MESH': continue
        # Keep scan textures while reducing geometry for a browser scene.
        material=' '.join(m.name for m in obj.data.materials if m).lower()
        target=(50000 if 'leaves' in material else 6500) if name=='island_tree_01' else 4000
        print(obj.name,material,len(obj.data.polygons),'target',target)
        if len(obj.data.polygons)>target:
            bpy.context.view_layer.objects.active=obj
            modifier=obj.modifiers.new('Browser detail budget','DECIMATE')
            modifier.ratio=target/len(obj.data.polygons)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    output=os.path.join(root,'public/assets/environment',name+'.glb')
    os.makedirs(os.path.dirname(output),exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',export_animations=False)
    print('Exported',output)
