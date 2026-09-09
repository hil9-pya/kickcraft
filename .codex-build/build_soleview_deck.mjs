import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:/Users/Ariel/Documents/ChatGPT/New project";
const SKILL_DIR = "C:/Users/Ariel/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const TMP_DIR = path.join(workspaceDir, ".codex-build");
const FINAL_PPTX = path.join(workspaceDir, "output/presentation/SoleView-Title-Presentation-v3.pptx");
const RUNTIME_PYTHON = "C:/Users/Ariel/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";

const { resolvePresentationFont, makeNativeBulletParagraphs, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href,
);

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });

const font = resolvePresentationFont({ fontFamily: "Aptos" });
const W = 1280;
const H = 720;
const C = {
  bg: "#FAF8F5",
  paper: "#FFFFFF",
  ink: "#292524",
  muted: "#78716C",
  line: "#D6D3D1",
  orange: "#B45309",
  orangeLight: "#FFF1E6",
  green: "#0F766E",
  greenLight: "#E7F4F1",
  rose: "#BE6F87",
  dark: "#1C1917",
};

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

const imgPaths = {
  cover: path.join(workspaceDir, "public/images/stride-pro.jpg"),
  context: path.join(workspaceDir, "public/images/flow-lite.jpg"),
  problem: path.join(workspaceDir, "public/images/pulse-move.jpg"),
  ui: path.join(workspaceDir, "output/imagegen/shoe-showroom-ui-concept-v2.png"),
};
const img = {
  cover: new Uint8Array(await fs.readFile(imgPaths.cover)),
  context: new Uint8Array(await fs.readFile(imgPaths.context)),
  problem: new Uint8Array(await fs.readFile(imgPaths.problem)),
  ui: new Uint8Array(await fs.readFile(imgPaths.ui)),
};

function addShape(slide, position, fill = "none", line = "none", geometry = "rect") {
  return slide.shapes.add({
    geometry,
    position,
    fill,
    line: line === "none" ? { fill: "none", width: 0 } : line,
  });
}

function addText(slide, text, position, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: font,
    fontSize: opts.fontSize ?? 24,
    bold: opts.bold ?? false,
    color: opts.color ?? C.ink,
    alignment: opts.alignment ?? "left",
    verticalAlignment: opts.verticalAlignment ?? "top",
    autoFit: opts.autoFit ?? "none",
  };
  return shape;
}

function addBullets(slide, items, position, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  shape.text = makeNativeBulletParagraphs(items, {
    marginLeftPoints: 18,
    hangingPoints: 9,
    spaceAfterPoints: opts.spaceAfterPoints ?? 11,
  });
  shape.text.style = {
    typeface: font,
    fontSize: opts.fontSize ?? 23,
    color: opts.color ?? C.ink,
    autoFit: "none",
  };
  return shape;
}

function addTitle(slide, title, number) {
  addText(slide, title, { left: 64, top: 42, width: 1060, height: 56 }, { fontSize: 43, bold: true });
  addText(slide, String(number).padStart(2, "0"), { left: 1160, top: 52, width: 56, height: 32 }, { fontSize: 18, bold: true, color: C.orange, alignment: "right" });
  addShape(slide, { left: 64, top: 112, width: 1152, height: 2 }, C.line);
}

function addFooter(slide) {
  addText(slide, "SoleView proposal", { left: 64, top: 680, width: 300, height: 20 }, { fontSize: 14, color: C.muted });
}

function addImage(slide, bytes, type, position, alt, fit = "cover", crop) {
  return slide.images.add({
    blob: bytes,
    contentType: type,
    alt,
    fit,
    position,
    ...(crop ? { crop } : {}),
  });
}

function notes(slide, text) {
  slide.speakerNotes.textFrame.setText(text);
}

