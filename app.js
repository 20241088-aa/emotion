const board = document.getElementById("board");
const paletteSelect = document.getElementById("paletteSelect");
const home = document.getElementById("home");
const homeTap = document.getElementById("homeTap");
const modeArea = document.getElementById("modeArea");
const stageArea = document.getElementById("stageArea");
const modeBackBtn = document.getElementById("modeBackBtn");
const stageBackBtn = document.getElementById("stageBackBtn");
const newBtn = document.getElementById("newBtn");
const resetBtn = document.getElementById("resetBtn");
const hintBtn = document.getElementById("hintBtn");
const hintOverlay = document.getElementById("hintOverlay");
const hintImage = document.getElementById("hintImage");
const modeHint = document.getElementById("modeHint");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const completion = document.getElementById("completion");
const nextStageBtn = document.getElementById("nextStageBtn");
const lobbyBtn = document.getElementById("lobbyBtn");
const stageDesc = document.getElementById("stageDesc");
const statusText = document.getElementById("statusText");
const gameArea = document.getElementById("gameArea");

const palettes = {
  dawn: {
    name: "Dawn Mist",
    corners: [
      { h: 338, s: 62, l: 86 },
      { h: 20, s: 72, l: 86 },
      { h: 210, s: 62, l: 86 },
      { h: 270, s: 60, l: 86 },
    ],
  },
  breeze: {
    name: "Lavender Breeze",
    corners: [
      { h: 265, s: 55, l: 86 },
      { h: 305, s: 60, l: 86 },
      { h: 195, s: 50, l: 86 },
      { h: 230, s: 52, l: 86 },
    ],
  },
  meadow: {
    name: "Meadow Light",
    corners: [
      { h: 138, s: 46, l: 84 },
      { h: 60, s: 70, l: 88 },
      { h: 190, s: 45, l: 86 },
      { h: 98, s: 55, l: 85 },
    ],
  },
};

const modeHints = {
  slide: "여백을 순환시키며 그라데이션의 흐름을 이어주세요.",
  drag: "흐름을 직면하고 타일을 재배치해 연결점을 맞춰주세요.",
  rotate: "관점을 전환해 색의 흐름이 끊기지 않게 맞춰주세요.",
};

const stages = [
  {
    id: 1,
    label: "1단계 · 새벽 안개",
    size: 4,
    shuffle: 26,
    desc: "부드럽게 시작해 흐름의 방향을 느껴보세요.",
  },
  {
    id: 2,
    label: "2단계 · 산들 바람",
    size: 4,
    shuffle: 30,
    desc: "연결점이 더 멀리 흩어집니다.",
  },
  {
    id: 3,
    label: "3단계 · 잔잔한 빛",
    size: 5,
    shuffle: 36,
    desc: "격자 크기가 커지고 흐름도 길어집니다.",
  },
  {
    id: 4,
    label: "4단계 · 따뜻한 결",
    size: 5,
    shuffle: 42,
    desc: "연결을 유지하려면 더 섬세한 감각이 필요해요.",
  },
  {
    id: 5,
    label: "5단계 · 깊은 여운",
    size: 6,
    shuffle: 50,
    desc: "가장 긴 흐름을 완성해 보세요.",
  },
];

let mode = "slide";
let size = 3;
let tiles = [];
let emptyIndex = null;
let initialState = null;
let paletteKey = "dawn";
let stageId = 1;
let gradientUrl = "";
let stageCleared = false;
let completionTimeout = null;

const storageKey = "emotion-shards-progress";

const loadProgress = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch (error) {
    return {};
  }
};

const progressByMode = loadProgress();

const getUnlockedStage = () => {
  const unlocked = progressByMode[mode] || 1;
  return Math.min(stages.length, Math.max(1, unlocked));
};

const setUnlockedStage = (value) => {
  const next = Math.min(stages.length, Math.max(value, 1));
  const current = progressByMode[mode] || 1;
  if (next > current) {
    progressByMode[mode] = next;
    localStorage.setItem(storageKey, JSON.stringify(progressByMode));
  }
  updateStageAvailability();
};

const lerp = (a, b, t) => a + (b - a) * t;

const mixHsl = (a, b, t) => ({
  h: lerp(a.h, b.h, t),
  s: lerp(a.s, b.s, t),
  l: lerp(a.l, b.l, t),
});

const hsl = (color) =>
  `hsl(${color.h.toFixed(1)} ${color.s.toFixed(1)}% ${color.l.toFixed(1)}%)`;

