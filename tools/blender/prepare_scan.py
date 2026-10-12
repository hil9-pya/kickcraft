"""Prepare a reconstructed textured OBJ for the KickCraft region editor."""
import bpy, sys, json, pathlib, math
from mathutils import Vector
source, destination = sys.argv[sys.argv.index('--')+1:]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.wm.obj_import(filepath=str(pathlib.Path(source).resolve()))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
if not objects:
    raise RuntimeError('Reconstruction contains no mesh')
bpy.ops.object.select_all(action='DESELECT')
for obj in objects: obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.join()
shoe=bpy.context.object
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
points=[shoe.matrix_world@Vector(c) for c in shoe.bound_box]
low=Vector(tuple(min(p[i] for p in points) for i in range(3)))
high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
length=max(high-low)
if length<=0: raise RuntimeError('Reconstruction has no surface extent')
center=(low+high)/2
for vertex in shoe.data.vertices: vertex.co=(shoe.matrix_world@vertex.co-center)*(0.3/length)
shoe.matrix_world.identity()
shoe.data.calc_loop_triangles()
triangles=len(shoe.data.loop_triangles)
# Worker removes masked background before this browser-size reduction.
if triangles>50000:
    modifier=shoe.modifiers.new('Browser size','DECIMATE')
    modifier.ratio=49900/triangles
    bpy.ops.object.modifier_apply(modifier=modifier.name)
triangulate=shoe.modifiers.new('Triangles','TRIANGULATE')
bpy.ops.object.modifier_apply(modifier=triangulate.name)
if not shoe.data.uv_layers: raise RuntimeError('Reconstruction lacks texture coordinates')
# One atlas keeps region painting and its neutral detail texture aligned across materials.
materials=[m for m in shoe.data.materials if m]
if len(materials)>1:
    atlas=bpy.data.images.new('Scan original atlas',width=2048,height=2048,alpha=False)
    for mat in materials:
        mat.use_nodes=True
        target=mat.node_tree.nodes.new('ShaderNodeTexImage'); target.image=atlas
        mat.node_tree.nodes.active=target
    original_uv=shoe.data.uv_layers.active
    new_uv=shoe.data.uv_layers.new(name='ScanAtlas')
    shoe.data.uv_layers.active=new_uv
    original_uv.active_render=True
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.scene.render.engine='CYCLES'
    bpy.context.scene.cycles.samples=1
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'},margin=8)
    mat=bpy.data.materials.new('ScanOriginal'); mat.use_nodes=True
    node=mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image=atlas
    mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    shoe.data.materials.clear(); shoe.data.materials.append(mat)
    for face in shoe.data.polygons: face.material_index=0
    shoe.data.uv_layers.remove(original_uv)
    new_uv.active_render=True
for image in bpy.data.images:
    if image.size[0] and max(image.size)>2048:
        ratio=2048/max(image.size); image.scale(max(1,int(image.size[0]*ratio)),max(1,int(image.size[1]*ratio)))
    if image.source=='FILE': image.pack()
shoe.name='ScanSurface'
bpy.ops.export_scene.gltf(filepath=destination,export_format='GLB',use_selection=True,export_yup=True,export_normals=True)
shoe.data.calc_loop_triangles()
result={'ok':True,'triangles':len(shoe.data.loop_triangles),'bytes':pathlib.Path(destination).stat().st_size}
if result['triangles']>50000 or result['bytes']>20*1024*1024: raise RuntimeError('Prepared scan exceeds browser limits')
print(json.dumps(result))