// Slide 1: Title
{
  const s = presentation.slides.add();
  s.background.fill = C.dark;
  addImage(s, img.cover, "image/jpeg", { left: 750, top: 0, width: 530, height: 720 }, "Brown sneaker photographed on warm fabric", "cover", { left: 0.10, top: 0, right: 0.06, bottom: 0 });
  addShape(s, { left: 0, top: 0, width: 750, height: 720 }, C.dark);
  addText(s, "SOLEVIEW", { left: 70, top: 64, width: 300, height: 42 }, { fontSize: 22, bold: true, color: "#F5F5F4" });
  addShape(s, { left: 70, top: 125, width: 72, height: 4 }, C.orange);
  addText(s, "3D Shoe Viewing and\nPickup Reservation\nSystem", { left: 70, top: 182, width: 620, height: 230 }, { fontSize: 55, bold: true, color: "#FFFFFF" });
  addText(s, "Integrative Programming 2\nPrefinal Week 1 Title Presentation", { left: 70, top: 470, width: 470, height: 68 }, { fontSize: 23, color: "#D6D3D1" });
  addText(s, "Group members: [Add names]\nSection: [Add section]", { left: 70, top: 590, width: 500, height: 62 }, { fontSize: 19, color: "#F5D0B5" });
  notes(s, "Image source: https://images.unsplash.com/photo-1549298916-b41d501d3772\nReplace bracketed group information before submission.");
}

// Slide 2: Target users and context
{
  const s = presentation.slides.add();
  s.background.fill = C.bg;
  addTitle(s, "Target users and context", 2);
  addText(s, "Primary user", { left: 64, top: 155, width: 300, height: 32 }, { fontSize: 20, bold: true, color: C.orange });
  addText(s, "Customers of one shoe store", { left: 64, top: 192, width: 540, height: 92 }, { fontSize: 37, bold: true });
  addText(s, "Customers inspect branded shoes, check available variants, and reserve a pair before visiting the store.", { left: 64, top: 300, width: 525, height: 92 }, { fontSize: 23, color: C.muted });
  addShape(s, { left: 64, top: 414, width: 525, height: 2 }, C.line);
  addText(s, "Secondary user", { left: 64, top: 448, width: 180, height: 30 }, { fontSize: 20, bold: true, color: C.orange });
  addText(s, "The store owner signs in to manage products, GLB models, size and color stock, and pickup reservations.", { left: 64, top: 492, width: 525, height: 110 }, { fontSize: 23 });
  addImage(s, img.context, "image/jpeg", { left: 650, top: 150, width: 566, height: 485 }, "Customer wearing a white sneaker outdoors", "cover", { left: 0.05, top: 0.06, right: 0.10, bottom: 0.08 });
  addFooter(s);
  notes(s, "Image source: https://images.unsplash.com/photo-1460353581641-37baddab0fa2\nTarget-user description is the project team's proposed scope.");
}

// Slide 3: Problem
{
  const s = presentation.slides.add();
  s.background.fill = C.paper;
  addTitle(s, "Problem statement", 3);
  addImage(s, img.problem, "image/jpeg", { left: 64, top: 150, width: 470, height: 470 }, "White sneaker shown in a static product photo", "cover", { left: 0.03, top: 0.03, right: 0.07, bottom: 0.03 });
  addText(s, "Customers cannot inspect shoes or confirm stock quickly", { left: 595, top: 160, width: 570, height: 112 }, { fontSize: 36, bold: true });
  addText(s, "Static photos limit product inspection. Size and color availability often requires a separate message to the store.", { left: 595, top: 300, width: 570, height: 100 }, { fontSize: 24 });
  addShape(s, { left: 595, top: 420, width: 80, height: 4 }, C.orange);
  addText(s, "Why it matters", { left: 595, top: 450, width: 230, height: 32 }, { fontSize: 20, bold: true, color: C.orange });
  addText(s, "Customers spend more time asking questions and may visit the store without knowing whether their preferred variant remains available.", { left: 595, top: 492, width: 570, height: 110 }, { fontSize: 23, color: C.muted });
  addFooter(s);
  notes(s, "Image source: https://images.unsplash.com/photo-1608231387042-66d1773070a5\nProblem statement is a project hypothesis. Validate it through a short shopper survey during testing.");
}

