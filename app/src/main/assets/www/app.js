const STORAGE_KEY = "refcanvas-project-v1";
const INITIAL_BOARD_SIZE = 8000;
const BOARD_GROW_STEP = 1200;
const BOARD_EDGE_MARGIN = 420;
const MIN_SCALE = 0.25;
const MAX_SCALE = 3.5;
const SNAP_MARGIN = 80;
const MAX_STORED_IMAGE_SIDE = 2200;
const IMAGE_EXPORT_QUALITY = 0.88;
const PERSIST_DEBOUNCE_MS = 350;

const state = {
  items: [],
  view: {
    scale: 0.6,
    offsetX: 0,
    offsetY: 0,
  },
  board: {
    width: INITIAL_BOARD_SIZE,
    height: INITIAL_BOARD_SIZE,
  },
  selectedId: null,
  locked: false,
  deferredInstallPrompt: null,
  renderQueued: false,
  persistTimer: null,
};

const pointers = new Map();
const gesture = {
  mode: null,
  itemId: null,
  startPointer: null,
  startOffset: null,
  startItem: null,
  startScale: null,
  pinchDistance: null,
  pinchCenterBoard: null,
  pinchCenterClient: null,
};

const refs = {
  boardViewport: document.querySelector("#boardViewport"),
  board: document.querySelector("#board"),
  emptyHint: document.querySelector("#emptyHint"),
  imageInput: document.querySelector("#imageInput"),
  cameraInput: document.querySelector("#cameraInput"),
  projectInput: document.querySelector("#projectInput"),
  cameraButton: document.querySelector("#cameraButton"),
  fitButton: document.querySelector("#fitButton"),
  arrangeButton: document.querySelector("#arrangeButton"),
  exportPngButton: document.querySelector("#exportPngButton"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  importJsonButton: document.querySelector("#importJsonButton"),
  clearButton: document.querySelector("#clearButton"),
  deleteButton: document.querySelector("#deleteButton"),
  duplicateButton: document.querySelector("#duplicateButton"),
  bringFrontButton: document.querySelector("#bringFrontButton"),
  sendBackButton: document.querySelector("#sendBackButton"),
  resetZoomButton: document.querySelector("#resetZoomButton"),
  toggleLockButton: document.querySelector("#toggleLockButton"),
  selectionMeta: document.querySelector("#selectionMeta"),
  installButton: document.querySelector("#installButton"),
  itemTemplate: document.querySelector("#itemTemplate"),
};

boot();

function boot() {
  loadState();
  bindEvents();
  if (state.items.length === 0) {
    state.view.offsetX = window.innerWidth * 0.5 - state.board.width * state.view.scale * 0.5;
    state.view.offsetY = window.innerHeight * 0.38 - state.board.height * state.view.scale * 0.5;
  } else {
    ensureBoardContainsAllItems();
    fitBoard(false);
  }
  scheduleRender();
  registerServiceWorker();
}

function bindEvents() {
  refs.imageInput.addEventListener("change", (event) => {
    importImageFiles(event.target.files);
    event.target.value = "";
  });

  refs.cameraInput.addEventListener("change", (event) => {
    importImageFiles(event.target.files);
    event.target.value = "";
  });

  refs.cameraButton.addEventListener("click", () => refs.cameraInput.click());
  refs.importJsonButton.addEventListener("click", () => refs.projectInput.click());
  refs.projectInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    const text = await file.text();
    importProject(text);
    event.target.value = "";
  });

  refs.fitButton.addEventListener("click", () => fitBoard(true));
  refs.arrangeButton.addEventListener("click", () => autoArrange(true));
  refs.exportJsonButton.addEventListener("click", exportProject);
  refs.exportPngButton.addEventListener("click", exportPNG);
  refs.clearButton.addEventListener("click", clearBoard);
  refs.deleteButton.addEventListener("click", deleteSelection);
  refs.duplicateButton.addEventListener("click", duplicateSelection);
  refs.bringFrontButton.addEventListener("click", () => moveSelectionZ("front"));
  refs.sendBackButton.addEventListener("click", () => moveSelectionZ("back"));
  refs.resetZoomButton.addEventListener("click", resetZoom);
  refs.toggleLockButton.addEventListener("click", toggleLock);
  refs.installButton.addEventListener("click", installApp);
  document.addEventListener("click", onActionClick);

  refs.boardViewport.addEventListener("pointerdown", onPointerDown);
  refs.boardViewport.addEventListener("pointermove", onPointerMove);
  refs.boardViewport.addEventListener("pointerup", onPointerUp);
  refs.boardViewport.addEventListener("pointercancel", onPointerUp);
  refs.boardViewport.addEventListener("wheel", onWheel, { passive: false });
  refs.boardViewport.addEventListener("dragover", (event) => event.preventDefault());
  refs.boardViewport.addEventListener("drop", async (event) => {
    event.preventDefault();
    const files = [...(event.dataTransfer?.files || [])].filter((file) => file.type.startsWith("image/"));
    await importImageFiles(files);
  });

  window.addEventListener("resize", () => {
    clampView();
    scheduleRender();
  });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("paste", onPaste);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    refs.installButton.classList.remove("hidden");
  });
}

