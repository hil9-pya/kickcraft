from pathlib import Path
import math

import bpy


PROJECT = Path(__file__).resolve().parents[1]
SHOE = PROJECT / "public" / "models" / "shoe-soleview-final.glb"
OUTPUT = PROJECT / "public" / "models" / "charms"

STAR_POINTS = [
    (
        math.sin(index * math.pi / 5) * (0.014 if index % 2 == 0 else 0.0065),
        -0.038 + math.cos(index * math.pi / 5) * (0.014 if index % 2 == 0 else 0.0065),
    )
    for index in range(10)
]

LIGHTNING_POINTS = [
    (-0.004, -0.021),
    (0.007, -0.021),
    (0.001, -0.034),
    (0.010, -0.034),
    (-0.006, -0.056),
    (-0.002, -0.041),
    (-0.011, -0.041),
]

TAG_POINTS = [
    (-0.013, -0.024),
    (0.013, -0.024),
    (0.013, -0.052),
    (-0.013, -0.052),
]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def load_anchor_matrix():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(SHOE))
    anchor = bpy.data.objects.get("CharmAnchor")
    if anchor is None:
        raise RuntimeError("CharmAnchor is missing from the shoe model")
    matrix = anchor.matrix_world.copy()
    clear_scene()
    return matrix


def make_material():
    material = bpy.data.materials.get("CharmMetal") or bpy.data.materials.new("CharmMetal")
    material.diffuse_color = (0.055, 0.065, 0.075, 1.0)
    material.metallic = 0.72
    material.roughness = 0.3
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = material.diffuse_color
    shader.inputs["Metallic"].default_value = material.metallic
    shader.inputs["Roughness"].default_value = material.roughness
    return material


def make_outline(name, points, thickness, material):
    count = len(points)
    vertices = [(x, -thickness / 2, z) for x, z in points]
    vertices += [(x, thickness / 2, z) for x, z in points]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [
        (index, (index + 1) % count, (index + 1) % count + count, index + count)
        for index in range(count)
    ]

    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bevel = obj.modifiers.new("SoftEdge", "BEVEL")
    bevel.width = 0.0012
    bevel.segments = 2
    return obj


def make_ring(material):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.008,
        minor_radius=0.0015,
        major_segments=20,
        minor_segments=6,
        location=(0, 0, 0),
        rotation=(math.radians(90), 0, 0),
    )
    ring = bpy.context.object
    ring.name = "ConnectorRing"
    ring.data.materials.append(material)
    return ring


def make_link(material):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12,
        radius=0.0015,
        depth=0.017,
        location=(0, 0, -0.0165),
    )
    link = bpy.context.object
    link.name = "ConnectorLink"
    link.data.materials.append(material)
    return link


def make_bar(name, location, length, angle, material):
    bpy.ops.mesh.primitive_cube_add(location=location)
    bar = bpy.context.object
    bar.name = name
    bar.dimensions = (0.0028, 0.0015, length)
    bar.rotation_euler[1] = math.radians(angle)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bar.data.materials.append(material)
    bevel = bar.modifiers.new("SoftEdge", "BEVEL")
    bevel.width = 0.0006
    bevel.segments = 2
    return bar


def make_k_tag(material):
    pieces = [make_outline("KTagCharm", TAG_POINTS, 0.004, material)]
    pieces.append(make_bar("KStem", (-0.0045, -0.0027, -0.038), 0.018, 0, material))
    pieces.append(make_bar("KUpper", (0.0005, -0.0027, -0.0335), 0.012, -45, material))
    pieces.append(make_bar("KLower", (0.0005, -0.0027, -0.0425), 0.012, 45, material))
    return pieces


def apply_modifiers(objects):
    for obj in objects:
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)


def build_and_export(slug, mesh_name, anchor_matrix):
    clear_scene()
    material = make_material()

    bpy.ops.object.empty_add(type="PLAIN_AXES")
    root = bpy.context.object
    root.name = "CharmRoot"
    root.matrix_world = anchor_matrix

    ring = make_ring(material)
    link = make_link(material)
    if slug == "star":
        pieces = [make_outline(mesh_name, STAR_POINTS, 0.004, material)]
    elif slug == "lightning":
        pieces = [make_outline(mesh_name, LIGHTNING_POINTS, 0.004, material)]
    elif slug == "k-tag":
        pieces = make_k_tag(material)
    else:
        raise ValueError(f"Unknown charm: {slug}")

    meshes = [ring, link, *pieces]
    apply_modifiers(meshes)
    for obj in meshes:
        obj.parent = root

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in meshes:
        obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / f"{slug}-charm.glb"),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_animations=False,
    )


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    anchor_matrix = load_anchor_matrix()
    build_and_export("star", "StarCharm", anchor_matrix)
    build_and_export("lightning", "LightningCharm", anchor_matrix)
    build_and_export("k-tag", "KTagCharm", anchor_matrix)


if __name__ == "__main__":
    main()