// Slide 4: Current process
{
  const s = presentation.slides.add();
  s.background.fill = C.bg;
  addTitle(s, "Current process", 4);
  const steps = [
    ["01", "Browse static photos", "Customer checks a small set of fixed product angles."],
    ["02", "Message the store", "Customer asks whether a size and color are still available."],
    ["03", "Wait for confirmation", "Staff manually checks stock and replies when available."],
    ["04", "Visit without a hold", "The selected pair may sell before the customer arrives."],
  ];
  steps.forEach((step, i) => {
    const top = 150 + i * 122;
    addText(s, step[0], { left: 78, top, width: 62, height: 44 }, { fontSize: 31, bold: true, color: C.orange });
    addText(s, step[1], { left: 160, top: top + 2, width: 390, height: 38 }, { fontSize: 26, bold: true });
    addText(s, step[2], { left: 580, top: top + 2, width: 585, height: 62 }, { fontSize: 21, color: C.muted });
    if (i < steps.length - 1) addShape(s, { left: 78, top: top + 86, width: 1087, height: 1 }, C.line);
  });
  addShape(s, { left: 64, top: 630, width: 1152, height: 34 }, C.orangeLight);
  addText(s, "Main pain point: product inspection and pickup availability require separate manual steps.", { left: 82, top: 636, width: 1040, height: 25 }, { fontSize: 18, bold: true, color: C.orange });
  addFooter(s);
  notes(s, "Current-process description represents the proposed problem framing. Validate it through observation or user interviews.");
}

// Slide 5: Proposed solution
{
  const s = presentation.slides.add();
  s.background.fill = C.paper;
  addTitle(s, "Proposed solution", 5);
  addText(s, "SoleView connects product inspection, stock checking, and pickup reservation in one workflow.", { left: 64, top: 145, width: 1100, height: 48 }, { fontSize: 27, color: C.muted });
  const stages = [
    ["1", "Browse", "Open the store's shoe catalog"],
    ["2", "Inspect", "Rotate and zoom the 3D model"],
    ["3", "Select", "Choose an available size and color"],
    ["4", "Reserve", "Enter pickup contact details"],
    ["5", "Confirm", "Owner approves and prepares the pair"],
  ];
  stages.forEach((stage, i) => {
    const left = 64 + i * 231;
    addShape(s, { left, top: 245, width: 194, height: 250 }, i === 1 ? C.orangeLight : C.bg, { fill: i === 1 ? C.orange : C.line, width: i === 1 ? 2 : 1 });
    addText(s, stage[0], { left: left + 18, top: 265, width: 52, height: 45 }, { fontSize: 34, bold: true, color: i === 1 ? C.orange : C.muted });
    addText(s, stage[1], { left: left + 18, top: 338, width: 158, height: 38 }, { fontSize: 25, bold: true });
    addText(s, stage[2], { left: left + 18, top: 395, width: 158, height: 78 }, { fontSize: 19, color: C.muted });
    if (i < stages.length - 1) addShape(s, { left: left + 194, top: 368, width: 37, height: 2 }, C.line);
  });
  addText(s, "Owner workflow", { left: 64, top: 555, width: 180, height: 30 }, { fontSize: 19, bold: true, color: C.orange });
  addText(s, "After login, manage products and GLB files, update variant stock, then confirm or reject reservations.", { left: 255, top: 553, width: 900, height: 52 }, { fontSize: 22 });
  addFooter(s);
  notes(s, "Workflow reflects the planned system scope and current prototype capabilities.");
}

