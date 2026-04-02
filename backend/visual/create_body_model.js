// HealthLink 2D Human Body Model — Excalidraw Canvas Builder
// Creates a stylized anatomical body map with 5 interactive zones

const BASE = "http://localhost:3000";

async function postJSON(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data;
}

async function clearCanvas() {
  const res = await fetch(`${BASE}/api/elements/clear`, { method: "DELETE" });
  const data = await res.json();
  console.log("Clear:", data.message || data);
}

async function createElement(el) {
  const data = await postJSON("/api/elements", el);
  if (data.success === false) {
    console.error(`  ✗ ${el.id}: ${data.error}`);
  } else {
    console.log(`  ✓ ${el.id || el.type}`);
  }
  return data;
}

async function main() {
  await clearCanvas();
  
  const cx = 500; // center x of body

  // Zone colors
  const BRAIN     = { bg: "#E8D5F5", stroke: "#7B2D8E" };
  const HEART     = { bg: "#FADBD8", stroke: "#C0392B" };
  const LUNGS     = { bg: "#D6EAF8", stroke: "#2471A3" };
  const DIGESTIVE = { bg: "#D5F5E3", stroke: "#1E8449" };
  const SYSTEMIC  = { bg: "#FEF9E7", stroke: "#D4AC0D" };

  const elements = [
    // ── TITLE ──
    {
      id: "title",
      type: "text",
      x: cx - 230,
      y: -55,
      width: 460,
      height: 45,
      text: "HealthLink — Dynamic Health Canvas",
      fontSize: 36,
      fontFamily: "1",
      textAlign: "center",
      strokeColor: "#2C3E50",
      opacity: 100,
    },
    {
      id: "subtitle",
      type: "text",
      x: cx - 195,
      y: 0,
      width: 390,
      height: 22,
      text: "Tap an anatomical zone to explore health data",
      fontSize: 16,
      fontFamily: "1",
      textAlign: "center",
      strokeColor: "#95A5A6",
      opacity: 85,
    },

    // ── SYSTEMIC / FULL BODY – outer border ──
    {
      id: "systemic-bg",
      type: "ellipse",
      x: cx - 170,
      y: 30,
      width: 340,
      height: 660,
      backgroundColor: SYSTEMIC.bg,
      strokeColor: SYSTEMIC.stroke,
      strokeWidth: 2,
      strokeStyle: "dashed",
      roughness: 0,
      opacity: 35,
    },

    // ── HEAD (Brain) ──
    {
      id: "head",
      type: "ellipse",
      x: cx - 48,
      y: 55,
      width: 96,
      height: 108,
      backgroundColor: BRAIN.bg,
      strokeColor: BRAIN.stroke,
      strokeWidth: 2,
      roughness: 0,
      opacity: 90,
    },
    // Eyes
    {
      id: "eye-left",
      type: "ellipse",
      x: cx - 26,
      y: 96,
      width: 13,
      height: 9,
      backgroundColor: "#2C3E50",
      strokeColor: "#2C3E50",
      strokeWidth: 1,
      roughness: 0,
      opacity: 75,
    },
    {
      id: "eye-right",
      type: "ellipse",
      x: cx + 13,
      y: 96,
      width: 13,
      height: 9,
      backgroundColor: "#2C3E50",
      strokeColor: "#2C3E50",
      strokeWidth: 1,
      roughness: 0,
      opacity: 75,
    },

    // ── NECK ──
    {
      id: "neck",
      type: "rectangle",
      x: cx - 16,
      y: 160,
      width: 32,
      height: 32,
      backgroundColor: "#FDEBD0",
      strokeColor: "#D4A574",
      strokeWidth: 1.5,
      roughness: 0,
      opacity: 80,
    },

    // ── TORSO (body outline) ──
    {
      id: "torso",
      type: "rectangle",
      x: cx - 95,
      y: 190,
      width: 190,
      height: 275,
      backgroundColor: "#FDEBD0",
      strokeColor: "#D4A574",
      strokeWidth: 2,
      roughness: 0,
      opacity: 45,
    },

    // ── LEFT LUNG ──
    {
      id: "lung-left",
      type: "ellipse",
      x: cx - 90,
      y: 200,
      width: 52,
      height: 108,
      backgroundColor: LUNGS.bg,
      strokeColor: LUNGS.stroke,
      strokeWidth: 2,
      roughness: 0,
      opacity: 80,
    },

    // ── RIGHT LUNG ──
    {
      id: "lung-right",
      type: "ellipse",
      x: cx + 38,
      y: 200,
      width: 52,
      height: 108,
      backgroundColor: LUNGS.bg,
      strokeColor: LUNGS.stroke,
      strokeWidth: 2,
      roughness: 0,
      opacity: 80,
    },

    // ── HEART / CHEST (center) ──
    {
      id: "heart-chest",
      type: "ellipse",
      x: cx - 48,
      y: 210,
      width: 96,
      height: 88,
      backgroundColor: HEART.bg,
      strokeColor: HEART.stroke,
      strokeWidth: 2,
      roughness: 0,
      opacity: 80,
    },

    // ── DIGESTIVE (lower torso) ──
    {
      id: "digestive",
      type: "ellipse",
      x: cx - 65,
      y: 320,
      width: 130,
      height: 115,
      backgroundColor: DIGESTIVE.bg,
      strokeColor: DIGESTIVE.stroke,
      strokeWidth: 2,
      roughness: 0,
      opacity: 80,
    },
    // Stomach detail
    {
      id: "stomach-detail",
      type: "ellipse",
      x: cx - 25,
      y: 345,
      width: 45,
      height: 35,
      backgroundColor: "#A9DFBF",
      strokeColor: "#1E8449",
      strokeWidth: 1,
      roughness: 0,
      opacity: 55,
    },

    // ── LEFT ARM ──
    {
      id: "arm-left",
      type: "line",
      x: cx - 95,
      y: 200,
      width: 70,
      height: 210,
      strokeColor: "#D4A574",
      strokeWidth: 8,
      roughness: 0,
      opacity: 65,
      points: [[0, 0], [-25, 70], [-50, 150], [-48, 210]],
    },
    {
      id: "hand-left",
      type: "ellipse",
      x: cx - 155,
      y: 400,
      width: 24,
      height: 28,
      backgroundColor: "#FDEBD0",
      strokeColor: "#D4A574",
      strokeWidth: 1.5,
      roughness: 0,
      opacity: 65,
    },

    // ── RIGHT ARM ──
    {
      id: "arm-right",
      type: "line",
      x: cx + 95,
      y: 200,
      width: 70,
      height: 210,
      strokeColor: "#D4A574",
      strokeWidth: 8,
      roughness: 0,
      opacity: 65,
      points: [[0, 0], [25, 70], [50, 150], [48, 210]],
    },
    {
      id: "hand-right",
      type: "ellipse",
      x: cx + 131,
      y: 400,
      width: 24,
      height: 28,
      backgroundColor: "#FDEBD0",
      strokeColor: "#D4A574",
      strokeWidth: 1.5,
      roughness: 0,
      opacity: 65,
    },

    // ── LEFT LEG ──
    {
      id: "leg-left",
      type: "line",
      x: cx - 50,
      y: 463,
      width: 25,
      height: 195,
      strokeColor: "#D4A574",
      strokeWidth: 10,
      roughness: 0,
      opacity: 65,
      points: [[0, 0], [-6, 70], [-14, 150], [-18, 195]],
    },
    {
      id: "foot-left",
      type: "ellipse",
      x: cx - 78,
      y: 650,
      width: 28,
      height: 16,
      backgroundColor: "#FDEBD0",
      strokeColor: "#D4A574",
      strokeWidth: 1.5,
      roughness: 0,
      opacity: 65,
    },

    // ── RIGHT LEG ──
    {
      id: "leg-right",
      type: "line",
      x: cx + 50,
      y: 463,
      width: 25,
      height: 195,
      strokeColor: "#D4A574",
      strokeWidth: 10,
      roughness: 0,
      opacity: 65,
      points: [[0, 0], [6, 70], [14, 150], [18, 195]],
    },
    {
      id: "foot-right",
      type: "ellipse",
      x: cx + 55,
      y: 650,
      width: 28,
      height: 16,
      backgroundColor: "#FDEBD0",
      strokeColor: "#D4A574",
      strokeWidth: 1.5,
      roughness: 0,
      opacity: 65,
    },

    // ═══════════════════════════════════════════════
    // ZONE LABEL CARDS (right side panel)
    // ═══════════════════════════════════════════════
    {
      id: "label-brain",
      type: "rectangle",
      x: 760,
      y: 55,
      width: 220,
      height: 65,
      backgroundColor: BRAIN.bg,
      strokeColor: BRAIN.stroke,
      strokeWidth: 2,
      roughness: 0,
      opacity: 90,
      label: { text: "🧠 Brain" },
    },
    {
      id: "label-heart",
      type: "rectangle",
      x: 760,
      y: 150,
      width: 220,
      height: 65,
      backgroundColor: HEART.bg,
      strokeColor: HEART.stroke,
      strokeWidth: 2,
      roughness: 0,
      opacity: 90,
      label: { text: "❤️ Heart / Chest" },
    },
    {
      id: "label-lungs",
      type: "rectangle",
      x: 760,
      y: 245,
      width: 220,
      height: 65,
      backgroundColor: LUNGS.bg,
      strokeColor: LUNGS.stroke,
      strokeWidth: 2,
      roughness: 0,
      opacity: 90,
      label: { text: "🫁 Lungs" },
    },
    {
      id: "label-digestive",
      type: "rectangle",
      x: 760,
      y: 340,
      width: 220,
      height: 65,
      backgroundColor: DIGESTIVE.bg,
      strokeColor: DIGESTIVE.stroke,
      strokeWidth: 2,
      roughness: 0,
      opacity: 90,
      label: { text: "🍽️ Digestive" },
    },
    {
      id: "label-systemic",
      type: "rectangle",
      x: 760,
      y: 435,
      width: 220,
      height: 65,
      backgroundColor: SYSTEMIC.bg,
      strokeColor: SYSTEMIC.stroke,
      strokeWidth: 2,
      roughness: 0,
      opacity: 90,
      label: { text: "🔄 Systemic / Full Body" },
    },

    // ═══════════════════════════════════════════════
    // CONNECTOR ARROWS (body zone → label)
    // ═══════════════════════════════════════════════
    {
      id: "arrow-brain",
      type: "arrow",
      x: cx + 48,
      y: 88,
      strokeColor: BRAIN.stroke,
      strokeWidth: 1.5,
      roughness: 0,
      opacity: 50,
      strokeStyle: "dotted",
      points: [[0, 0], [212, 0]],
    },
    {
      id: "arrow-heart",
      type: "arrow",
      x: cx + 48,
      y: 254,
      strokeColor: HEART.stroke,
      strokeWidth: 1.5,
      roughness: 0,
      opacity: 50,
      strokeStyle: "dotted",
      points: [[0, 0], [100, -72]],
    },
    {
      id: "arrow-lungs",
      type: "arrow",
      x: cx + 90,
      y: 254,
      strokeColor: LUNGS.stroke,
      strokeWidth: 1.5,
      roughness: 0,
      opacity: 50,
      strokeStyle: "dotted",
      points: [[0, 0], [170, 24]],
    },
    {
      id: "arrow-digestive",
      type: "arrow",
      x: cx + 65,
      y: 375,
      strokeColor: DIGESTIVE.stroke,
      strokeWidth: 1.5,
      roughness: 0,
      opacity: 50,
      strokeStyle: "dotted",
      points: [[0, 0], [195, -2]],
    },
    {
      id: "arrow-systemic",
      type: "arrow",
      x: cx + 155,
      y: 480,
      strokeColor: SYSTEMIC.stroke,
      strokeWidth: 1.5,
      roughness: 0,
      opacity: 50,
      strokeStyle: "dotted",
      points: [[0, 0], [105, -13]],
    },

    // ═══════════════════════════════════════════════
    // LEGEND BOX (left side)
    // ═══════════════════════════════════════════════
    {
      id: "legend-box",
      type: "rectangle",
      x: 120,
      y: 55,
      width: 175,
      height: 270,
      backgroundColor: "#FDFEFE",
      strokeColor: "#D5D8DC",
      strokeWidth: 1,
      roughness: 0,
      opacity: 85,
    },
    {
      id: "legend-title",
      type: "text",
      x: 145,
      y: 62,
      width: 125,
      height: 22,
      text: "Interactive Zones",
      fontSize: 16,
      fontFamily: "1",
      textAlign: "center",
      strokeColor: "#2C3E50",
      opacity: 100,
    },
  ];

  // Legend swatches
  const legendItems = [
    { name: "Brain",        ...BRAIN,     y: 95 },
    { name: "Heart/Chest",  ...HEART,     y: 135 },
    { name: "Lungs",        ...LUNGS,     y: 175 },
    { name: "Digestive",    ...DIGESTIVE, y: 215 },
    { name: "Systemic",     ...SYSTEMIC,  y: 255 },
  ];

  for (let i = 0; i < legendItems.length; i++) {
    const item = legendItems[i];
    elements.push({
      id: `legend-swatch-${i}`,
      type: "rectangle",
      x: 140,
      y: item.y,
      width: 18,
      height: 18,
      backgroundColor: item.bg,
      strokeColor: item.stroke,
      strokeWidth: 1.5,
      roughness: 0,
      opacity: 90,
    });
    elements.push({
      id: `legend-text-${i}`,
      type: "text",
      x: 168,
      y: item.y + 1,
      width: 110,
      height: 16,
      text: item.name,
      fontSize: 14,
      fontFamily: "1",
      strokeColor: "#2C3E50",
      opacity: 85,
    });
  }

  // ═══════════════════════════════════════════════
  // CREATE ELEMENTS ONE BY ONE
  // ═══════════════════════════════════════════════
  console.log(`\nCreating ${elements.length} elements...\n`);

  for (const el of elements) {
    await createElement(el);
    // Small delay to avoid overwhelming the server
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\n✅ HealthLink Body Model created with ${elements.length} elements!`);
  console.log("🌐 Open http://localhost:3000 to view it.");
}

main().catch(console.error);
