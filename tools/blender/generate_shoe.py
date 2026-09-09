from math import radians
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "output" / "models"
BLEND_PATH = OUTPUT_DIR / "soleview-shoe.blend"
GLB_PATH = OUTPUT_DIR / "soleview-shoe.glb"
PREVIEW_PATH = OUTPUT_DIR / "soleview-shoe-preview.png"


def material(name, color, metallic=0.0, roughness=0.55):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return mat


def finish(obj, mat, bevel=0.0):
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def prism(name, points, bottom, top, mat, bevel=0.08):
    count = len(points)
    vertices = [(x, y, bottom) for x, y in points]
    vertices += [(x, y, top) for x, y in points]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [
        (i, (i + 1) % count, (i + 1) % count + count, i + count)
        for i in range(count)
    ]
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return finish(obj, mat, bevel)


def loft(name, rings, mat, bevel=0.06):
    count = len(rings[0])
    vertices = [vertex for ring in rings for vertex in ring]
    faces = [tuple(reversed(range(count)))]
    for ring_index in range(len(rings) - 1):
        start = ring_index * count
        next_start = start + count
        faces += [
            (
                start + i,
                start + (i + 1) % count,
                next_start + (i + 1) % count,
                next_start + i,
            )
            for i in range(count)
        ]
    last = (len(rings) - 1) * count
    faces.append(tuple(range(last, last + count)))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return finish(obj, mat, bevel)


def rounded_box(name, location, dimensions, rotation, mat, bevel=0.12):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, bevel)


def ellipsoid(name, location, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat)