// Slide 6: Innovation
{
  const s = presentation.slides.add();
  s.background.fill = C.dark;
  addText(s, "Innovation and improvement", { left: 64, top: 44, width: 900, height: 54 }, { fontSize: 43, bold: true, color: "#FFFFFF" });
  addText(s, "06", { left: 1160, top: 54, width: 56, height: 28 }, { fontSize: 18, bold: true, color: "#F5D0B5", alignment: "right" });
  addShape(s, { left: 64, top: 116, width: 1152, height: 2 }, "#44403C");
  addText(s, "Existing shoe-store pages rely on static photos and manual messages for stock confirmation and pickup requests.", { left: 84, top: 168, width: 1050, height: 112 }, { fontSize: 35, bold: true, color: "#FFFFFF" });
  addShape(s, { left: 84, top: 318, width: 72, height: 5 }, C.orange);
  addText(s, "Our system improves this through interactive 3D viewing, variant-level stock display, and pickup reservation, which helps customers inspect a shoe and secure an available pair faster.", { left: 84, top: 366, width: 1040, height: 140 }, { fontSize: 28, color: "#E7E5E4" });
  addShape(s, { left: 84, top: 550, width: 1050, height: 1 }, "#57534E");
  addText(s, "Measurable test", { left: 84, top: 580, width: 180, height: 28 }, { fontSize: 19, bold: true, color: "#F5D0B5" });
  addText(s, "Compare the time and number of steps needed to inspect a shoe and confirm a pickup-ready variant.", { left: 285, top: 577, width: 835, height: 56 }, { fontSize: 22, color: "#D6D3D1" });
  notes(s, "Innovation statement follows the required sentence structure from the instructor handout. The proposed measurement needs user testing before reporting results.");
}

// Slide 7: Core features
{
  const s = presentation.slides.add();
  s.background.fill = C.bg;
  addTitle(s, "Core features", 7);
  const features = [
    ["01", "Interactive 3D viewer", "Customers rotate and zoom licensed branded shoe models before selecting a variant."],
    ["02", "Stock-linked reservation", "Customers select a size and color, then reserve an available pair for store pickup."],
    ["03", "Secure owner management", "The owner logs in to manage products, GLB files, stock, and reservation statuses."],
  ];
  features.forEach((feature, i) => {
    const left = 64 + i * 390;
    if (i > 0) addShape(s, { left: left - 26, top: 172, width: 1, height: 400 }, C.line);
    addText(s, feature[0], { left, top: 165, width: 80, height: 50 }, { fontSize: 40, bold: true, color: i === 0 ? C.orange : i === 1 ? C.rose : C.green });
    addText(s, feature[1], { left, top: 245, width: 340, height: 76 }, { fontSize: 30, bold: true });
    addText(s, feature[2], { left, top: 348, width: 335, height: 150 }, { fontSize: 23, color: C.muted });
  });
  addShape(s, { left: 64, top: 610, width: 1152, height: 2 }, C.line);
  addText(s, "Customers browse and reserve without an account. Only the owner requires login.", { left: 64, top: 630, width: 1020, height: 30 }, { fontSize: 18, color: C.muted });
  addFooter(s);
  notes(s, "Sample GLB source used in prototype: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/MaterialsVariantsShoe\nLicense: Creative Commons Attribution 4.0 International, © 2021 Shopify.");
}

