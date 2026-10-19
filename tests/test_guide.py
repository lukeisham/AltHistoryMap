"""Checks the guide's cross-boundary section against the code in both directions, and that the README stays short and human.

Every path the section names must exist; every boundary value the code holds (port, launcher entry,
file magic, storage keys, drag type, plane order, projection numbers, the live address) must appear
in the section; and the files a row says are wired together must be wired that way in the browser
modules. Values come from the real modules, or for browser code that Python cannot import, from the
real source line that defines them.
"""

import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LUKEATRON = ROOT.parents[2]
APP = ROOT / "app"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "build"))
import build_scenarios  # noqa: E402
import raster  # noqa: E402
import serve  # noqa: E402

FILE_SUFFIXES = (".js", ".py", ".json", ".bin", ".css")
TREE_ROOTS = ("System/", "app/", "build/")
SECTION_HEADING = "## Cross-boundary behaviour"
README_MAX_LINES = 30
LIVE_URL = "https://lukeisham.github.io/AltHistoryMap/"
CLOUDFLARE_URL = "https://althistorymap.pages.dev/app/"
LAUNCHERS = ("Start AltHistoryMap.command",)


def guide_text() -> str:
    return (ROOT / "GUIDE.md").read_text(encoding="utf-8")


def guide_section() -> str:
    text = guide_text()
    start = text.index(SECTION_HEADING)
    following = re.search(r"^## ", text[start + len(SECTION_HEADING):], re.MULTILINE)
    return text[start : start + len(SECTION_HEADING) + following.start()] if following else text[start:]


def js_constant(source: Path, name: str) -> str | int | list[str]:
    """The literal a `const NAME = ...;` line holds. Browser modules cannot be imported here, so the defining line is read."""
    match = re.search(rf"^(?:export )?const {name} = (.+);$", source.read_text(encoding="utf-8"), re.MULTILINE)
    if match is None:
        raise AssertionError(f"no `const {name}` line in {source}")
    return json.loads(match.group(1))


def app_source(name: str) -> str:
    return (APP / name).read_text(encoding="utf-8")


def imports(consumer: str, provider: str) -> bool:
    return f'from "./{provider}"' in app_source(consumer)


def row_starting(section: str, first_cell: str) -> str:
    """The table row whose first cell begins with the given text."""
    rows = [line for line in section.splitlines() if line.startswith(f"| {first_cell}")]
    if len(rows) != 1:
        raise AssertionError(f"expected one guide row starting {first_cell!r}, found {len(rows)}")
    return rows[0]


def js_constant_in_object(source: Path, name: str, key: str) -> str:
    """The string a `const NAME = { key: "value", ... }` line holds under key."""
    line = re.search(rf"^const {name} = (.+);$", source.read_text(encoding="utf-8"), re.MULTILINE)
    if line is None:
        raise AssertionError(f"no `const {name}` line in {source}")
    value = re.search(rf'\b{key}: "([^"]+)"', line.group(1))
    if value is None:
        raise AssertionError(f"`{name}` has no string {key}")
    return value.group(1)


def nation_value() -> str:
    """The cityColour value markers.js compares against, so the guide must use the same word."""
    match = re.search(r'scene\.cityColour !== "(\w+)"', app_source("markers.js"))
    if match is None:
        raise AssertionError("markers.js no longer tests scene.cityColour")
    return match.group(1)


def js_default(source: Path, function: str) -> str:
    """The default `url = "..."` argument of an exported function, read from source because browser modules cannot be imported here."""
    match = re.search(rf'function {function}\(url = "([^"]+)"\)', source.read_text(encoding="utf-8"))
    if match is None:
        raise AssertionError(f"`{function}` in {source} has no default url")
    return match.group(1)


def supporter_ids() -> list[str]:
    """The animal ids in supporters.js, read from source because the browser module cannot be imported here."""
    ids = re.findall(r'id: "(\w+)", label: "', app_source("supporters.js"))
    if not ids:
        raise AssertionError("no supporter ids found in supporters.js")
    return ids