function onActionClick(event) {
  const actionNode = event.target.closest("[data-action]");
  if (!actionNode) return;
  const action = actionNode.dataset.action;

  if (action === "fit") fitBoard(true);
  if (action === "locate") locateImages();
  if (action === "focus") toggleFocusMode();
  if (action === "arrange") autoArrange(true);
  if (action === "duplicate") duplicateSelection();
  if (action === "delete") deleteSelection();
  if (action === "export-png") exportPNG();
  if (action === "export-json") exportProject();
}

function onKeyDown(event) {
  if (isTypingTarget(event.target)) return;

  const combo = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (combo && key === "o") {
    event.preventDefault();
    refs.imageInput.click();
    return;
  }

  if (combo && key === "s") {
    event.preventDefault();
    exportProject();
    return;
  }

  if (combo && key === "e") {
    event.preventDefault();
    exportPNG();
    return;
  }

  if (combo && key === "d") {
    event.preventDefault();
    duplicateSelection();
    return;
  }

  if (combo && event.shiftKey && key === "f") {
    event.preventDefault();
    toggleFocusMode();
    return;
  }

  if (combo && key === "f") {
    event.preventDefault();
    locateImages();
    return;
  }

  if (combo && key === "a") {
    event.preventDefault();
    autoArrange(true);
    return;
  }

  if (combo && (event.key === "0" || event.code === "Digit0")) {
    event.preventDefault();
    fitBoard(true);
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelection();
    return;
  }

  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    zoomViewport(1.12);
    return;
  }

  if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    zoomViewport(0.88);
    return;
  }

  if (event.key === "Escape") {
    state.selectedId = null;
    scheduleRender();
    persist();
    return;
  }

  const arrowMoves = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };

  if (event.key in arrowMoves) {
    event.preventDefault();
    const [x, y] = arrowMoves[event.key];
    moveSelectionBy(x, y, event.shiftKey ? 50 : 10);
  }
}

function isTypingTarget(target) {
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function resetZoom() {
  zoomViewport(1 / state.view.scale);
}

function zoomViewport(factor) {
  const rect = refs.boardViewport.getBoundingClientRect();
  zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, state.view.scale * factor);
}

function zoomAtPoint(clientX, clientY, nextScale) {
  const rect = refs.boardViewport.getBoundingClientRect();
  const before = screenToBoard(clientX, clientY);
  state.view.scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  state.view.offsetX = clientX - rect.left - before.x * state.view.scale;
  state.view.offsetY = clientY - rect.top - before.y * state.view.scale;
  clampView();
  scheduleRender();
  persist();
}

function moveSelectionBy(x, y, distance) {
  const item = getSelectedItem();
  if (!item) return;
  item.x += x * distance;
  item.y += y * distance;
  expandBoardForItem(item);
  scheduleRender();
  persist();
}

async function onPaste(event) {
  const imageFiles = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith("image/"));
  if (imageFiles.length > 0) {
    await importImageFiles(imageFiles);
  }
}

async function importImageFiles(fileList) {
  const files = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (files.length === 0) {
    return;
  }

  const imported = [];
  for (const file of files) {
    const optimized = await optimizeImageFile(file);
    imported.push(createItemFromImage(optimized.src, optimized.width, optimized.height));
  }

  layoutImportedItems(imported);
  state.items.push(...imported);
  ensureBoardContainsAllItems();
  state.selectedId = imported.at(-1)?.id ?? state.selectedId;
  focusItems(imported, true);
  persist();
}