const colorAt = (row, col) => {
  const tX = col / (size - 1);
  const tY = row / (size - 1);
  const [tl, tr, bl, br] = palettes[paletteKey].corners;
  const top = mixHsl(tl, tr, tX);
  const bottom = mixHsl(bl, br, tX);
  return mixHsl(top, bottom, tY);
};

const hslToRgb = (color) => {
  const s = color.s / 100;
  const l = color.l / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((color.h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (color.h < 60) {
    r = c;
    g = x;
  } else if (color.h < 120) {
    r = x;
    g = c;
  } else if (color.h < 180) {
    g = c;
    b = x;
  } else if (color.h < 240) {
    g = x;
    b = c;
  } else if (color.h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};

const buildGradientImage = () => {
  const resolution = size * 120;
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(resolution, resolution);
  const data = imageData.data;

  for (let y = 0; y < resolution; y += 1) {
    const tY = y / (resolution - 1);
    for (let x = 0; x < resolution; x += 1) {
      const tX = x / (resolution - 1);
      const [tl, tr, bl, br] = palettes[paletteKey].corners;
      const top = mixHsl(tl, tr, tX);
      const bottom = mixHsl(bl, br, tX);
      const color = mixHsl(top, bottom, tY);
      const rgb = hslToRgb(color);
      const index = (y * resolution + x) * 4;
      data[index] = rgb.r;
      data[index + 1] = rgb.g;
      data[index + 2] = rgb.b;
      data[index + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
};

const buildSolvedTiles = () =>
  Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const col = index % size;
    return {
      id: index,
      row,
      col,
      correctIndex: index,
      rotation: 0,
    };
  });

const shuffleSliding = (tilesState, shuffleMoves) => {
  const state = tilesState.slice();
  emptyIndex = state.length - 1;
  state[emptyIndex] = null;

  for (let i = 0; i < shuffleMoves; i += 1) {
    const neighbors = getNeighbors(emptyIndex);
    const nextIndex = neighbors[Math.floor(Math.random() * neighbors.length)];
    [state[emptyIndex], state[nextIndex]] = [state[nextIndex], state[emptyIndex]];
    emptyIndex = nextIndex;
  }

  return state;
};

const shuffleArray = (array) => {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const shuffleRotation = (array) =>
  array.map((tile) => ({
    ...tile,
    rotation: [0, 90, 180, 270][Math.floor(Math.random() * 4)],
  }));

const getNeighbors = (index) => {
  const row = Math.floor(index / size);
  const col = index % size;
  const neighbors = [];
  if (row > 0) neighbors.push(index - size);
  if (row < size - 1) neighbors.push(index + size);
  if (col > 0) neighbors.push(index - 1);
  if (col < size - 1) neighbors.push(index + 1);
  return neighbors;
};

const setBoardGrid = () => {
  board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
};

const updateStageAvailability = () => {
  const unlocked = getUnlockedStage();
  document.querySelectorAll(".stage-button").forEach((button) => {
    const stageNumber = Number(button.dataset.stage);
    const isUnlocked = stageNumber <= unlocked;
    button.classList.toggle("is-locked", !isUnlocked);
    button.classList.toggle("is-cleared", stageNumber < unlocked);
    button.disabled = !isUnlocked;
  });
  if (stageId > unlocked) {
    stageId = unlocked;
  }
  setStage(stageId);
};

const render = () => {
  board.innerHTML = "";
  setBoardGrid();

  tiles.forEach((tile, index) => {
    if (!tile) {
      const emptyTile = document.createElement("div");
      emptyTile.className = "tile empty";
      board.appendChild(emptyTile);
      return;
    }

    const isCorrect =
      mode === "rotate"
        ? tile.rotation % 360 === 0
        : tile.correctIndex === index;
    tile.justCorrect = !tile.wasCorrect && isCorrect;
    tile.wasCorrect = isCorrect;

    const el = document.createElement("div");
    el.className = "tile";
    el.dataset.index = String(index);
    el.dataset.id = String(tile.id);

    el.style.backgroundImage = `url(${gradientUrl})`;
    el.style.backgroundSize = `${size * 100}% ${size * 100}%`;
    el.style.backgroundPosition = `${(tile.col / (size - 1)) * 100}% ${(tile.row / (size - 1)) * 100}%`;

    if (mode === "rotate") {
      el.classList.add("rotate");
      el.style.transform = `rotate(${tile.rotation}deg)`;
    }

    if (isCorrect) {
      el.classList.add("correct");
    }

    if (tile.justCorrect) {
      el.classList.add("just-correct");
    }

    if (mode === "slide") {
      el.addEventListener("click", () => handleSlide(index));
    }

    if (mode === "drag") {
      el.draggable = true;
      el.addEventListener("dragstart", handleDragStart);
      el.addEventListener("dragover", handleDragOver);
      el.addEventListener("drop", handleDrop);
      el.addEventListener("dragend", handleDragEnd);
    }

    if (mode === "rotate") {
      el.addEventListener("click", () => handleRotate(index));
    }

    board.appendChild(el);
  });

  updateProgress();
};

const showCompletionOverlay = (show) => {
  completion.classList.toggle("is-visible", show);
  completion.setAttribute("aria-hidden", String(!show));
  nextStageBtn.disabled = stageId >= stages.length;
};

const setBoardComplete = (isComplete) => {
  board.classList.toggle("is-complete", isComplete);
};

const fillSlidingEmptyTile = () => {
  if (mode !== "slide" || emptyIndex === null) return;
  const emptyTile = board.querySelector(".tile.empty");
  if (!emptyTile) return;
  const row = Math.floor(emptyIndex / size);
  const col = emptyIndex % size;
  emptyTile.classList.add("filled");
  emptyTile.style.backgroundImage = `url(${gradientUrl})`;
  emptyTile.style.backgroundSize = `${size * 100}% ${size * 100}%`;
  emptyTile.style.backgroundPosition = `${(col / (size - 1)) * 100}% ${(row / (size - 1)) * 100}%`;
};

const updateProgress = () => {
  const total = mode === "slide" ? size * size - 1 : size * size;
  let correct = 0;

  if (mode === "slide" || mode === "drag") {
    tiles.forEach((tile, index) => {
      if (tile && tile.correctIndex === index) correct += 1;
    });
  } else {
    tiles.forEach((tile) => {
      if (tile && tile.rotation % 360 === 0) correct += 1;
    });
  }

  const percent = Math.round((correct / total) * 100);
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `연결 ${percent}%`;
  if (percent < 100) {
    showCompletionOverlay(false);
    setBoardComplete(false);
    if (completionTimeout) {
      clearTimeout(completionTimeout);
      completionTimeout = null;
    }
    const emptyTile = board.querySelector(".tile.empty");
    if (emptyTile) {
      emptyTile.classList.remove("filled");
      emptyTile.style.backgroundImage = "";
    }
  }
  if (percent === 100 && !stageCleared) {
    stageCleared = true;
    setBoardComplete(true);
    fillSlidingEmptyTile();
    if (completionTimeout) {
      clearTimeout(completionTimeout);
    }
    completionTimeout = setTimeout(() => {
      showCompletionOverlay(true);
    }, 520);
    if (stageId < stages.length) {
      setUnlockedStage(stageId + 1);
    }
  }
};

const handleSlide = (index) => {
  if (!tiles[index]) return;
  if (!getNeighbors(index).includes(emptyIndex)) return;

  [tiles[emptyIndex], tiles[index]] = [tiles[index], tiles[emptyIndex]];
  emptyIndex = index;
  render();
};

let dragSourceIndex = null;

const handleDragStart = (event) => {
  dragSourceIndex = Number(event.target.dataset.index);
  event.target.classList.add("dragging");
};

const handleDragOver = (event) => {
  event.preventDefault();
};

const handleDrop = (event) => {
  event.preventDefault();
  const targetIndex = Number(event.target.dataset.index);
  if (Number.isNaN(dragSourceIndex) || Number.isNaN(targetIndex)) return;
  [tiles[dragSourceIndex], tiles[targetIndex]] = [tiles[targetIndex], tiles[dragSourceIndex]];
  render();
};

const handleDragEnd = (event) => {
  event.target.classList.remove("dragging");
  dragSourceIndex = null;
};

const handleRotate = (index) => {
  tiles[index].rotation = (tiles[index].rotation + 90) % 360;
  render();
};

const buildMode = () => {
  const solved = buildSolvedTiles();
  let state = solved.slice();
  const stage = stages.find((entry) => entry.id === stageId);

  if (mode === "slide") {
    state = shuffleSliding(solved, stage.shuffle);
  }

  if (mode === "drag") {
    state = shuffleArray(solved);
  }

  if (mode === "rotate") {
    state = shuffleRotation(solved);
  }

  tiles = state;
  tiles.forEach((tile) => {
    if (tile) tile.wasCorrect = false;
  });
  initialState = JSON.parse(JSON.stringify(state));
  stageCleared = false;
  showCompletionOverlay(false);
  setBoardComplete(false);
  if (completionTimeout) {
    clearTimeout(completionTimeout);
    completionTimeout = null;
  }
  modeHint.textContent = modeHints[mode];
  gradientUrl = buildGradientImage();
  hintImage.style.backgroundImage = `url(${gradientUrl})`;
  hintOverlay.classList.add("is-hidden");
  render();
};

const resetMode = () => {
  tiles = JSON.parse(JSON.stringify(initialState));
  if (mode === "slide") {
    emptyIndex = tiles.findIndex((tile) => tile === null);
  }
  stageCleared = false;
  showCompletionOverlay(false);
  setBoardComplete(false);
  if (completionTimeout) {
    clearTimeout(completionTimeout);
    completionTimeout = null;
  }
  render();
};

const setMode = (nextMode) => {
  mode = nextMode;
  document.querySelectorAll(".mode-card").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.mode === mode);
  });
  modeHint.textContent = modeHints[mode];
  if (!gameArea.classList.contains("is-hidden")) {
    statusText.textContent = `${stages.find((entry) => entry.id === stageId).label} · ${getModeLabel(mode)}`;
  }
  updateStageAvailability();
};

const setStage = (nextStage) => {
  const unlocked = getUnlockedStage();
  if (nextStage > unlocked) {
    return;
  }
  stageId = nextStage;
  const stage = stages.find((entry) => entry.id === stageId);
  size = stage.size;
  stageDesc.textContent = stage.desc;
  statusText.textContent = `${stage.label} · ${getModeLabel(mode)}`;
  document.querySelectorAll(".stage-button").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.stage) === stageId);
  });
};