def serve_options() -> list[str]:
    """The command-line flags serve.py accepts, read from its source because its parser is built inside run()."""
    flags = re.findall(r'add_argument\("(--[\w-]+)"', (ROOT / "serve.py").read_text(encoding="utf-8"))
    if not flags:
        raise AssertionError("serve.py declares no command-line options, or the scan is broken")
    return flags


def named_paths(section: str) -> list[str]:
    """Backticked tokens that name a file or a folder in the tree, skipping identifiers and MIME types."""
    tokens = re.findall(r"`([^`\s]+)`", section)
    paths = []
    for token in tokens:
        if token.startswith(TREE_ROOTS):
            paths.append(token)
        elif "/" not in token and token.endswith(FILE_SUFFIXES) and not token.startswith("."):
            paths.append(token)
    return paths


def path_exists(token: str) -> bool:
    if token.startswith("System/"):
        return (LUKEATRON / token).exists()
    if token.startswith(TREE_ROOTS):
        return (ROOT / token).exists()
    return any(ROOT.rglob(token))


class GuideBoundaryTest(unittest.TestCase):
    def setUp(self) -> None:
        self.section = guide_section()

    def test_every_named_path_exists(self) -> None:
        paths = named_paths(self.section)
        self.assertGreater(len(paths), 20, "the path scan found almost nothing, so the scan is broken")
        missing = [token for token in paths if not path_exists(token)]
        self.assertEqual(missing, [])

    def test_every_boundary_value_in_the_code_is_named(self) -> None:
        recovery = APP / "recovery.js"
        model = APP / "model.js"
        values = {
            "port": str(serve.PORT),
            "local address": serve.HOST,
            "Content-Security-Policy": "Content-Security-Policy",
            "drag type": js_constant(APP / "dragitem.js", "ITEM_TYPE"),
            "map file magic": js_constant(APP / "mapfile.js", "MAGIC"),
            "base map magic": js_constant(APP / "api.js", "BASEMAP_MAGIC"),
            "IndexedDB name": js_constant(recovery, "DB_NAME"),
            "IndexedDB store": js_constant(recovery, "STORE"),
            "IndexedDB key": js_constant(recovery, "KEY"),
            "localStorage key": js_constant(recovery, "PREFS_KEY"),
            "ground bits": " ".join(f"{bit}={js_constant(model, bit)}" for bit in ("LAND", "RIVER", "LAKE", "COAST")),
            "plane order": ", ".join(js_constant(model, "PLANE_NAMES")),
            "grid side": str(raster.N),
            "latitude clamp": str(raster.MAX_LAT),
            "river overlay threshold": str(js_constant(APP / "layerimage.js", "RIVER_MIN_WIDTH")),
            "default city dot colour": js_constant_in_object(recovery, "DEFAULT_PREFS", "cityColour"),
            "city dot by nation": nation_value(),
            "live address": LIVE_URL,
            "cloudflare address": CLOUDFLARE_URL,
            "crest transparent cell": f"`TRANSPARENT` ({js_constant(APP / 'crestcells.js', 'TRANSPARENT')})",
            "crest size": f"{js_constant(APP / 'crestcells.js', 'CREST_W')} x {js_constant(APP / 'crestcells.js', 'CREST_H')} cells",
            "crest limit": "`MAX_CRESTS`",
            "flag size": f"{js_constant(model, 'FLAG_W')} x {js_constant(model, 'FLAG_H')}",
            "legacy flag scale": f"`LEGACY_FLAG_SCALE` ({js_constant(model, 'LEGACY_FLAG_SCALE')})",
            "saved flag cells": str(js_constant(model, "FLAG_W") * js_constant(model, "FLAG_H")),
            "legacy flag cells": str(js_constant(model, "FLAG_W") * js_constant(model, "FLAG_H") // js_constant(model, "LEGACY_FLAG_SCALE") ** 2),
            "scenario source scale": f"`SOURCE_SCALE`",
            "flag picture scale": f"`FLAG_PNG_CELL` ({js_constant(APP / 'pngexport.js', 'FLAG_PNG_CELL')})",
            "crest picture scale": f"`CREST_PNG_CELL` ({js_constant(APP / 'pngexport.js', 'CREST_PNG_CELL')})",
            "flag zoom element": 'data-role="flag-zoom"',
            "map file crests key": "`crests`",
        }
        values.update({f"supporter {name}": f"`{name}`" for name in supporter_ids()})
        values.update({f"launcher {name}": f"`{name}`" for name in LAUNCHERS})
        values.update({f"server option {flag}": flag for flag in serve_options()})
        missing = {label: value for label, value in values.items() if value not in self.section}
        self.assertEqual(missing, {})

    def test_the_grid_and_projection_numbers_match_in_both_languages(self) -> None:
        self.assertEqual(js_constant(APP / "model.js", "N"), raster.N)
        self.assertEqual(js_constant(APP / "model.js", "MAX_LAT"), raster.MAX_LAT)

    def test_the_flag_grid_and_its_scale_match_in_both_languages(self) -> None:
        model = APP / "model.js"
        self.assertEqual((js_constant(model, "FLAG_W"), js_constant(model, "FLAG_H")), (build_scenarios.FLAG_W, build_scenarios.FLAG_H))
        self.assertEqual(js_constant(model, "LEGACY_FLAG_SCALE"), build_scenarios.SOURCE_SCALE)

    def test_lukeatron_files_that_point_at_the_app_agree_with_serve(self) -> None:
        ports = json.loads((LUKEATRON / "System/Apps/ports.json").read_text(encoding="utf-8"))["ports"]
        self.assertEqual(ports[str(serve.PORT)]["path"], "System/Apps/AltHistoryMap")
        catalog = json.loads((LUKEATRON / "System/Apps/Home/catalog.json").read_text(encoding="utf-8"))
        launch = catalog["apps"]["AltHistoryMap"]["launch"]
        self.assertEqual(launch, {"kind": "server", "entry": "serve.py", "port": serve.PORT})
        self.assertTrue((ROOT / launch["entry"]).is_file())

    def test_every_listed_scenario_has_its_map_file(self) -> None:
        scenarios = APP / "data" / "scenarios"
        listed = json.loads((scenarios / "index.json").read_text(encoding="utf-8"))
        missing = [entry["id"] for entry in listed if not (scenarios / f"{entry['id']}.ahmap").is_file()]
        self.assertEqual(missing, [])

    def test_layer_rules_reach_the_modules_the_row_names(self) -> None:
        row = row_starting(self.section, "`layers.js`")
        for importer in ("state.js", "render.js", "recovery.js"):
            self.assertIn(f"`{importer}`", row)
            self.assertTrue(imports(importer, "layers.js"), f"{importer} does not import layers.js")
        for via_state in ("layerbar.js", "keys.js"):
            self.assertIn(f"`{via_state}`", row)
            self.assertNotIn('from "./layers.js"', app_source(via_state))
            self.assertIn("state.toggleView(", app_source(via_state))
        self.assertIn("`state.toggleView`", row)
        self.assertIn("`markers.js`", row)
        self.assertIn("`scene.layers`", row)
        self.assertIn("scene.layers", app_source("markers.js"))
        self.assertIn("layers: layersOnScreen(look)", app_source("render.js"))

    def test_every_look_has_a_drawing_loop_and_every_layer_shows_alone(self) -> None:
        layers_source = APP / "layers.js"
        views = js_constant(layers_source, "ALLOWED_VIEWS")
        self.assertTrue(all(len(view) == 1 for view in views), "a view shows more than one layer, which the guide says never happens")
        self.assertEqual(sorted(layer for view in views for layer in view), sorted(js_constant(APP / "model.js", "LAYERS")))
        looks_line = re.search(r"^export const LOOKS = (.+);$", layers_source.read_text(encoding="utf-8"), re.MULTILINE).group(1)
        looks = ["".join(view) for view in views] + re.findall(r'"(\w+)"', looks_line)
        drawing = app_source("layerimage.js")
        for look in looks:
            self.assertGreaterEqual(drawing.count(f'case "{look}":'), 2, f"layerimage.js has no loop for the {look} look")
        purpose = guide_text().split("## Purpose")[1].split("\n## ")[0]
        for layer in js_constant(APP / "model.js", "LAYERS"):
            self.assertIn(layer.capitalize(), purpose)

    def test_each_layer_offers_tools_and_no_layer_is_missing(self) -> None:
        offered = re.search(r"TOOLS_BY_LAYER = \{(.+?)\};", app_source("tools.js"), re.DOTALL).group(1)
        self.assertEqual(sorted(re.findall(r"^\s+(\w+):", offered, re.MULTILINE)), sorted(js_constant(APP / "model.js", "LAYERS")))

    def test_the_city_colour_choice_travels_from_the_button_to_the_dot(self) -> None:
        row = row_starting(self.section, "`markers.js`")
        for name in ("scene.cityColour", "renderer.setCityColour", "ahm.prefs", "cityColour"):
            self.assertIn(f"`{name}`", row)
        self.assertIn("cityColour", app_source("layerbar.js"))
        self.assertIn("renderer.setCityColour(", app_source("main.js"))
        render = app_source("render.js")
        self.assertIn("setCityColour(next)", render)
        self.assertRegex(render, r"cityColour,\n\s+political: model\.planes\.political")
        self.assertIn("cityColour", app_source("recovery.js"))
        self.assertIn("scene.cityColour", app_source("markers.js"))

    def test_the_change_notices_the_row_names_are_sent_and_handled(self) -> None:
        row = row_starting(self.section, "`model.js`")
        model, render = app_source("model.js"), app_source("render.js")
        for shape in ("{layer, rect}", "{markers}", "{palette}", "{all}"):
            self.assertIn(f"`{shape}`", row)
        for key in ("layer", "rect", "markers", "palette", "all"):
            self.assertRegex(model, rf"\b{key}\b[:,]", f"model.js never sends {key}")
            self.assertIn(f"notice.{key}", render, f"render.js never reads {key}")

    def test_the_brush_and_its_outline_share_disc_offsets(self) -> None:
        self.assertIn("`discOffsets`", row_starting(self.section, "`model.js`"))
        self.assertIn("export function discOffsets(", app_source("model.js"))
        self.assertIn("discOffsets(diameter)", app_source("model.js"))
        self.assertTrue(imports("viewport.js", "model.js") and "discOffsets" in app_source("viewport.js"))

    def test_no_interface_module_edits_the_map_except_through_the_editor(self) -> None:
        mutators = "beginStroke|strokeTo|endStroke|fill|addColour|addMarker|moveMarker|editMarker|deleteMarker|addDesign|updateDesign|addCrest|updateCrest"
        direct = [path.name for path in sorted(APP.glob("*.js")) if path.name not in ("model.js", "editor.js") and re.search(rf"\bmodel\.({mutators})\(", path.read_text(encoding="utf-8"))]
        self.assertEqual(direct, [])
        self.assertIn("function editGate()", app_source("editor.js"))
        self.assertIn("`editGate()`", row_starting(self.section, "interface modules"))

    def test_crest_choices_are_validated_by_the_one_validator_on_every_edit_and_every_read(self) -> None:
        row = row_starting(self.section, "`crestcells.js`")
        for name in ("model.js", "mapfile.js", "flagcells.js", "flagdesigner.js", "crestmaker.js", "creststrip.js", "crests.js", "normaliseCrest", "renderCrest", "stampCrest"):
            self.assertIn(f"`{name}`", row)
        self.assertTrue(imports("model.js", "crestcells.js") and imports("mapfile.js", "crestcells.js") and imports("flagcells.js", "crestcells.js"))
        self.assertIn("normaliseCrest(crest, model.palette.length)", app_source("model.js"))
        self.assertIn("normaliseCrest(crest, palette.length)", app_source("mapfile.js"))
        self.assertIn("stampCrest(cells, crests[crestIndex]", app_source("flagdesigner.js"))
        supporter_keys = [f"supporter{side}{suffix}" for side in ("Left", "Right") for suffix in ("", "Colour")]
        for key in js_constant(APP / "crestcells.js", "COLOUR_KEYS") + js_constant(APP / "crestcells.js", "CHOICE_KEYS") + supporter_keys:
            self.assertIn(f"`{key}`", row)
        for key in supporter_keys:
            self.assertIn(f"supporter${{side}}", app_source("crestcells.js"), f"normaliseCrest no longer handles {key}")
        self.assertIn("`MAX_CRESTS`", row_starting(self.section, "`model.js`"))

    def test_a_map_file_without_crests_still_opens(self) -> None:
        row = row_starting(self.section, "`mapfile.js` | `model.js`")
        self.assertIn("`crests`", row)
        self.assertIn("h.crests ?? []", app_source("mapfile.js"))
        for number in (js_constant(APP / "mapfile.js", "MAGIC"), "(1)"):
            self.assertIn(number, row)
        self.assertIn("format: 1", app_source("mapfile.js"))

    def test_picked_colours_and_pictures_reach_the_page_through_main(self) -> None:
        row = next(line for line in self.section.splitlines() if line.startswith("| `flagdesigner.js`, `crestmaker.js`"))
        main = app_source("main.js")
        self.assertIn("const addColour = (hex) => editor.addColour(hex);", main)
        self.assertEqual(main.count("addColour,"), 2, "main.js must hand addColour to both dialogs")
        self.assertIn("getCrests: () => model.crests.map(renderCrest)", main)
        self.assertEqual(main.count("saveBlob: downloadBlob"), 2)
        for name in ("addColour(hex)", "getCrests", "saveBlob", "downloadBlob", "editor.addColour"):
            self.assertIn(f"`{name}`", row)
        for dialog in ("flagdesigner.js", "crestmaker.js"):
            self.assertIn("cellsToPng(", app_source(dialog))
            self.assertTrue(imports(dialog, "pngexport.js"))
        pictures = row_starting(self.section, "`pngexport.js`")
        for name in ("flagdesigner.js", "crestmaker.js", "flagzoom.js", "creststrip.js", "designs.js", "crests.js"):
            self.assertIn(f"`{name}`", pictures)
        self.assertTrue(imports("flagzoom.js", "pngexport.js") and imports("creststrip.js", "pngexport.js"))
        self.assertIn("-flag", app_source("designs.js"))
        self.assertIn("-crest", app_source("crests.js"))

    def test_supporters_reach_crestcells_and_the_crest_maker_lists_them(self) -> None:
        row = row_starting(self.section, "`supporters.js`")
        for name in ("crestcells.js", "SUPPORTERS", "rasterSupporter(id)", "BODY", "EYE", *supporter_ids()):
            self.assertIn(f"`{name}`", row)
        self.assertTrue(imports("crestcells.js", "supporters.js"))
        self.assertIn("rasterSupporter(animalId)", app_source("crestcells.js"))
        self.assertIn("options: SUPPORTERS", app_source("crestmaker.js"))

    def test_term_pop_ups_are_bound_by_both_dialogs_and_every_group_is_named(self) -> None:
        row = row_starting(self.section, "`terms.js`")
        for name in ("termtip.js", "crestmaker.js", "flagdesigner.js", "termFor", "bindTermTips(dialog)", "data-term"):
            self.assertIn(f"`{name}`" if name.endswith(".js") else name, row)
        self.assertTrue(imports("termtip.js", "terms.js"))
        for dialog in ("flagdesigner.js", "crestmaker.js"):
            self.assertTrue(imports(dialog, "termtip.js"))
            self.assertIn("bindTermTips(dialog)", app_source(dialog))
        groups = set(re.findall(r'^  "(\w+):', app_source("terms.js"), re.MULTILINE))
        self.assertGreater(len(groups), 8, "the group scan found almost nothing")
        for group in groups:
            self.assertIn(f"`{group}`", row)
        self.assertIn('href="termtip.css"', (APP / "index.html").read_text(encoding="utf-8"))

    def test_placed_flags_and_thumbnails_draw_from_flag_blocks(self) -> None:
        row = row_starting(self.section, "`flagblocks.js`")
        for name in ("markers.js", "flagstrip.js", "flagzoom.js"):
            self.assertIn(f"`{name}`", row)
        self.assertTrue(imports("markers.js", "flagblocks.js") and imports("flagstrip.js", "flagblocks.js"))
        self.assertIn("flagBlocks(", app_source("markers.js"))
        self.assertIn("flagBlocks(", app_source("flagstrip.js"))

    def test_an_older_flag_is_scaled_up_when_a_map_opens(self) -> None:
        row = next(line for line in self.section.splitlines() if line.startswith("| `FLAG_W`, `FLAG_H`"))
        for name in ("mapfile.js", "flagcells.js", "upscaleLegacyFlag"):
            self.assertIn(name, row)
        self.assertTrue(imports("mapfile.js", "flagcells.js"))
        self.assertIn("upscaleLegacyFlag(design)", app_source("mapfile.js"))

    def test_the_flag_zoom_is_shown_by_the_stage_and_the_flag_list_and_hidden_again(self) -> None:
        row = row_starting(self.section, "`flagzoom.js`")
        for name in ("stage.js", "flagstrip.js", "main.js"):
            self.assertIn(f"`{name}`", row)
        main = app_source("main.js")
        self.assertIn("createFlagZoom({", main)
        self.assertEqual(main.count("flagZoom,"), 2, "main.js must hand flagZoom to the stage and the flag list")
        self.assertIn('data-role="flag-zoom"', (APP / "index.html").read_text(encoding="utf-8"))
        for source in ("stage.js", "flagstrip.js"):
            self.assertIn("flagZoom.show(", app_source(source))
            self.assertIn("flagZoom.hide(", app_source(source))

    def test_the_publish_workflow_mirrors_the_app_folder_after_the_tests_and_keeps_private_and_public_only_files_apart(self) -> None:
        row = next(line for line in self.section.splitlines() if line.startswith("| `.github/workflows/publish-althistorymap.yml`"))
        workflow = (LUKEATRON / ".github/workflows/publish-althistorymap.yml").read_text(encoding="utf-8")
        for name in ("PUBLIC_REPO_TOKEN", "lukeisham/AltHistoryMap", "System/Apps/AltHistoryMap", "issues.md", "index.html", ".nojekyll", CLOUDFLARE_URL):
            self.assertIn(name, row)
        self.assertIn("secrets.PUBLIC_REPO_TOKEN", workflow)
        self.assertIn("repository: lukeisham/AltHistoryMap", workflow)
        for excluded in ("issues.md", "index.html", ".nojekyll"):
            self.assertIn(f"--exclude /{excluded}", workflow)
        self.assertNotRegex(workflow, r"--exclude (?!/)(issues\.md|index\.html|\.nojekyll)", "an unanchored exclude would also skip app/index.html")
        self.assertLess(workflow.index("node --test"), workflow.index("rsync"), "the tests must run before anything is mirrored")
        self.assertIn('paths: ["System/Apps/AltHistoryMap/**"]', workflow)

    def test_the_drag_payload_module_is_used_by_both_ends(self) -> None:
        row = next(line for line in self.section.splitlines() if "`dragitem.js`" in line)
        for name in ("symbols.js", "flagstrip.js", "stage.js"):
            self.assertIn(f"`{name}`", row)
            self.assertTrue(imports(name, "dragitem.js"), f"{name} does not import dragitem.js")

    def test_glyphs_reach_the_modules_the_row_names(self) -> None:
        row = row_starting(self.section, "`app/glyphs.js`")
        for name in ("build_scenarios.py", "editor.js", "main.js", "mapfile.js", "symbols.js", "render.js", "markers.js"):
            self.assertIn(f"`{name}`", row)
        self.assertIn("glyphs.js", (ROOT / "build" / "build_scenarios.py").read_text(encoding="utf-8"))
        self.assertTrue(imports("editor.js", "glyphs.js") and imports("main.js", "glyphs.js"))
        main = app_source("main.js")
        self.assertIn("glyphIds", main)
        self.assertIn("glyphs: GLYPHS", main)
        self.assertIn("createGlyphLibrary(glyphs)", app_source("render.js"))
        self.assertIn('"solid": true', app_source("glyphs.js"))
        self.assertIn("`solid`", row)

    def test_each_launcher_exists_and_runs_serve_py(self) -> None:
        for name in LAUNCHERS:
            launcher = ROOT / name
            self.assertTrue(launcher.is_file(), f"{name} is missing")
            self.assertIn("serve.py", launcher.read_text(encoding="utf-8"))

    def test_the_app_loads_only_relative_urls_so_it_works_under_the_pages_sub_path(self) -> None:
        row = next(line for line in self.section.splitlines() if "GitHub Pages" in line)
        for name in ("index.html", ".nojekyll"):
            self.assertIn(f"`{name}`", row)
        self.assertTrue((APP / "index.html").is_file())
        root_absolute = re.compile(r"""(?:src|href|action)=["']/|url\(\s*["']?/|fetch\(\s*["'`]/""")
        offenders = [path.name for path in sorted(APP.glob("*.*")) if path.suffix in (".html", ".css", ".js") and root_absolute.search(path.read_text(encoding="utf-8"))]
        self.assertEqual(offenders, [])
        for url in (js_default(APP / "api.js", "loadBasemap"), js_default(APP / "api.js", "loadScenarioIndex")):
            self.assertFalse(url.startswith("/"), f"{url} is root-absolute")
            self.assertIn(url.split("/")[0] + "/", row)


class ReadmeStaysHumanTest(unittest.TestCase):
    def setUp(self) -> None:
        self.text = (ROOT / "README.md").read_text(encoding="utf-8")

    def test_it_is_short(self) -> None:
        self.assertLessEqual(len(self.text.splitlines()), README_MAX_LINES)

    def test_it_holds_no_table_tree_or_developer_heading(self) -> None:
        self.assertNotRegex(self.text, r"(?m)^\|", "a table belongs in the guide")
        self.assertNotIn("```", self.text, "a tree or code block belongs in the guide")
        self.assertNotRegex(self.text, r"(?im)^#+ .*(cross-boundary|navigation|developer|cross-app|decisions)")

    def test_every_path_it_names_exists(self) -> None:
        self.assertEqual([token for token in named_paths(self.text) if not path_exists(token)], [])

    def test_it_points_visitors_at_the_live_site_not_a_download(self) -> None:
        self.assertIn(LIVE_URL, self.text)
        self.assertIn(CLOUDFLARE_URL, self.text)
        self.assertNotRegex(self.text, r"(?i)download the code|download zip|git clone|python3? |serve\.py")

    def test_every_control_it_names_is_on_the_page(self) -> None:
        page = (APP / "index.html").read_text(encoding="utf-8")
        for control in ("Scenarios", "Political", "Province", "Culture", "Edit", "Cities by nation", "Save", "Open", "PNG"):
            self.assertIn(f"**{control}**", self.text)
            self.assertIn(control, page, f"the README names {control} but the page has no such control")


if __name__ == "__main__":
    unittest.main()