function createItemFromImage(src, width, height) {
  const maxSide = 360;
  const ratio = maxSide / Math.max(width, height, 1);
  const displayWidth = Math.max(120, Math.round(width * Math.min(ratio, 1)));
  const displayHeight = Math.max(100, Math.round(height * Math.min(ratio, 1)));
  return {
    id: crypto.randomUUID(),
    src,
    width: displayWidth,
    height: displayHeight,
    x: state.board.width / 2 - displayWidth / 2,
    y: state.board.height / 2 - displayHeight / 2,
    z: state.items.length + 1,
    originalWidth: width,
    originalHeight: height,
  };
}

function layoutImportedItems(items) {
  const viewportRect = refs.boardViewport.getBoundingClientRect();
  const center = screenToBoard(viewportRect.left + viewportRect.width / 2, viewportRect.top + viewportRect.height / 2);
  const columns = Math.max(1, Math.ceil(Math.sqrt(items.length)));
  const cellWidth = Math.max(220, Math.max(...items.map((item) => item.width)) + 28);
  const cellHeight = Math.max(180, Math.max(...items.map((item) => item.height)) + 28);
  const rows = Math.ceil(items.length / columns);
  const originX = center.x - (columns * cellWidth) / 2;
  const originY = center.y - (rows * cellHeight) / 2;

  items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    item.x = originX + col * cellWidth + (cellWidth - item.width) / 2;
    item.y = originY + row * cellHeight + (cellHeight - item.height) / 2;
    item.z = state.items.length + index + 1;
  });
}

function onPointerDown(event) {
  refs.boardViewport.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  const itemNode = event.target.closest(".board-item");
  const handleNode = event.target.closest(".resize-handle");

  if (pointers.size === 2) {
    beginPinch();
    return;
  }

  if (handleNode && itemNode && !state.locked) {
    const itemId = itemNode.dataset.id;
    const item = getItem(itemId);
    if (!item) return;
    state.selectedId = itemId;
    gesture.mode = "resize-item";
    gesture.itemId = itemId;
    gesture.startPointer = { x: event.clientX, y: event.clientY };
    gesture.startItem = { ...item };
    scheduleRender();
    return;
  }

  if (itemNode && !state.locked) {
    const itemId = itemNode.dataset.id;
    const item = getItem(itemId);
    if (!item) return;
    state.selectedId = itemId;
    bringItemToFront(itemId);
    gesture.mode = "move-item";
    gesture.itemId = itemId;
    gesture.startPointer = { x: event.clientX, y: event.clientY };
    gesture.startItem = { ...item };
    document.body.classList.add("dragging-item");
    scheduleRender();
    return;
  }

  state.selectedId = null;
  gesture.mode = "move-board";
  gesture.startPointer = { x: event.clientX, y: event.clientY };
  gesture.startOffset = { ...state.view };
  document.body.classList.add("dragging-board");
  scheduleRender();
}

function onPointerMove(event) {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size === 2) {
    if (gesture.mode !== "pinch-board") {
      beginPinch();
    }
    updatePinch();
    return;
  }

  if (gesture.mode === "move-board" && gesture.startPointer && gesture.startOffset) {
    const dx = event.clientX - gesture.startPointer.x;
    const dy = event.clientY - gesture.startPointer.y;
    state.view.offsetX = gesture.startOffset.offsetX + dx;
    state.view.offsetY = gesture.startOffset.offsetY + dy;
    clampView();
    scheduleRender();
    return;
  }

  if (gesture.mode === "move-item" && gesture.itemId && gesture.startPointer && gesture.startItem) {
    const item = getItem(gesture.itemId);
    if (!item) return;
    const dx = (event.clientX - gesture.startPointer.x) / state.view.scale;
    const dy = (event.clientY - gesture.startPointer.y) / state.view.scale;
    item.x = snapPosition(gesture.startItem.x + dx);
    item.y = snapPosition(gesture.startItem.y + dy);
    const expansion = expandBoardForItem(item);
    gesture.startItem.x += expansion.shiftX;
    gesture.startItem.y += expansion.shiftY;
    scheduleRender();
    return;
  }

  if (gesture.mode === "resize-item" && gesture.itemId && gesture.startPointer && gesture.startItem) {
    const item = getItem(gesture.itemId);
    if (!item) return;
    const delta = Math.max(event.clientX - gesture.startPointer.x, event.clientY - gesture.startPointer.y) / state.view.scale;
    const width = Math.max(80, gesture.startItem.width + delta);
    const ratio = gesture.startItem.height / gesture.startItem.width;
    item.width = width;
    item.height = Math.max(80, width * ratio);
    expandBoardForItem(item);
    scheduleRender();
  }
}