const getModeLabel = (value) => {
  if (value === "slide") return "여백과 순환";
  if (value === "drag") return "직면과 재배치";
  return "관점의 전환";
};

const startGame = () => {
  home.classList.add("is-hidden");
  modeArea.classList.add("is-hidden");
  stageArea.classList.add("is-hidden");
  gameArea.classList.remove("is-hidden");
  statusText.textContent = `${stages.find((entry) => entry.id === stageId).label} · ${getModeLabel(mode)}`;
  buildMode();
};

const showModeSelect = () => {
  home.classList.add("is-hidden");
  modeArea.classList.remove("is-hidden");
  stageArea.classList.add("is-hidden");
  gameArea.classList.add("is-hidden");
  hintOverlay.classList.add("is-hidden");
};

const showHome = () => {
  home.classList.remove("is-hidden");
  modeArea.classList.add("is-hidden");
  stageArea.classList.add("is-hidden");
  gameArea.classList.add("is-hidden");
  hintOverlay.classList.add("is-hidden");
};

const showStageSelect = () => {
  home.classList.add("is-hidden");
  modeArea.classList.add("is-hidden");
  stageArea.classList.remove("is-hidden");
  gameArea.classList.add("is-hidden");
  hintOverlay.classList.add("is-hidden");
};

const goBackToStage = () => {
  gameArea.classList.add("is-hidden");
  stageArea.classList.remove("is-hidden");
  hintOverlay.classList.add("is-hidden");
};

