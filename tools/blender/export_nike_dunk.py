import bpy
import os
import math

SOURCE_BLEND = "C:/Users/kinglebron/Downloads/Nike Dunk/Nike Dunk.blend"
TARGET_GLB = "public/models/nike-dunk.glb"
TARGET_IMAGE = "public/images/nike-dunk-card.png"

os.makedirs("public/models", exist_ok=True)
os.makedirs("public/images", exist_ok=True)

print(f"Loading source: {SOURCE_BLEND}")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=SOURCE_BLEND)

body_obj = bpy.data.objects.get("Plane.010")
swoosh_obj = bpy.data.objects.get("Plane.011")
lace_curves = [bpy.data.objects.get(n) for n in ["BezierCurve.000", "BezierCurve.004", "BezierCurve.005"] if bpy.data.objects.get(n)]

if not body_obj or not swoosh_obj or not lace_curves:
    raise RuntimeError("Missing required shoe objects in source blend file")

# 1. Optimize curves resolution and convert to meshes
for c in lace_curves:
    c.data.resolution_u = 4
    if c.data.bevel_object:
        c.data.bevel_object.data.resolution_u = 3
    bpy.ops.object.select_all(action="DESELECT")
    c.select_set(True)
    bpy.context.view_layer.objects.active = c
    bpy.ops.object.convert(target="MESH")

# Join laces
bpy.ops.object.select_all(action="DESELECT")
for c in lace_curves:
    c.select_set(True)
bpy.context.view_layer.objects.active = lace_curves[0]
bpy.ops.object.join()
laces_mesh = bpy.context.active_object
laces_mesh.name = "Laces"

# 2. Set subsurf level 1 on body and swoosh, apply modifiers
for o in [body_obj, swoosh_obj]:
    for m in o.modifiers:
        if m.type == "SUBSURF":
            m.levels = 1
            m.render_levels = 1

bpy.ops.object.select_all(action="DESELECT")
body_obj.select_set(True)
bpy.context.view_layer.objects.active = body_obj
for m in list(body_obj.modifiers):
    bpy.ops.object.modifier_apply(modifier=m.name)

# 3. Separate body by material (Red = Upper, Black = Overlays, White = Midsole)
bpy.ops.mesh.separate(type="MATERIAL")
separated = bpy.context.selected_objects

def make_pbr_material(name, base_color=(0.9, 0.9, 0.9, 1.0), roughness=0.5):
    mat = bpy.data.materials.new(name=name)
    nodes = mat.node_tree.nodes
    nodes.clear()
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    output = nodes.new(type="ShaderNodeOutputMaterial")
    mat.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat

mat_upper = make_pbr_material("UpperMaterial", (0.78, 0.12, 0.12, 1.0), 0.45)
mat_overlays = make_pbr_material("OverlaysMaterial", (0.12, 0.12, 0.14, 1.0), 0.5)
mat_midsole = make_pbr_material("MidsoleMaterial", (0.95, 0.95, 0.95, 1.0), 0.75)
mat_swoosh = make_pbr_material("SwooshMaterial", (0.12, 0.12, 0.14, 1.0), 0.45)
mat_laces = make_pbr_material("LacesMaterial", (0.88, 0.88, 0.88, 1.0), 0.6)

shoe_parts = []
for s in separated:
    old_mat = s.material_slots[0].name if s.material_slots else ""
    s.data.materials.clear()
    if old_mat == "Red":
        s.name = "Upper"
        s.data.materials.append(mat_upper)
    elif old_mat == "Black":
        s.name = "Overlays"
        s.data.materials.append(mat_overlays)
    elif old_mat == "White":
        s.name = "Midsole"
        s.data.materials.append(mat_midsole)
    shoe_parts.append(s)

swoosh_obj.name = "Swoosh"
for m in list(swoosh_obj.modifiers):
    bpy.context.view_layer.objects.active = swoosh_obj
    bpy.ops.object.modifier_apply(modifier=m.name)
swoosh_obj.data.materials.clear()
swoosh_obj.data.materials.append(mat_swoosh)
shoe_parts.append(swoosh_obj)

laces_mesh.data.materials.clear()
laces_mesh.data.materials.append(mat_laces)
shoe_parts.append(laces_mesh)

