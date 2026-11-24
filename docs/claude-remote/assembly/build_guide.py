"""Builds the T-Watch S3 pocket-watch build guide scene and renders its views.

    blender -b -P build_guide.py -- out/

Units are millimetres. Parts tagged "spec" take their size from the LilyGO listing,
chip datasheets or the 502530 cell code; everything tagged "illustrative" is a stand-in
sized to fit, not a measurement of a real unit.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

OUT = Path(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "out").resolve()
OUT.mkdir(parents=True, exist_ok=True)
SAMPLES = int(dict(enumerate(sys.argv)).get(sys.argv.index("--") + 2, 64)) if "--" in sys.argv else 64

# Envelope of the stock watch (illustrative) and spec-derived parts.
CASE_W, CASE_H = 44.0, 40.0  # x, y
SHELL_T, FLOOR_T = 6.0, 1.0
BATT = (30.0, 25.0, 5.0)  # 502530: 5 mm thick, 25 mm wide, 30 mm long
DISPLAY_ACTIVE = 1.54 * 25.4 / math.sqrt(2)  # 27.7 mm square from the 1.54" diagonal
PCB_T = 1.2

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 0.001
scene.unit_settings.length_unit = "MILLIMETERS"


def collection(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(c)
    return c


ROOT = collection("Watch build guide")
GUIDE = collection("Guide helpers", ROOT)


def material(name, color, rough=0.45, metal=0.0, alpha=1.0, emit=None, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1:
        m.blend_method = "BLEND"
    if image:
        tex = m.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(str(image))
        m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Emission Strength"].default_value = 0.9
    elif emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = 2.0
    return m


def srgb(h):
    return tuple(((int(h[i:i + 2], 16) / 255) ** 2.2) for i in (1, 3, 5))


M = {
    "shell": material("Case (illustrative)", srgb("#2b2f36"), 0.5),
    "bezel": material("Bezel (illustrative)", srgb("#3a3f47"), 0.35, 0.6),
    "glass": material("Cover glass", srgb("#dfe8f0"), 0.02, 0.0, 0.12),
    "pcb": material("PCB", srgb("#1f6f43"), 0.5),
    "module": material("ESP32-S3 module shield", srgb("#c7ccd1"), 0.25, 1.0),
    "chip": material("IC", srgb("#15171a"), 0.4),
    "battery": material("LiPo 502530", srgb("#5d6f86"), 0.35, 0.3),
    "wire_r": material("Wire red", srgb("#c0392b"), 0.4),
    "wire_k": material("Wire black", srgb("#111111"), 0.4),
    "brass": material("Bow and chain (illustrative)", srgb("#c9a24a"), 0.22, 1.0),
    "strap": material("Optional strap (ghost)", srgb("#d97757"), 0.6, 0.0, 0.35),
    "speaker": material("Speaker", srgb("#4a4f57"), 0.6),
    "screen": material("Screen", (0, 0, 0), 0.2, image=OUT / "screen.png"),
}


def finish(obj, coll, mat=None, bevel=0.0, segments=3):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    coll.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def box(name, size, loc, coll, mat=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, coll, mat, bevel)


def cyl(name, r, depth, loc, coll, mat=None, rot=(0, 0, 0), verts=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    return finish(o, coll, mat)


def torus(name, R, r, loc, coll, mat=None, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot,
                                     major_segments=40, minor_segments=14)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    return finish(o, coll, mat)


def cut(target, cutter):
    cutter.hide_render = True
    cutter.display_type = "WIRE"
    mod = target.modifiers.new("Cut " + cutter.name, "BOOLEAN")
    mod.object = cutter
    mod.solver = "EXACT"
    target.modifiers.move(len(target.modifiers) - 1, 0)


PARTS = {}


def part(key, label):
    coll = collection(label, ROOT)
    e = bpy.data.objects.new(key, None)
    e.empty_display_size = 4
    coll.objects.link(e)
    PARTS[key] = (e, coll)
    return e, coll


def parent_all(e, coll):
    for o in coll.objects:
        if o is not e:
            o.parent = e


# 1. Back shell with cavity, side crown and lugs.
e, c = part("back", "1 Back shell (illustrative)")
shell = box("Back shell", (CASE_W, CASE_H, SHELL_T), (0, 0, SHELL_T / 2), c, M["shell"], 3.0)
cav = box("Shell cavity cutter", (CASE_W - 3, CASE_H - 3, SHELL_T), (0, 0, SHELL_T / 2 + FLOOR_T), c)
cut(shell, cav)
cyl("Crown button", 2.6, 2.4, (CASE_W / 2 + 1.0, 4, 3.5), c, M["bezel"], rot=(0, math.pi / 2, 0))
for sx in (-1, 1):
    box("Spring-bar lug", (5, 5, 3.2), (sx * 12, -(CASE_H / 2 + 1.5), 3.0), c, M["shell"], 1.2)
    box("Spring-bar lug", (5, 5, 3.2), (sx * 12, CASE_H / 2 + 1.5, 3.0), c, M["shell"], 1.2)
parent_all(e, c)

# 2. Battery 502530 with JST lead.
e, c = part("battery", "2 Battery 502530 (spec)")
box("LiPo 502530", (BATT[0], BATT[1], BATT[2]), (0, -2, FLOOR_T + BATT[2] / 2), c, M["battery"], 1.0)
for i, (mat, dx) in enumerate(((M["wire_r"], -1.0), (M["wire_k"], 1.0))):
    cyl("Battery lead", 0.45, 9, (12 + dx, 13.5, FLOOR_T + 4.0), c, mat, rot=(math.pi / 2, 0, 0), verts=12)
box("JST plug", (5, 3, 2.4), (12, 18.5, FLOOR_T + 4.2), c, M["chip"], 0.3)
parent_all(e, c)

# 3. Main board with ESP32-S3 module, AXP2101, DRV2605, mic and speaker.
e, c = part("board", "3 Main board (illustrative layout)")
z = SHELL_T + 0.3
box("Main PCB", (CASE_W - 4, CASE_H - 4, PCB_T), (0, 0, z + PCB_T / 2), c, M["pcb"], 0.6)
top = z + PCB_T
box("ESP32-S3 module (16MB flash, 8MB PSRAM)", (18, 20, 2.8), (-6, 1, top + 1.4), c, M["module"], 0.3)
box("AXP2101 PMU", (5, 5, 0.9), (9.5, 8, top + 0.45), c, M["chip"])
box("DRV2605 haptics", (3, 3, 0.9), (9.5, 0, top + 0.45), c, M["chip"])
box("PDM mic", (3.5, 2.6, 1.2), (14, -6, top + 0.6), c, M["module"])
box("MAX98357A speaker", (12, 3.6, 3), (8, -16.6, z - 1.6), c, M["speaker"], 0.6)
box("Battery connector", (6, 4, 2.2), (12, 15.5, top + 1.1), c, M["chip"], 0.2)
parent_all(e, c)

# 4. Display module: 1.54" 240x240 ST7789 with FT6336 touch on top.
e, c = part("display", "4 Display + touch (spec size)")
dz = top + 3.4
box("1.54in display module", (DISPLAY_ACTIVE + 4, DISPLAY_ACTIVE + 6, 1.6), (0, 0, dz + 0.8), c, M["chip"], 0.5)
bpy.ops.mesh.primitive_plane_add(size=DISPLAY_ACTIVE, location=(0, 0.6, dz + 1.62))
screen = bpy.context.active_object
screen.name = "Active area 240x240"
finish(screen, c, M["screen"])
box("Display flex", (12, 6, 0.3), (0, -(DISPLAY_ACTIVE / 2 + 4), dz + 0.2), c, M["brass"])
parent_all(e, c)

# 5. Front bezel with cover glass.
e, c = part("bezel", "5 Front bezel + glass (illustrative)")
bz = dz + 1.7
bez = box("Front bezel", (CASE_W, CASE_H, 2.2), (0, 0, bz + 1.1), c, M["bezel"], 1.6)
win = box("Bezel window cutter", (DISPLAY_ACTIVE + 1.5, DISPLAY_ACTIVE + 1.5, 4), (0, 0.6, bz + 1.1), c)
cut(bez, win)
box("Cover glass", (DISPLAY_ACTIVE + 3, DISPLAY_ACTIVE + 3, 0.6), (0, 0.6, bz + 1.5), c, M["glass"], 0.4)
parent_all(e, c)
ASSEMBLED_TOP = bz + 2.2

# 6. Pocket carry: bow ring through the top lugs plus a short chain and clip (default carry).
e, c = part("carry", "6 Pocket bow + chain (illustrative)")
mid = 3.0
cyl("Bow pin", 0.9, 30, (0, CASE_H / 2 + 1.5, mid), c, M["brass"], rot=(0, math.pi / 2, 0), verts=16)
torus("Bow ring", 7.0, 1.3, (0, CASE_H / 2 + 7.5, mid), c, M["brass"])
pts = []
for i in range(15):
    t = i / 14
    pts.append(Vector((t * 40, CASE_H / 2 + 15 + 22 * math.sin(t * math.pi * 0.9), mid - 6 * t)))
for i in range(len(pts) - 1):
    a, b = pts[i], pts[i + 1]
    ang = math.atan2(b.y - a.y, b.x - a.x)
    rot = (0, 0, ang) if i % 2 else (math.pi / 2, 0, ang)
    torus("Chain link", 1.9, 0.45, (a + b) / 2, c, M["brass"], rot=rot, scale=(1.55, 1, 1))
torus("Belt clip ring", 4.5, 0.9, pts[-1] + Vector((4, 0, 0)), c, M["brass"], rot=(0, 0, 0))
box("Belt clip bar", (2, 14, 1.6), pts[-1] + Vector((9.5, -2, 0)), c, M["brass"], 0.6)
parent_all(e, c)

# 7. Optional wrist strap, shown as a ghost.
e, c = part("strap", "7 Wrist strap OPTIONAL")
for sy in (-1, 1):
    s = box("Optional strap", (22, 42, 2.2), (0, sy * (CASE_H / 2 + 22), 3.0), c, M["strap"], 1.0)
    s.rotation_euler = (sy * math.radians(-12), 0, 0)
parent_all(e, c)

# Lights, world and camera.
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.92, 0.92, 0.9, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
for name, loc, energy, size in (("Key", (90, -80, 160), 3.2e6, 120), ("Fill", (-140, -40, 80), 1.0e6, 160),
                                ("Rim", (-20, 150, 120), 1.6e6, 100)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = size
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    lo.rotation_euler = (Vector(loc) * -1).to_track_quat("-Z", "Y").to_euler()
    GUIDE.objects.link(lo)
cam_data = bpy.data.cameras.new("Camera")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("Camera", cam_data)
GUIDE.objects.link(cam)
scene.camera = cam
cam_data.clip_end = 2000

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1400, 1100
scene.render.film_transparent = True
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Punchy"


def look(direction, target, scale):
    target = Vector(target)
    cam.location = target + Vector(direction).normalized() * 600
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.ortho_scale = scale


SEATED = {k: Vector((0, 0, 0)) for k in PARTS}
EXPLODE = {"back": (0, 0, 0), "battery": (0, 0, 16), "board": (0, 0, 30), "display": (0, 0, 44),
           "bezel": (0, 0, 58), "carry": (0, 22, 0), "strap": (-64, 12, -6)}

ANCHORS = {
    "back": ((CASE_W / 2 - 1, -CASE_H / 2 + 4, 4), "Back shell", "≈44 × 40 × 13 mm watch envelope", "illustrative"),
    "battery": ((-BATT[0] / 2, -2, 4), "LiPo 502530", "5 × 25 × 30 mm, ~400-470 mAh, charge ≤125 mA", "spec"),
    "board": ((-6, 6, SHELL_T + 4.3), "ESP32-S3 board", "16 MB flash, 8 MB PSRAM, AXP2101", "spec"),
    "speaker": ((8, -16.6, SHELL_T - 1.3), "Speaker + PDM mic", "MAX98357A amp, mic on GPIO 47/44", "spec"),
    "display": ((DISPLAY_ACTIVE / 2, -6, dz + 1.6), "1.54\" display + touch", "240 × 240 ST7789, FT6336 touch", "spec"),
    "bezel": ((-CASE_W / 2 + 2, 6, bz + 2), "Front bezel + glass", "stand-in for the stock front", "illustrative"),
    "carry": ((0, CASE_H / 2 + 14.5, mid), "Pocket bow + chain", "default carry, through the top lugs", "illustrative"),
    "strap": ((0, -(CASE_H / 2 + 30), 3), "Wrist strap: OPTIONAL", "22 mm band, skip for pocket carry", "illustrative"),
}
PART_OF = {"speaker": "board"}


def project(p):
    v = world_to_camera_view(scene, cam, Vector(p))
    return round(v.x, 4), round(v.y, 4)


def pose(offsets, visible):
    for k, (e, c) in PARTS.items():
        e.location = Vector(offsets.get(k, (0, 0, 0)))
        hidden = k not in visible
        c.hide_render = hidden
        c.hide_viewport = hidden


VIEWS = [
    dict(name="0_exploded", title="Exploded overview",
         caption="Bottom to top: back shell, battery, board, display, bezel.\nBow and chain are the default carry; the strap is an optional extra.",
         offsets=EXPLODE, visible=list(PARTS), cam=((1.0, -1.25, 0.75), (-16, 8, 26), 150),
         labels={"back": "right", "battery": "left", "board": "left", "speaker": "right", "display": "right",
                 "bezel": "left", "carry": "right", "strap": "left"}),
    dict(name="1_battery", title="Step 1: battery into the back shell",
         caption="Seat the 502530 cell flat with its lead toward the top lugs.\nStock watches ship with it fitted; this is for a swap.",
         offsets={"battery": (0, 0, 18)}, visible=["back", "battery"], cam=((0.9, -1.2, 1.1), (0, 0, 8), 82),
         labels={"back": "right", "battery": "left"}, arrows=[("battery", (0, 0, 18), (0, 0, 7))]),
    dict(name="2_board", title="Step 2: board on top, battery plugged in",
         caption="Plug the JST lead into the board before seating it.\nCharge current must stay at 125 mA.",
         offsets={"board": (0, 0, 20)}, visible=["back", "battery", "board"], cam=((0.9, -1.2, 1.1), (0, 0, 12), 86),
         labels={"board": "left", "speaker": "right", "battery": "left"}, arrows=[("board", (0, 0, 20), (0, 0, 9))]),
    dict(name="3_display", title="Step 3: display, then the front bezel",
         caption="Route the display flex under the board edge,\nthen press the bezel and glass down over the screen.",
         offsets={"display": (0, 0, 16), "bezel": (0, 0, 30)}, visible=["back", "battery", "board", "display", "bezel"],
         cam=((0.9, -1.2, 1.1), (0, 0, 20), 96), labels={"display": "right", "bezel": "left"},
         arrows=[("display", (0, 0, 16), (0, 0, 12)), ("bezel", (0, 0, 30), (0, 0, 20))]),
    dict(name="4_pocket", title="Step 4: pocket-watch carry",
         caption="Fit the bow pin through the top lugs, then the chain and clip.\nNo strap needed; the screen faces you when you pull it out.",
         offsets={"carry": (0, 0, 0)}, visible=["back", "battery", "board", "display", "bezel", "carry"],
         cam=((0.35, -0.75, 1.4), (10, 22, 6), 118), labels={"carry": "right", "display": "left", "back": "left"}),
]


def anchor(key, offsets):
    loc, title, detail, kind = ANCHORS[key]
    owner = PART_OF.get(key, key)
    return Vector(loc) + Vector(offsets.get(owner, (0, 0, 0))), title, detail, kind


meta = {"views": []}
for v in VIEWS:
    pose(v["offsets"], v["visible"])
    look(*v["cam"])
    bpy.context.view_layer.update()
    labels = []
    for key, side in v["labels"].items():
        p, title, detail, kind = anchor(key, v["offsets"])
        x, y = project(p)
        labels.append(dict(key=key, x=x, y=y, side=side, title=title, detail=detail, kind=kind))
    arrows = []
    for key, start, end in v.get("arrows", []):
        base = Vector((CASE_W / 2 + 6, -CASE_H / 2, 4))
        arrows.append([project(base + Vector(start)), project(base + Vector(end))])
    meta["views"].append(dict(name=v["name"], title=v["title"], caption=v["caption"], labels=labels, arrows=arrows))
    scene.render.filepath = str(OUT / f"{v['name']}.png")
    bpy.ops.render.render(write_still=True)

(OUT / "labels.json").write_text(json.dumps(meta, indent=1))

# Leave the .blend in the exploded pose with every part visible and the camera on the overview.
pose(EXPLODE, list(PARTS))
look(*VIEWS[0]["cam"])
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "watch_build_guide.blend"), compress=True)

# glTF is in metres: export under a 0.001 root, without the boolean cutters or guide arrows.
root = bpy.data.objects.new("Watch (metres)", None)
scene.collection.objects.link(root)
root.scale = (0.001,) * 3
helpers = set(GUIDE.all_objects)
for o in scene.objects:
    if o.parent is None and o is not root and o.type in {"MESH", "EMPTY"} and o not in helpers:
        o.parent = root
bpy.ops.object.select_all(action="DESELECT")
for o in scene.objects:
    if o.type in {"MESH", "EMPTY"} and o not in helpers and "cutter" not in o.name:
        o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "watch_build_guide.glb"), export_apply=True, use_selection=True)