const toggleHint = (show) => {
  if (show) {
    hintImage.style.backgroundImage = `url(${gradientUrl})`;
    hintOverlay.classList.remove("is-hidden");
    return;
  }
  hintOverlay.classList.add("is-hidden");
};

paletteSelect.addEventListener("change", (event) => {
  paletteKey = event.target.value;
  if (!gameArea.classList.contains("is-hidden")) {
    buildMode();
  }
});
newBtn.addEventListener("click", buildMode);
resetBtn.addEventListener("click", resetMode);
homeTap.addEventListener("click", showModeSelect);
modeBackBtn.addEventListener("click", showModeSelect);
stageBackBtn.addEventListener("click", goBackToStage);
hintBtn.addEventListener("click", () => toggleHint(true));
hintOverlay.addEventListener("click", (event) => {
  if (event.target === hintOverlay) toggleHint(false);
});
nextStageBtn.addEventListener("click", () => {
  if (stageId < stages.length) {
    setStage(stageId + 1);
    startGame();
  }
});
lobbyBtn.addEventListener("click", () => {
  showStageSelect();
});

Array.from(document.querySelectorAll(".mode-card")).forEach((card) => {
  card.addEventListener("click", () => {
    setMode(card.dataset.mode);
    showStageSelect();
  });
});

Array.from(document.querySelectorAll(".stage-button")).forEach((button) => {
  button.addEventListener("click", () => {
    const nextStage = Number(button.dataset.stage);
    const unlocked = getUnlockedStage();
    if (nextStage > unlocked) return;
    setStage(nextStage);
    startGame();
  });
});

hintOverlay.classList.add("is-hidden");
showHome();
updateStageAvailability();