function onPointerUp(event) {
  pointers.delete(event.pointerId);

  if (pointers.size < 2 && gesture.mode === "pinch-board") {
    gesture.mode = null;
  }

  if (pointers.size === 0) {
    gesture.mode = null;
    gesture.itemId = null;
    gesture.startPointer = null;
    gesture.startOffset = null;
    gesture.startItem = null;
    gesture.startScale = null;
    gesture.pinchDistance = null;
    gesture.pinchCenterBoard = null;
    gesture.pinchCenterClient = null;
    document.body.classList.remove("dragging-item", "dragging-board");
    persist();
  }
}

function beginPinch() {
  const [first, second] = [...pointers.values()];
  gesture.mode = "pinch-board";
  gesture.startScale = state.view.scale;
  gesture.startOffset = { ...state.view };
  gesture.pinchDistance = distance(first, second);
  gesture.pinchCenterClient = midpoint(first, second);
  gesture.pinchCenterBoard = screenToBoard(gesture.pinchCenterClient.x, gesture.pinchCenterClient.y);
}

function updatePinch() {
  const [first, second] = [...pointers.values()];
  const currentDistance = Math.max(1, distance(first, second));
  const factor = currentDistance / Math.max(1, gesture.pinchDistance || currentDistance);
  const nextScale = clamp(gesture.startScale * factor, MIN_SCALE, MAX_SCALE);
  const centerClient = midpoint(first, second);
  const rect = refs.boardViewport.getBoundingClientRect();

  state.view.scale = nextScale;
  state.view.offsetX = centerClient.x - rect.left - gesture.pinchCenterBoard.x * nextScale;
  state.view.offsetY = centerClient.y - rect.top - gesture.pinchCenterBoard.y * nextScale;
  clampView();
  scheduleRender();
}

function onWheel(event) {
  event.preventDefault();
  const zoomDelta = event.deltaY < 0 ? 1.08 : 0.92;
  zoomAtPoint(event.clientX, event.clientY, state.view.scale * zoomDelta);
}

function scheduleRender() {
  if (state.renderQueued) return;
  state.renderQueued = true;
  requestAnimationFrame(() => {
    state.renderQueued = false;
    renderImmediate();
  });
}

function renderImmediate() {
  refs.board.style.transform = `translate(${state.view.offsetX}px, ${state.view.offsetY}px) scale(${state.view.scale})`;
  refs.board.innerHTML = "";

  state.items
    .slice()
    .sort((a, b) => a.z - b.z)
    .forEach((item) => refs.board.append(renderItem(item)));

  refs.emptyHint.classList.toggle("hidden", state.items.length > 0);
  refs.selectionMeta.textContent = buildSelectionText();
  refs.toggleLockButton.textContent = state.locked ? "解锁移动" : "锁定移动";
  refs.resetZoomButton.textContent = `${Math.round(state.view.scale * 100)}%`;
  document.querySelectorAll('[data-action="focus"]').forEach((button) => {
    button.textContent = document.body.classList.contains("focus-mode") ? "退出" : "专注";
  });
}

function renderItem(item) {
  const node = refs.itemTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = item.id;
  node.style.width = `${item.width}px`;
  node.style.height = `${item.height}px`;
  node.style.transform = `translate(${item.x}px, ${item.y}px)`;
  node.style.zIndex = item.z;
  node.classList.toggle("selected", item.id === state.selectedId);
  const image = node.querySelector("img");
  image.src = item.src;
  image.alt = `参考图 ${item.originalWidth} × ${item.originalHeight}`;
  return node;
}