def lace_bundle(mat):
    curve = bpy.data.curves.new("LacesCurve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = 0.045
    curve.bevel_resolution = 3

    for index, x in enumerate((-0.15, 0.25, 0.65, 1.05)):
        z = 2.34 - (index * 0.13)
        for flip in (-1, 1):
            spline = curve.splines.new("BEZIER")
            spline.bezier_points.add(2)
            coords = [
                (x - 0.20, -0.68 * flip, z),
                (x, 0.0, z + 0.08),
                (x + 0.20, 0.68 * flip, z),
            ]
            for point, coordinate in zip(spline.bezier_points, coords):
                point.co = coordinate
                point.handle_left_type = "AUTO"
                point.handle_right_type = "AUTO"

    obj = bpy.data.objects.new("Laces", curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return obj


def joined_eyelets(mat):
    objects = []
    for x_index, x in enumerate((-0.10, 0.30, 0.70, 1.10)):
        z = 2.27 - (x_index * 0.13)
        for y in (-0.72, 0.72):
            bpy.ops.mesh.primitive_torus_add(
                major_radius=0.085,
                minor_radius=0.025,
                major_segments=20,
                minor_segments=8,
                location=(x, y, z),
                rotation=(radians(90), 0, 0),
            )
            objects.append(bpy.context.object)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    eyelets = bpy.context.object
    eyelets.name = "Eyelets"
    return finish(eyelets, mat)


def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


bpy.ops.wm.read_factory_settings(use_empty=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

upper_mat = material("UpperMaterial", (0.57, 0.68, 0.72), roughness=0.72)
midsole_mat = material("MidsoleMaterial", (0.92, 0.90, 0.83), roughness=0.62)
outsole_mat = material("OutsoleMaterial", (0.08, 0.12, 0.16), roughness=0.70)
accent_mat = material("AccentMaterial", (0.88, 0.29, 0.18), roughness=0.55)
lace_mat = material("LaceMaterial", (0.96, 0.95, 0.90), roughness=0.80)
metal_mat = material("HardwareMaterial", (0.18, 0.21, 0.23), metallic=0.75, roughness=0.28)
lining_mat = material("LiningMaterial", (0.035, 0.05, 0.065), roughness=0.90)

footprint = [
    (-3.25, -0.92),
    (-2.15, -1.15),
    (-0.35, -1.25),
    (1.65, -1.12),
    (2.85, -0.82),
    (3.45, -0.30),
    (3.55, 0.30),
    (2.85, 0.82),
    (1.65, 1.12),
    (-0.35, 1.25),
    (-2.15, 1.15),
    (-3.25, 0.92),
]

shoe_parts = []
shoe_parts.append(prism("Outsole", footprint, 0.0, 0.28, outsole_mat, 0.09))
midsole_footprint = [(x * 0.99, y * 0.98) for x, y in footprint]
shoe_parts.append(prism("Midsole", midsole_footprint, 0.27, 0.66, midsole_mat, 0.11))

upper_base = [(x * 0.92, y * 0.86, 0.61) for x, y in footprint]
upper_mid = []
upper_top = []
for x, y in footprint:
    scaled_x = x * 0.86
    height = 1.25 + max(0.0, (1.8 - abs(x + 0.65)) * 0.36)
    if x < -1.8:
        height += 0.55
    upper_mid.append((scaled_x, y * 0.67, height))
    upper_top.append((scaled_x * 0.94, y * 0.50, height + 0.32))
shoe_parts.append(loft("Upper", [upper_base, upper_mid, upper_top], upper_mat, 0.08))

shoe_parts.append(ellipsoid("ToeCap", (2.35, 0, 1.08), (1.22, 0.92, 0.40), accent_mat))
shoe_parts.append(
    rounded_box(
        "HeelPanel",
        (-2.72, 0, 1.55),
        (0.48, 1.72, 1.42),
        (0, radians(-8), 0),
        accent_mat,
        0.16,
    )
)
shoe_parts.append(
    rounded_box(
        "Tongue",
        (0.15, 0, 2.05),
        (2.35, 0.82, 0.13),
        (0, radians(-14), 0),
        upper_mat,
        0.16,
    )
)
shoe_parts.append(lace_bundle(lace_mat))
shoe_parts.append(joined_eyelets(metal_mat))

bpy.ops.mesh.primitive_torus_add(
    major_radius=0.15,
    minor_radius=0.038,
    major_segments=28,
    minor_segments=10,
    location=(-1.20, -1.00, 1.63),
    rotation=(radians(90), 0, 0),
)
anchor = bpy.context.object
anchor.name = "CharmAnchor"
shoe_parts.append(finish(anchor, metal_mat))

# A dark inset visually suggests the collar opening while remaining a separate material zone.
shoe_parts.append(ellipsoid("Collar", (-1.75, 0, 2.20), (0.82, 0.70, 0.12), lining_mat))

# Export only product components, not the preview ground, camera, or lights.
bpy.ops.object.select_all(action="DESELECT")
for obj in shoe_parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = shoe_parts[0]
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)

ground_mat = material("GroundMaterial", (0.025, 0.035, 0.05), roughness=0.90)
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.03))
ground = bpy.context.object
ground.name = "PreviewGround"
ground.data.materials.append(ground_mat)

bpy.ops.object.camera_add(location=(9.3, -10.5, 6.5))
camera = bpy.context.object
camera.name = "PreviewCamera"
look_at(camera, (0.1, 0, 1.15))
bpy.context.scene.camera = camera

for name, location, energy, size in (
    ("KeyLight", (2.5, -5.5, 8.0), 1050, 5.0),
    ("FillLight", (-5.0, -1.0, 4.0), 750, 4.0),
    ("RimLight", (4.0, 5.0, 5.0), 900, 3.0),
):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    look_at(light, (0, 0, 1))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1000
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(PREVIEW_PATH)
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("PreviewWorld")
scene.world.color = (0.012, 0.018, 0.028)
scene.view_settings.look = "AgX - Medium High Contrast"

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
bpy.ops.render.render(write_still=True)

print(f"Created {BLEND_PATH}")
print(f"Created {GLB_PATH}")
print(f"Created {PREVIEW_PATH}")