# 4. Rotate -90 degrees around Z so Toe faces +X and Heel faces -X
bpy.ops.object.select_all(action="DESELECT")
for o in shoe_parts:
    o.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

for o in shoe_parts:
    for v in o.data.vertices:
        old_x, old_y = v.co.x, v.co.y
        v.co.x = old_y
        v.co.y = -old_x

all_verts = [v.co for o in shoe_parts for v in o.data.vertices]
min_x, max_x = min(v.x for v in all_verts), max(v.x for v in all_verts)
min_y, max_y = min(v.y for v in all_verts), max(v.y for v in all_verts)
min_z, max_z = min(v.z for v in all_verts), max(v.z for v in all_verts)

scale_factor = 2.0 / (max_x - min_x)
mid_x, mid_y, mid_z = (min_x + max_x) / 2.0, (min_y + max_y) / 2.0, (min_z + max_z) / 2.0

for o in shoe_parts:
    for v in o.data.vertices:
        v.co.x = (v.co.x - mid_x) * scale_factor
        v.co.y = (v.co.y - mid_y) * scale_factor
        v.co.z = (v.co.z - mid_z) * scale_factor

# 5. CharmAnchor placement at top lateral lace eyelet
top_lateral_verts = [v for v in laces_mesh.data.vertices if v.co.z > 0.15 and v.co.y < -0.2 and -0.2 < v.co.x < 0.2]
if top_lateral_verts:
    best_v = min(top_lateral_verts, key=lambda v: v.co.y)
    anchor_loc = (best_v.co.x, best_v.co.y - 0.04, best_v.co.z - 0.02)
else:
    anchor_loc = (-0.05, -0.35, 0.30)

print(f"Calculated CharmAnchor location: {anchor_loc}")
anchor = bpy.data.objects.new("CharmAnchor", None)
bpy.context.scene.collection.objects.link(anchor)
anchor.location = anchor_loc

# 6. Export optimized GLB
bpy.ops.object.select_all(action="DESELECT")
for o in shoe_parts + [anchor]:
    o.select_set(True)

bpy.ops.export_scene.gltf(filepath=TARGET_GLB, use_selection=True, export_apply=True)
glb_sz = os.path.getsize(TARGET_GLB)
print(f"Exported GLB: {TARGET_GLB} ({glb_sz / 1024:.1f} KB)")

# 7. Render profile card thumbnail
cam = bpy.data.objects.new("CardCam", bpy.data.cameras.new("CardCam"))
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

cam.location = (0.0, -3.2, 0.1)
cam.rotation_euler = (math.radians(88), 0, 0)
cam.data.lens = 55

sun_data = bpy.data.lights.new(name="KeySun", type="SUN")
sun_data.energy = 4.0
sun1 = bpy.data.objects.new(name="KeySun", object_data=sun_data)
bpy.context.scene.collection.objects.link(sun1)
sun1.rotation_euler = (math.radians(45), math.radians(20), math.radians(45))

sun_data2 = bpy.data.lights.new(name="FillSun", type="SUN")
sun_data2.energy = 2.2
sun2 = bpy.data.objects.new(name="FillSun", object_data=sun_data2)
bpy.context.scene.collection.objects.link(sun2)
sun2.rotation_euler = (math.radians(-30), math.radians(-30), math.radians(140))

bpy.context.scene.world = bpy.data.worlds.new("World")
bpy.context.scene.world.use_nodes = True
bg = bpy.context.scene.world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.89, 0.91, 0.90, 1.0)
    bg.inputs["Strength"].default_value = 1.0

bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.45))
plane = bpy.context.active_object
mat_ground = bpy.data.materials.new("GroundMat")
mat_ground.use_nodes = True
bsdf = mat_ground.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs["Base Color"].default_value = (0.89, 0.91, 0.90, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.9
plane.data.materials.append(mat_ground)

bpy.context.scene.render.resolution_x = 800
bpy.context.scene.render.resolution_y = 450
bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
bpy.context.scene.render.filepath = os.path.abspath(TARGET_IMAGE)
bpy.ops.render.render(write_still=True)
img_sz = os.path.getsize(TARGET_IMAGE)
print(f"Rendered card image: {TARGET_IMAGE} ({img_sz / 1024:.1f} KB)")