function buildSelectionText() {
  const item = getSelectedItem();
  if (!item) {
    return "尚未选中图片";
  }
  const zoom = `${Math.round(state.view.scale * 100)}%`;
  return `尺寸 ${Math.round(item.width)} × ${Math.round(item.height)} px，原图 ${item.originalWidth} × ${item.originalHeight} px，当前画布缩放 ${zoom}`;
}

function fitBoard(animate) {
  if (state.items.length === 0) {
    state.view.scale = 0.6;
    state.view.offsetX = window.innerWidth * 0.5 - state.board.width * state.view.scale * 0.5;
    state.view.offsetY = window.innerHeight * 0.38 - state.board.height * state.view.scale * 0.5;
    scheduleRender();
    persist();
    return;
  }

  const bounds = getItemsBounds();
  const viewportRect = refs.boardViewport.getBoundingClientRect();
  const availableWidth = Math.max(240, viewportRect.width - 36);
  const availableHeight = Math.max(240, viewportRect.height - 36);
  const nextScale = clamp(
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height),
    MIN_SCALE,
    MAX_SCALE,
  );

  state.view.scale = nextScale;
  state.view.offsetX = viewportRect.width * 0.5 - (bounds.x + bounds.width * 0.5) * nextScale;
  state.view.offsetY = viewportRect.height * 0.5 - (bounds.y + bounds.height * 0.5) * nextScale;
  clampView();
  if (animate) {
    refs.board.style.transition = "transform 220ms ease";
    setTimeout(() => {
      refs.board.style.transition = "";
    }, 240);
  }
  scheduleRender();
  persist();
}

function locateImages() {
  if (state.selectedId) {
    const selected = getSelectedItem();
    if (selected) {
      focusItems([selected], true);
      return;
    }
  }
  fitBoard(true);
}

function focusItems(items, animate) {
  if (!items.length) return;

  const bounds = getBoundsForItems(items);
  const viewportRect = refs.boardViewport.getBoundingClientRect();
  const availableWidth = Math.max(240, viewportRect.width - 48);
  const availableHeight = Math.max(240, viewportRect.height - 48);
  const nextScale = clamp(
    Math.min(1.2, availableWidth / bounds.width, availableHeight / bounds.height),
    MIN_SCALE,
    MAX_SCALE,
  );

  state.view.scale = nextScale;
  state.view.offsetX = viewportRect.width * 0.5 - (bounds.x + bounds.width * 0.5) * nextScale;
  state.view.offsetY = viewportRect.height * 0.5 - (bounds.y + bounds.height * 0.5) * nextScale;
  clampView();

  if (animate) {
    refs.board.style.transition = "transform 220ms ease";
    setTimeout(() => {
      refs.board.style.transition = "";
    }, 240);
  }
  scheduleRender();
}

function autoArrange(shouldFit) {
  if (state.items.length === 0) return;

  ensureBoardContainsAllItems();
  const sorted = state.items.slice().sort((a, b) => (b.height * b.width) - (a.height * a.width));
  const maxRowWidth = 900;
  const centerX = state.board.width / 2;
  const centerY = state.board.height / 2;
  let x = centerX - 420;
  let y = centerY - 320;
  let rowHeight = 0;

  for (const item of sorted) {
    if (x + item.width > centerX + maxRowWidth / 2) {
      x = centerX - 420;
      y += rowHeight + 28;
      rowHeight = 0;
    }
    item.x = x;
    item.y = y;
    x += item.width + 28;
    rowHeight = Math.max(rowHeight, item.height);
    expandBoardForItem(item);
  }

  normalizeZ();
  if (shouldFit) {
    fitBoard(true);
  } else {
    scheduleRender();
    persist();
  }
}

function duplicateSelection() {
  const item = getSelectedItem();
  if (!item) return;
  const duplicate = {
    ...structuredClone(item),
    id: crypto.randomUUID(),
    x: item.x + 48,
    y: item.y + 48,
    z: maxZ() + 1,
  };
  state.items.push(duplicate);
  expandBoardForItem(duplicate);
  state.selectedId = duplicate.id;
  scheduleRender();
  persist();
}

