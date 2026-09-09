from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = PROJECT_ROOT / "output" / "models" / "soleview-shoe.glb"
BLEND_PATH = PROJECT_ROOT / "output" / "models" / "soleview-shoe.blend"
PREVIEW_PATH = PROJECT_ROOT / "output" / "models" / "soleview-shoe-preview.png"
EXPECTED_PARTS = {
    "Upper",
    "Midsole",
    "Outsole",
    "ToeCap",
    "HeelPanel",
    "Tongue",
    "Laces",
    "Eyelets",
    "CharmAnchor",
}


assert MODEL_PATH.exists(), f"Missing generated model: {MODEL_PATH}"
assert BLEND_PATH.exists(), f"Missing editable Blender file: {BLEND_PATH}"
assert PREVIEW_PATH.exists(), f"Missing preview image: {PREVIEW_PATH}"
assert MODEL_PATH.stat().st_size > 50_000, "Generated GLB is unexpectedly small"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(MODEL_PATH))

mesh_objects = {obj.name: obj for obj in bpy.data.objects if obj.type == "MESH"}
missing = EXPECTED_PARTS - mesh_objects.keys()
assert not missing, f"GLB is missing customizable mesh parts: {sorted(missing)}"

for name in EXPECTED_PARTS:
    obj = mesh_objects[name]
    assert len(obj.data.vertices) > 0, f"{name} contains no geometry"
    assert obj.material_slots, f"{name} has no customizable material"

print(f"PASS: {MODEL_PATH.name} contains {len(EXPECTED_PARTS)} customizable parts")
