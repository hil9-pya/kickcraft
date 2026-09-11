# Creating a Customizable GLB Shoe with Antigravity and Blender

This tutorial follows the same process used to prepare the customizable KickCraft shoe.

## What you need

- Blender installed
- Antigravity
- An unbranded, original, or properly licensed shoe model in `.glb` format
- A separate working folder for the project

Avoid Nike, Adidas, New Balance, or other copyrighted designs unless you have permission.

## 1. Prepare the project folder

Create a folder such as:

```text
kickcraft-shoe-model/
├── source-shoe.glb
└── output/
```

Rename the downloaded model to `source-shoe.glb`. Keep an untouched backup in case something goes wrong.

## 2. Open the folder in Antigravity

Open the entire `kickcraft-shoe-model` folder as the workspace. Make sure Antigravity can access Blender.

Attach or mention the full path of `source-shoe.glb`.

## 3. Give Antigravity this prompt

Copy everything inside the following block and replace the source path with the actual file location:

```text
I need this GLB shoe prepared for a Vue and Google model-viewer shoe-customization system.

Source model:
[PUT THE FULL PATH TO source-shoe.glb HERE]

Use Blender to inspect and modify the model.

Requirements:

1. Preserve the original shoe shape, UV mapping, normal textures, and roughness/metallic/occlusion textures whenever possible.

2. Separate the visible shoe geometry into these eight independently customizable parts:

- Upper
- ToeCap
- Tongue
- Laces
- HeelPanel
- SideAccents
- Midsole
- Outsole

3. Each part must be a separate mesh object and must have its own material.

4. Use these exact mesh and material names because the KickCraft application depends on them:

- Upper
- ToeCap
- Tongue
- Laces
- HeelPanel
- SideAccents
- Midsole
- Outsole

5. Replace the main color texture with a neutral grayscale base named diffuseNeutral. Do not remove useful normal, roughness, metallic, or occlusion information.

6. Create an empty root object named Shoe_Root and parent all shoe parts to it.

7. Create an empty object named CharmAnchor. Place it near the upper lace eyelet where a small keychain or shoe charm can hang. Parent CharmAnchor to Shoe_Root.

8. Remove unused objects, hidden duplicate geometry, unnecessary materials, lights, cameras, and unused texture data.

9. Optimize the model for browser use. Target fewer than 30,000 triangles and a final file size below 5 MB without visibly damaging the shoe.

10. Test that each of the eight materials can be recolored independently without changing the other parts.

11. Export the completed model as:

output/shoe-kickcraft-ready.glb

Before finishing, report:

- Mesh names
- Material names
- Triangle count
- Final GLB size
- Included textures
- CharmAnchor location
- Whether independent recoloring was tested successfully

Do not modify the original source-shoe.glb file.
```

## 4. Check Antigravity's output

The final report should look similar to this:

```text
8 separate meshes
8 independent materials
Neutral grayscale base texture
Normal and ORM textures preserved
CharmAnchor parented to Shoe_Root
Independent recoloring tested
Final file exported successfully
```

Open the result in Blender and check the Outliner:

```text
Shoe_Root
├── Upper
├── ToeCap
├── Tongue
├── Laces
├── HeelPanel
├── SideAccents
├── Midsole
├── Outsole
└── CharmAnchor
```

## 5. Test independent recoloring

In Blender:

1. Select `Upper`.
2. Open **Material Properties**.
3. Change its Base Color.
4. Confirm only the upper changes.
5. Repeat for all eight parts.

If several parts change together, tell Antigravity:

```text
The materials are still shared. Give every customizable shoe part an independent material data block, then test recoloring again.
```

If geometry was separated incorrectly, use:

```text
The separation is inaccurate. Compare the visible shoe construction carefully and correct the boundaries without changing the shoe's overall shape or UV mapping.
```

## 6. Test the CharmAnchor

The `CharmAnchor` should be positioned beside a lace eyelet, not inside the shoe or floating far away.

Tell Antigravity:

```text
Move CharmAnchor beside the upper lace eyelet. It should provide enough clearance for a small hanging charm without intersecting the laces or upper.
```

## 7. Export settings

Antigravity should export using:

- Format: `glTF Binary (.glb)`
- Selected objects only, if appropriate
- Materials and textures included
- Apply modifiers
- No cameras or lights
- No unnecessary animations

The completed file should be:

```text
output/shoe-kickcraft-ready.glb
```

## Important compatibility note

For another KickCraft shoe, the charm models may need to be regenerated using that shoe's new `CharmAnchor` position. Preserve the exact eight mesh and material names because the recoloring code depends on them.