function deleteSelection() {
  if (!state.selectedId) return;
  state.items = state.items.filter((item) => item.id !== state.selectedId);
  state.selectedId = null;
  normalizeZ();
  scheduleRender();
  persist();
}

function clearBoard() {
  if (!window.confirm("确认清空当前参考板吗？")) return;
  state.items = [];
  state.selectedId = null;
  fitBoard(false);
  scheduleRender();
  persist();
}

function moveSelectionZ(direction) {
  const item = getSelectedItem();
  if (!item) return;
  if (direction === "front") {
    item.z = maxZ() + 1;
  } else {
    item.z = 0;
  }
  normalizeZ();
  scheduleRender();
  persist();
}

function bringItemToFront(id) {
  const item = getItem(id);
  if (!item) return;
  item.z = maxZ() + 1;
  normalizeZ();
}

function toggleLock() {
  state.locked = !state.locked;
  scheduleRender();
  persist();
}

function toggleFocusMode() {
  document.body.classList.toggle("focus-mode");
  requestAnimationFrame(() => {
    clampView();
    scheduleRender();
  });
}

function exportProject() {
  writeStateToStorage();
  const payload = JSON.stringify({
    version: 1,
    createdAt: new Date().toISOString(),
    state,
  });
  downloadBlob(payload, `refcanvas-${timestamp()}.json`, "application/json");
}

function importProject(text) {
  try {
    const data = JSON.parse(text);
    if (!data?.state?.items || !Array.isArray(data.state.items)) {
      throw new Error("invalid");
    }
    state.items = data.state.items;
    state.view = data.state.view || state.view;
    state.board = data.state.board || estimateBoardFromItems(state.items);
    state.selectedId = null;
    state.locked = Boolean(data.state.locked);
    ensureBoardContainsAllItems();
    fitBoard(false);
    scheduleRender();
    persist();
  } catch {
    window.alert("项目文件无法读取。");
  }
}

async function exportPNG() {
  if (state.items.length === 0) {
    window.alert("当前没有可导出的图片。");
    return;
  }

  const bounds = getItemsBounds();
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(bounds.width + 80);
  canvas.height = Math.ceil(bounds.height + 80);
  const context = canvas.getContext("2d");

  context.fillStyle = "#f7efe6";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const ordered = state.items.slice().sort((a, b) => a.z - b.z);
  for (const item of ordered) {
    const image = await loadImage(item.src);
    context.save();
    context.shadowColor = "rgba(20, 14, 8, 0.18)";
    context.shadowBlur = 18;
    context.shadowOffsetY = 12;
    context.drawImage(image, item.x - bounds.x + 40, item.y - bounds.y + 40, item.width, item.height);
    context.restore();
  }

  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `refcanvas-${timestamp()}.png`, "image/png");
    }
  }, "image/png");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

async function installApp() {
  if (!state.deferredInstallPrompt) return;
  await state.deferredInstallPrompt.prompt();
  state.deferredInstallPrompt = null;
  refs.installButton.classList.add("hidden");
}

function persist() {
  window.clearTimeout(state.persistTimer);
  state.persistTimer = window.setTimeout(writeStateToStorage, PERSIST_DEBOUNCE_MS);
}

function writeStateToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      items: state.items,
      view: state.view,
      board: state.board,
      locked: state.locked,
    }));
  } catch (error) {
    console.warn("RefCanvas 保存失败，可能是图片太大或浏览器存储空间不足。", error);
    window.alert("自动保存失败：图片可能太大，建议先导出项目文件备份，或删除部分超大图片。");
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.items = Array.isArray(saved.items) ? saved.items : [];
    state.view = saved.view || state.view;
    state.board = saved.board || estimateBoardFromItems(state.items);
    state.locked = Boolean(saved.locked);
    ensureBoardContainsAllItems();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function getSelectedItem() {
  return state.items.find((item) => item.id === state.selectedId) || null;
}

function getItem(id) {
  return state.items.find((item) => item.id === id) || null;
}

function getItemsBounds() {
  return getBoundsForItems(state.items);
}

function getBoundsForItems(items) {
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const maxY = Math.max(...items.map((item) => item.y + item.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function estimateBoardFromItems(items) {
  if (!items.length) {
    return { width: INITIAL_BOARD_SIZE, height: INITIAL_BOARD_SIZE };
  }

  const bounds = getBoundsForItems(items);
  return {
    width: Math.max(INITIAL_BOARD_SIZE, Math.ceil(bounds.x + bounds.width + BOARD_EDGE_MARGIN)),
    height: Math.max(INITIAL_BOARD_SIZE, Math.ceil(bounds.y + bounds.height + BOARD_EDGE_MARGIN)),
  };
}

function ensureBoardContainsAllItems() {
  state.items.forEach((item) => expandBoardForItem(item));
}

function expandBoardForItem(item) {
  let shiftX = 0;
  let shiftY = 0;

  if (item.x < BOARD_EDGE_MARGIN) {
    shiftX = Math.ceil((BOARD_EDGE_MARGIN - item.x) / BOARD_GROW_STEP) * BOARD_GROW_STEP;
  }

  if (item.y < BOARD_EDGE_MARGIN) {
    shiftY = Math.ceil((BOARD_EDGE_MARGIN - item.y) / BOARD_GROW_STEP) * BOARD_GROW_STEP;
  }

  if (shiftX > 0) {
    state.board.width += shiftX;
    state.items.forEach((boardItem) => {
      boardItem.x += shiftX;
    });
    state.view.offsetX -= shiftX * state.view.scale;
  }

  if (shiftY > 0) {
    state.board.height += shiftY;
    state.items.forEach((boardItem) => {
      boardItem.y += shiftY;
    });
    state.view.offsetY -= shiftY * state.view.scale;
  }

  const overflowX = item.x + item.width + BOARD_EDGE_MARGIN - state.board.width;
  const overflowY = item.y + item.height + BOARD_EDGE_MARGIN - state.board.height;

  if (overflowX > 0) {
    state.board.width += Math.ceil(overflowX / BOARD_GROW_STEP) * BOARD_GROW_STEP;
  }

  if (overflowY > 0) {
    state.board.height += Math.ceil(overflowY / BOARD_GROW_STEP) * BOARD_GROW_STEP;
  }

  item.x = Math.max(24, item.x);
  item.y = Math.max(24, item.y);

  return { shiftX, shiftY };
}

function clampView() {
  const rect = refs.boardViewport.getBoundingClientRect();
  const scaledWidth = state.board.width * state.view.scale;
  const scaledHeight = state.board.height * state.view.scale;
  const minOffsetX = rect.width - scaledWidth - 160;
  const maxOffsetX = 160;
  const minOffsetY = rect.height - scaledHeight - 160;
  const maxOffsetY = 160;
  state.view.offsetX = clamp(state.view.offsetX, minOffsetX, maxOffsetX);
  state.view.offsetY = clamp(state.view.offsetY, minOffsetY, maxOffsetY);
}

function clampItem(item) {
  expandBoardForItem(item);
}

function normalizeZ() {
  state.items
    .slice()
    .sort((a, b) => a.z - b.z)
    .forEach((item, index) => {
      item.z = index + 1;
    });
}

function maxZ() {
  return Math.max(0, ...state.items.map((item) => item.z));
}

function screenToBoard(clientX, clientY) {
  const rect = refs.boardViewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.view.offsetX) / state.view.scale,
    y: (clientY - rect.top - state.view.offsetY) / state.view.scale,
  };
}

function snapPosition(value) {
  const rounded = Math.round(value / 8) * 8;
  return Math.abs(rounded - value) < SNAP_MARGIN / 10 ? rounded : value;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function optimizeImageFile(file) {
  const rawSrc = await fileToDataUrl(file);
  const original = await measureImage(rawSrc);
  const maxSide = Math.max(original.width, original.height);

  if (maxSide <= MAX_STORED_IMAGE_SIDE && file.size <= 900_000) {
    return { src: rawSrc, width: original.width, height: original.height };
  }

  const scale = Math.min(1, MAX_STORED_IMAGE_SIDE / Math.max(maxSide, 1));
  const width = Math.max(1, Math.round(original.width * scale));
  const height = Math.max(1, Math.round(original.height * scale));
  const image = await loadImage(rawSrc);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const src = canvas.toDataURL(mime, IMAGE_EXPORT_QUALITY);
  return { src, width, height };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function measureImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = src;
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function downloadBlob(data, filename, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