// Slide 8: Scope and limitations
{
  const s = presentation.slides.add();
  s.background.fill = C.paper;
  addTitle(s, "Scope and limitations", 8);
  addShape(s, { left: 64, top: 150, width: 548, height: 455 }, C.greenLight);
  addShape(s, { left: 668, top: 150, width: 548, height: 455 }, C.orangeLight);
  addText(s, "Included", { left: 92, top: 180, width: 220, height: 42 }, { fontSize: 30, bold: true, color: C.green });
  addBullets(s, [
    "Public catalog for one shoe store",
    "Interactive GLB model viewing",
    "Stock by size and color",
    "Guest pickup reservation",
    "Reservation reference and status",
    "Owner login and management tools",
  ], { left: 92, top: 248, width: 470, height: 305 }, { fontSize: 22, spaceAfterPoints: 10 });
  addText(s, "Excluded from first version", { left: 696, top: 180, width: 430, height: 42 }, { fontSize: 30, bold: true, color: C.orange });
  addBullets(s, [
    "Online payment processing",
    "Delivery and courier tracking",
    "Multiple stores or seller accounts",
    "Customer login and loyalty program",
    "Augmented-reality fitting",
    "Automatic 3D model generation",
  ], { left: 696, top: 248, width: 470, height: 305 }, { fontSize: 22, spaceAfterPoints: 10 });
  addText(s, "Branded sample models require a valid asset license, creator attribution, and an academic-use disclaimer.", { left: 64, top: 628, width: 1152, height: 40 }, { fontSize: 18, color: C.muted, alignment: "center" });
  addFooter(s);
  notes(s, "Scope follows the two-week implementation limit described in the project guide.\nBrand and asset guidance: https://www.nike.com/help/a/nike-corporate-details/app\nSketchfab license guidance: https://sketchfab.com/licenses\nDownloaded Creative Commons models require the attribution shown on each model page. A model license does not by itself grant brand authorization.");
}

// Slide 9: UI designs
{
  const s = presentation.slides.add();
  s.background.fill = C.bg;
  addTitle(s, "UI design and prototype", 9);
  addText(s, "Customer product-viewing screen", { left: 64, top: 137, width: 450, height: 34 }, { fontSize: 22, bold: true, color: C.orange });
  addImage(s, img.ui, "image/png", { left: 64, top: 185, width: 1152, height: 480 }, "SoleView product page prototype with large 3D shoe viewer and product controls", "contain");
  addFooter(s);
  notes(s, "UI concept generated for the SoleView prototype. The reservation form and owner confirmation screen follow this product-viewing step.");
}

// Slide 10: Closing
{
  const s = presentation.slides.add();
  s.background.fill = C.dark;
  addText(s, "SOLEVIEW", { left: 64, top: 54, width: 260, height: 36 }, { fontSize: 21, bold: true, color: "#F5D0B5" });
  addText(s, "Closing summary", { left: 64, top: 128, width: 700, height: 65 }, { fontSize: 52, bold: true, color: "#FFFFFF" });
  const rows = [
    ["Problem", "Static photos and manual stock inquiries slow customer decisions."],
    ["Solution", "3D viewing connects variant selection with pickup reservation."],
    ["Innovation", "Customers inspect and secure an available pair in one workflow."],
    ["Scope", "One shoe store with public browsing and secure owner tools."],
  ];
  rows.forEach((row, i) => {
    const top = 245 + i * 82;
    addText(s, row[0], { left: 72, top, width: 145, height: 32 }, { fontSize: 19, bold: true, color: "#F5D0B5" });
    addText(s, row[1], { left: 245, top: top - 2, width: 790, height: 48 }, { fontSize: 25, color: "#F5F5F4" });
    addShape(s, { left: 72, top: top + 53, width: 963, height: 1 }, "#44403C");
  });
  addText(s, "Questions?", { left: 1060, top: 555, width: 150, height: 40 }, { fontSize: 26, bold: true, color: C.orange, alignment: "right" });
  addText(s, "Ready to explain reservation states, stock handling, GLB licensing, and project boundaries.", { left: 72, top: 610, width: 900, height: 50 }, { fontSize: 21, color: "#A8A29E" });
  notes(s, "Closing slide. Invite questions about implementation, risk, testing, and scope.");
}

const requirements = {
  explicitTotalSlideCount: 10,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};
const fontPolicy = { basis: "design", families: [font] };
const expectedSlideSizeEmu = "12192000,6858000";
const stagingDir = path.join(workspaceDir, ".codex-finalizer");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "soleview-candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", expectedSlideSizeEmu,
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  requiredNativeTableOwnerSlides: [],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "SoleView-Title-Presentation-v3.validation.json"),
});

console.log(JSON.stringify({ font, final: FINAL_PPTX, result }, null, 2));
