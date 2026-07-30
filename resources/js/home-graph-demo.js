import * as THREE from "three";

const MIN_NODE_COUNT = 10;
const MAX_NODE_COUNT = 100;
const AUTO_SPIN_SPEED = 0.18;
const AUTO_SPIN_RESUME_DELAY_MS = 2400;
const AUTO_SPIN_RAMP_MS = 1800;
const PATH_COLOR = 0x3cff86;
const DEFAULT_NODE_COLOR = 0xffffff;
const START_NODE_COLOR = 0x4ca7ff;
const END_NODE_COLOR = 0xffc14c;
const TRACE_BLUE_COLOR = 0x4ca7ff;
const TRACE_YELLOW_COLOR = 0xffdf66;
const TRACE_STEP_DELAY_MS = 620;
const TRACE_PLAYBACK_SPEED = 150;

function getPathEdgeKey(sourceIndex, targetIndex) {
  return `${Math.min(sourceIndex, targetIndex)}:${Math.max(sourceIndex, targetIndex)}`;
}

function flattenNodeRecords(nodeRecords) {
  return nodeRecords.flatMap(([nodeIndex, value, x, y, z]) => [nodeIndex, value, x, y, z]);
}

function flattenEdgeRecords(edgeRecords) {
  return edgeRecords.flatMap(([sourceIndex, targetIndex, weight]) => [sourceIndex, targetIndex, weight]);
}

function getDijkstrasBridge() {
  return window.dijkstrasBridge?.fastestPath ? window.dijkstrasBridge : null;
}

function toValidNodeIndex(value, nodeCount) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const nodeIndex = Math.trunc(value);
  if (nodeIndex < 0 || nodeIndex >= nodeCount) {
    return null;
  }

  return nodeIndex;
}

function parseTraceSteps(traceData, nodeCount) {
  if (!Array.isArray(traceData) || traceData.length === 0) {
    return [];
  }

  const declaredStepCount = Math.max(0, Math.trunc(traceData[0] ?? 0));
  const steps = [];
  let cursor = 1;

  for (let stepIndex = 0; stepIndex < declaredStepCount && cursor < traceData.length; stepIndex += 1) {
    const currentNode = toValidNodeIndex(traceData[cursor], nodeCount);
    cursor += 1;

    const parentNodeRaw = Number.isFinite(traceData[cursor]) ? Math.trunc(traceData[cursor]) : -1;
    cursor += 1;

    const visitedCount = Math.max(0, Math.trunc(traceData[cursor] ?? 0));
    cursor += 1;

    const visitedNodes = [];
    for (let index = 0; index < visitedCount && cursor < traceData.length; index += 1) {
      const nodeIndex = toValidNodeIndex(traceData[cursor], nodeCount);
      cursor += 1;

      if (nodeIndex !== null) {
        visitedNodes.push(nodeIndex);
      }
    }

    const frontierCount = Math.max(0, Math.trunc(traceData[cursor] ?? 0));
    cursor += 1;

    const frontierNodes = [];
    for (let index = 0; index < frontierCount && cursor < traceData.length; index += 1) {
      const nodeIndex = toValidNodeIndex(traceData[cursor], nodeCount);
      cursor += 1;

      if (nodeIndex !== null) {
        frontierNodes.push(nodeIndex);
      }
    }

    if (currentNode === null) {
      continue;
    }

    steps.push({
      currentNode,
      parentNode: parentNodeRaw >= 0 && parentNodeRaw < nodeCount ? parentNodeRaw : null,
      visitedNodes,
      frontierNodes
    });
  }

  return steps;
}

function calculateFastestPath(nodeRecords, edgeRecords, startNodeIndex, endNodeIndex) {
  const bridge = getDijkstrasBridge();

  if (!bridge || nodeRecords.length < 2 || startNodeIndex === null || endNodeIndex === null) {
    return [];
  }

  try {
    const path = bridge.fastestPath(
      flattenNodeRecords(nodeRecords),
      flattenEdgeRecords(edgeRecords),
      startNodeIndex,
      endNodeIndex
    );

    if (!Array.isArray(path)) {
      return [];
    }

    const normalizedPath = path.filter(
      (nodeIndex) => Number.isInteger(nodeIndex) && nodeIndex >= 0 && nodeIndex < nodeRecords.length
    );

    if (
      normalizedPath[0] === endNodeIndex
      && normalizedPath[normalizedPath.length - 1] === startNodeIndex
    ) {
      normalizedPath.reverse();
    }

    return normalizedPath;
  } catch (error) {
    console.error("Unable to calculate fastest path.", error);
    return [];
  }
}

function calculateTraceSteps(nodeRecords, edgeRecords, startNodeIndex, endNodeIndex) {
  const bridge = getDijkstrasBridge();

  if (
    !bridge
    || typeof bridge.tracePath !== "function"
    || nodeRecords.length < 2
    || startNodeIndex === null
    || endNodeIndex === null
  ) {
    return [];
  }

  try {
    const traceData = bridge.tracePath(
      flattenNodeRecords(nodeRecords),
      flattenEdgeRecords(edgeRecords),
      startNodeIndex,
      endNodeIndex
    );

    return parseTraceSteps(traceData, nodeRecords.length);
  } catch (error) {
    console.error("Unable to calculate dijkstra trace.", error);
    return [];
  }
}

function roundNumber(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function positionCloud(nodeIndex, value, nodeCount) {
  const normalizedValue = (value - 50) / 42;
  const spread = 3.4 + Math.min(nodeCount, 60) * 0.026;
  const seedA = nodeIndex * 0.91 + value * 0.13;
  const seedB = nodeIndex * 0.47 - value * 0.11;
  const x = roundNumber((Math.sin(seedA) + Math.cos(seedB * 0.72)) * spread, 3);
  const y = roundNumber(normalizedValue * 2.8 + Math.sin(seedA * 1.21) * 1.15, 3);
  const z = roundNumber((Math.cos(seedB) + Math.sin(seedA * 0.63)) * (spread * 0.94), 3);
  return [x, y, z];
}

function positionFromValue(nodeIndex, value, nodeCount) {
  return positionCloud(nodeIndex, value, nodeCount);
}

function applyForceLayout(nodeRecords, edgeRecords) {
  const positions = nodeRecords.map(([, , x, y, z]) => new THREE.Vector3(x, y, z));
  const velocities = nodeRecords.map(() => new THREE.Vector3());
  const repulsionStrength = 0.075;
  const springStrength = 0.022;
  const centerStrength = 0.008;
  const verticalStrength = 0.018;
  const damping = 0.82;
  const idealLength = 2.15;

  for (let iteration = 0; iteration < 90; iteration += 1) {
    const forces = nodeRecords.map(() => new THREE.Vector3());

    for (let sourceIndex = 0; sourceIndex < positions.length; sourceIndex += 1) {
      for (let targetIndex = sourceIndex + 1; targetIndex < positions.length; targetIndex += 1) {
        const delta = positions[sourceIndex].clone().sub(positions[targetIndex]);
        const distanceSquared = Math.max(delta.lengthSq(), 0.18);
        const direction = delta.normalize();
        const repulsion = direction.multiplyScalar(repulsionStrength / distanceSquared);
        forces[sourceIndex].add(repulsion);
        forces[targetIndex].sub(repulsion);
      }
    }

    for (const [sourceIndex, targetIndex, weight] of edgeRecords) {
      const delta = positions[targetIndex].clone().sub(positions[sourceIndex]);
      const distance = Math.max(delta.length(), 0.001);
      const direction = delta.divideScalar(distance);
      const desiredLength = idealLength + weight * 0.045;
      const springForce = direction.multiplyScalar((distance - desiredLength) * springStrength);
      forces[sourceIndex].add(springForce);
      forces[targetIndex].sub(springForce);
    }

    nodeRecords.forEach(([, value], nodeIndex) => {
      const targetY = -1.7 + value * 0.05;
      forces[nodeIndex].x += -positions[nodeIndex].x * centerStrength;
      forces[nodeIndex].y += (targetY - positions[nodeIndex].y) * verticalStrength;
      forces[nodeIndex].z += -positions[nodeIndex].z * centerStrength;
      velocities[nodeIndex].add(forces[nodeIndex]).multiplyScalar(damping);
      positions[nodeIndex].add(velocities[nodeIndex]);
    });
  }

  return nodeRecords.map(([nodeIndex, value], index) => [
    nodeIndex,
    value,
    roundNumber(positions[index].x, 3),
    roundNumber(positions[index].y, 3),
    roundNumber(positions[index].z, 3)
  ]);
}

function createNodeRecordsFromValues(values, edgeRecords) {
  const nodeRecords = values.map((value, nodeIndex) => {
    const [x, y, z] = positionFromValue(nodeIndex, value, values.length);
    return [nodeIndex, value, x, y, z];
  });

  return applyForceLayout(nodeRecords, edgeRecords);
}

const INITIAL_NODE_VALUES = [14.4, 66.2, 38.8, 82.5, 24.1, 57.9, 91.3, 47.6, 12.8, 73.4];
const INITIAL_EDGE_RECORDS = [
  [0, 1, 6.42], [0, 2, 11.37], [0, 4, 3.86], [1, 2, 9.74], [1, 3, 15.12],
  [1, 5, 5.64], [2, 4, 8.91], [2, 6, 12.45], [3, 4, 4.28], [3, 6, 17.35],
  [3, 7, 13.44], [4, 5, 7.06], [4, 8, 5.18], [5, 6, 10.23], [5, 8, 16.71],
  [6, 7, 6.88], [6, 9, 14.97], [7, 8, 2.94], [7, 9, 18.24], [8, 9, 9.32]
];

function createRandomValue() {
  return roundNumber(8 + Math.random() * 84);
}

function createNodeValues(nodeCount) {
  return Array.from({ length: nodeCount }, () => createRandomValue());
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createEdgeWeight() {
  return roundNumber(0.25 + Math.random() * 19.75);
}

function createEdgeRecords(nodeCount) {
  const edges = [];
  const edgeSet = new Set();
  const maxNeighborOffset = Math.min(4, nodeCount - 1);

  for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
    const edgeCount = randomInt(1, Math.min(3, nodeCount - 1));
    let connections = 0;
    let attempts = 0;

    while (connections < edgeCount && attempts < nodeCount * 4) {
      attempts += 1;
      const direction = Math.random() < 0.5 ? -1 : 1;
      const offset = randomInt(1, maxNeighborOffset);
      const targetIndex = (nodeIndex + direction * offset + nodeCount) % nodeCount;

      if (targetIndex === nodeIndex) {
        continue;
      }

      const source = Math.min(nodeIndex, targetIndex);
      const target = Math.max(nodeIndex, targetIndex);
      const edgeKey = `${source}:${target}`;

      if (edgeSet.has(edgeKey)) {
        continue;
      }

      edgeSet.add(edgeKey);
      edges.push([source, target, createEdgeWeight()]);
      connections += 1;
    }
  }

  return edges;
}

function createLabelSprite(text, color = "rgba(255, 255, 255, 1)") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create label canvas context.");
  }

  canvas.width = 256;
  canvas.height = 96;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "600 30px Archivo, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 18;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.15, 0.42, 1);
  return sprite;
}

function initGraphDemo(sectionRoot) {
  const sceneRoot = sectionRoot.querySelector("#scene-root");
  const nodeCountSlider = sectionRoot.querySelector("#node-count");
  const nodeCountValue = sectionRoot.querySelector("#node-count-value");
  const pathStartNodeValue = sectionRoot.querySelector("#path-start-node");
  const pathEndNodeValue = sectionRoot.querySelector("#path-end-node");
  const runPathButton = sectionRoot.querySelector("#run-path");
  const traceEnabledToggle = sectionRoot.querySelector("#trace-enabled");
  const traceToggleNote = sectionRoot.querySelector(".graph-demo-toggle-note");
  const playbackControl = sectionRoot.querySelector("#graph-demo-playback-control");
  const tracePlayPauseButton = sectionRoot.querySelector("#trace-play-pause");

  if (!(sceneRoot instanceof HTMLDivElement) || !(nodeCountSlider instanceof HTMLInputElement) || !(nodeCountValue instanceof HTMLOutputElement) || !(pathStartNodeValue instanceof HTMLOutputElement) || !(pathEndNodeValue instanceof HTMLOutputElement) || !(runPathButton instanceof HTMLButtonElement) || !(traceEnabledToggle instanceof HTMLInputElement) || !(traceToggleNote instanceof HTMLSpanElement) || !(playbackControl instanceof HTMLDivElement) || !(tracePlayPauseButton instanceof HTMLButtonElement)) {
    throw new Error("Graph demo markup is incomplete.");
  }

  const onboardingCard = document.createElement("div");
  onboardingCard.className = "graph-demo-onboarding-card";
  onboardingCard.setAttribute("role", "status");
  onboardingCard.innerHTML = "<strong>Click any two nodes in the graph and hit run.</strong><span>Click anywhere to remove this message.</span>";
  sceneRoot.appendChild(onboardingCard);

  let onboardingDismissed = false;

  function dismissOnboardingCard() {
    if (onboardingDismissed) {
      return;
    }

    onboardingDismissed = true;
    onboardingCard.classList.add("is-hidden");
    window.setTimeout(() => {
      onboardingCard.remove();
    }, 220);
    document.removeEventListener("pointerdown", handleInitialPointerDown, true);
    document.removeEventListener("click", handleInitialPointerDown, true);
  }

  function handleInitialPointerDown() {
    dismissOnboardingCard();
  }

  document.addEventListener("pointerdown", handleInitialPointerDown, true);
  document.addEventListener("click", handleInitialPointerDown, true);

  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    const fallback = document.createElement("p");
    fallback.className = "fallback-note";
    fallback.textContent = "WebGL is unavailable in this browser environment, so the graph cannot be rendered here.";
    sceneRoot.appendChild(fallback);
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(sceneRoot.clientWidth, sceneRoot.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  sceneRoot.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.055);

  const camera = new THREE.PerspectiveCamera(45, sceneRoot.clientWidth / sceneRoot.clientHeight, 0.1, 100);
  camera.position.set(0, 1.1, 17);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.25));
  const pointLight = new THREE.PointLight(0xffffff, 28, 36, 2);
  pointLight.position.set(3.5, 5, 7.5);
  scene.add(pointLight);
  const rimLight = new THREE.PointLight(0xffffff, 10, 34, 2);
  rimLight.position.set(-5.5, -1.5, -3.5);
  scene.add(rimLight);

  const graphGroup = new THREE.Group();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  scene.add(graphGroup);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(240 * 3);

  for (let index = 0; index < 240; index += 1) {
    const stride = index * 3;
    starPositions[stride] = (Math.random() - 0.5) * 24;
    starPositions[stride + 1] = (Math.random() - 0.5) * 18;
    starPositions[stride + 2] = (Math.random() - 0.5) * 24;
  }

  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.032, transparent: true, opacity: 0.95 }));
  scene.add(stars);

  const nodeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.45, roughness: 0.05, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 });
  const nodeGeometry = new THREE.SphereGeometry(0.16, 32, 32);
  const dragState = { active: false, pointerX: 0, pointerY: 0, rotationX: 0, rotationY: 0 };
  const autoSpinState = { angle: 0, amount: 1, resumeAt: 0, lastElapsed: 0, lastFrameElapsed: 0 };
  const graphState = { nodeValues: [...INITIAL_NODE_VALUES], nodeRecords: createNodeRecordsFromValues(INITIAL_NODE_VALUES, INITIAL_EDGE_RECORDS.map((record) => [...record])), edgeRecords: INITIAL_EDGE_RECORDS.map((record) => [...record]), highlightedPath: [], selectedStartNode: null, selectedEndNode: null, nodeMeshes: [], dragDistance: 0, traceSteps: [], traceStepIndex: -1, traceTimerId: null, traceCurrentNode: null, traceNeighborNodes: new Set(), traceVisitedNodes: new Set(), traceVisitedEdgeKeys: new Set(), tracePlaybackActive: false, tracePlaybackEnabled: false, tracePlaybackSpeed: TRACE_PLAYBACK_SPEED, traceCompletionPath: [], traceCompleted: false };

  function updatePathControls() {
    pathStartNodeValue.textContent = graphState.selectedStartNode === null ? "Not selected" : `#${graphState.selectedStartNode}`;
    pathEndNodeValue.textContent = graphState.selectedEndNode === null ? "Not selected" : `#${graphState.selectedEndNode}`;
    runPathButton.disabled = !(getDijkstrasBridge() && graphState.selectedStartNode !== null && graphState.selectedEndNode !== null && graphState.selectedStartNode !== graphState.selectedEndNode);
    traceEnabledToggle.checked = graphState.tracePlaybackEnabled;
    traceToggleNote.hidden = !graphState.tracePlaybackEnabled;
    playbackControl.classList.toggle("is-hidden", !graphState.tracePlaybackEnabled);

    if (!graphState.tracePlaybackEnabled) {
      tracePlayPauseButton.disabled = true;
      tracePlayPauseButton.textContent = "Play";
      return;
    }

    const hasTrace = graphState.traceSteps.length > 0;
    const atEnd = graphState.traceCompleted;
    tracePlayPauseButton.disabled = !hasTrace;
    tracePlayPauseButton.textContent = graphState.tracePlaybackActive ? "Pause" : (atEnd ? "Replay" : "Play");
  }

  function clearTraceVisualState() {
    graphState.traceCurrentNode = null;
    graphState.traceNeighborNodes = new Set();
    graphState.traceVisitedNodes = new Set();
    graphState.traceVisitedEdgeKeys = new Set();
    graphState.traceStepIndex = -1;
    graphState.tracePlaybackActive = false;
    graphState.traceCompleted = false;
  }

  function clearTraceData() {
    graphState.traceSteps = [];
    graphState.traceCompletionPath = [];
    graphState.highlightedPath = [];
    clearTraceVisualState();
  }

  function stopTracePlayback() {
    if (graphState.traceTimerId !== null) {
      window.clearTimeout(graphState.traceTimerId);
      graphState.traceTimerId = null;
    }

    graphState.tracePlaybackActive = false;
  }

  function showCompletedPath() {
    graphState.tracePlaybackActive = false;
    graphState.traceCompleted = true;
    graphState.traceCurrentNode = null;
    graphState.traceNeighborNodes = new Set();
    graphState.traceVisitedNodes = new Set();
    graphState.traceVisitedEdgeKeys = new Set();
    graphState.highlightedPath = [...graphState.traceCompletionPath];
    graphState.traceStepIndex = graphState.traceSteps.length - 1;
  }

  function moveToTraceStep(stepIndex) {
    if (graphState.traceSteps.length === 0) {
      clearTraceVisualState();
      graphState.highlightedPath = [];
      return;
    }

    if (stepIndex < 0) {
      clearTraceVisualState();
      graphState.highlightedPath = [];
      return;
    }

    if (stepIndex >= graphState.traceSteps.length) {
      showCompletedPath();
      return;
    }

    const step = graphState.traceSteps[stepIndex];
    const visitedEdgeKeys = new Set();

    for (let index = 0; index <= stepIndex; index += 1) {
      const priorStep = graphState.traceSteps[index];

      if (priorStep.parentNode !== null) {
        visitedEdgeKeys.add(getPathEdgeKey(priorStep.parentNode, priorStep.currentNode));
      }
    }

    graphState.traceStepIndex = stepIndex;
    graphState.traceCurrentNode = step.currentNode;
    graphState.traceNeighborNodes = new Set(step.frontierNodes);
    graphState.traceVisitedNodes = new Set(step.visitedNodes);
    graphState.traceVisitedEdgeKeys = visitedEdgeKeys;
    graphState.traceCompleted = false;
    graphState.highlightedPath = [];
  }

  function scheduleNextTraceStep() {
    if (!graphState.tracePlaybackActive) {
      return;
    }

    if (graphState.traceTimerId !== null) {
      window.clearTimeout(graphState.traceTimerId);
    }

    graphState.traceTimerId = window.setTimeout(() => {
      graphState.traceTimerId = null;

      if (!graphState.tracePlaybackActive) {
        return;
      }

      moveToTraceStep(graphState.traceStepIndex + 1);
      syncGraphAndRender();

      if (graphState.traceCompleted) {
        stopTracePlayback();
        syncGraphAndRender();
        return;
      }

      scheduleNextTraceStep();
    }, TRACE_STEP_DELAY_MS / graphState.tracePlaybackSpeed);
  }

  function playTraceSteps(steps, completionPath) {
    stopTracePlayback();
    clearTraceData();

    if (steps.length === 0) {
      graphState.highlightedPath = [...completionPath];
      return;
    }

    graphState.traceSteps = steps;
    graphState.traceCompletionPath = [...completionPath];
    graphState.tracePlaybackActive = true;
    moveToTraceStep(0);
    scheduleNextTraceStep();
  }

  function disposeMaterial(material) {
    if (!material) {
      return;
    }

    if (material.map) {
      material.map.dispose();
    }

    material.dispose();
  }

  function clearGraphGroup() {
    graphState.nodeMeshes = [];

    while (graphGroup.children.length > 0) {
      const child = graphGroup.children[graphGroup.children.length - 1];
      graphGroup.remove(child);

      if (child.isLine && child.geometry) {
        child.geometry.dispose();
      }

      if (Array.isArray(child.material)) {
        child.material.forEach(disposeMaterial);
      } else {
        disposeMaterial(child.material);
      }
    }
  }

  function renderGraph() {
    clearGraphGroup();

    const nodeMap = new Map();
    const pathNodeSet = new Set(graphState.highlightedPath);
    const pathEdgeSet = new Set();
    const traceNeighborEdgeSet = new Set();

    for (let index = 0; index < graphState.highlightedPath.length - 1; index += 1) {
      pathEdgeSet.add(getPathEdgeKey(graphState.highlightedPath[index], graphState.highlightedPath[index + 1]));
    }

    if (graphState.traceCurrentNode !== null) {
      for (const neighborNode of graphState.traceNeighborNodes) {
        traceNeighborEdgeSet.add(getPathEdgeKey(graphState.traceCurrentNode, neighborNode));
      }
    }

    for (const [nodeIndex, value, x, y, z] of graphState.nodeRecords) {
      const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
      const isPathNode = pathNodeSet.has(nodeIndex);
      const isTraceCurrent = graphState.traceCurrentNode === nodeIndex;
      const isTraceVisited = graphState.traceVisitedNodes.has(nodeIndex);
      const isTraceNeighbor = graphState.traceNeighborNodes.has(nodeIndex);
      const isStartNode = graphState.selectedStartNode === nodeIndex;
      const isEndNode = graphState.selectedEndNode === nodeIndex;

      mesh.position.set(x, y, z);
      mesh.scale.setScalar((0.88 + value * 0.004) * (isPathNode ? 1.18 : 1));

      if (isTraceCurrent) {
        mesh.material.color.setHex(TRACE_BLUE_COLOR);
        mesh.material.emissive.setHex(TRACE_BLUE_COLOR);
        mesh.material.emissiveIntensity = 2;
      } else if (isTraceNeighbor) {
        mesh.material.color.setHex(TRACE_YELLOW_COLOR);
        mesh.material.emissive.setHex(TRACE_YELLOW_COLOR);
        mesh.material.emissiveIntensity = 1.8;
      } else if (isTraceVisited) {
        mesh.material.color.setHex(TRACE_BLUE_COLOR);
        mesh.material.emissive.setHex(TRACE_BLUE_COLOR);
        mesh.material.emissiveIntensity = 1.35;
      } else if (isStartNode) {
        mesh.material.color.setHex(START_NODE_COLOR);
        mesh.material.emissive.setHex(START_NODE_COLOR);
        mesh.material.emissiveIntensity = 1.7;
      } else if (isEndNode) {
        mesh.material.color.setHex(END_NODE_COLOR);
        mesh.material.emissive.setHex(END_NODE_COLOR);
        mesh.material.emissiveIntensity = 1.7;
      } else {
        mesh.material.color.setHex(isPathNode ? PATH_COLOR : DEFAULT_NODE_COLOR);
        mesh.material.emissive.setHex(isPathNode ? PATH_COLOR : DEFAULT_NODE_COLOR);
        mesh.material.emissiveIntensity = isPathNode ? 1.9 : 0.75 + value * 0.008;
      }

      mesh.userData.nodeIndex = nodeIndex;
      graphGroup.add(mesh);
      graphState.nodeMeshes.push(mesh);

      const label = createLabelSprite(
        `#${nodeIndex}`,
        isTraceCurrent ? "rgba(76, 167, 255, 1)" : isTraceNeighbor ? "rgba(255, 223, 102, 1)" : isTraceVisited ? "rgba(76, 167, 255, 1)" : isStartNode ? "rgba(76, 167, 255, 1)" : isEndNode ? "rgba(255, 193, 76, 1)" : isPathNode ? "rgba(60, 255, 134, 1)" : "rgba(255, 255, 255, 1)"
      );
      label.position.set(x, y + 0.42, z);
      graphGroup.add(label);
      nodeMap.set(nodeIndex, mesh.position.clone());
    }

    for (const [sourceIndex, targetIndex, weight] of graphState.edgeRecords) {
      const source = nodeMap.get(sourceIndex);
      const target = nodeMap.get(targetIndex);
      const edgeKey = getPathEdgeKey(sourceIndex, targetIndex);
      const isPathEdge = pathEdgeSet.has(edgeKey);
      const isTraceNeighborEdge = traceNeighborEdgeSet.has(edgeKey);
      const isTraceVisitedEdge = graphState.traceVisitedEdgeKeys.has(edgeKey);

      if (!source || !target) {
        continue;
      }

      const edgeGeometry = new THREE.BufferGeometry().setFromPoints([source, target]);
      graphGroup.add(new THREE.Line(edgeGeometry, new THREE.LineBasicMaterial({ color: isTraceNeighborEdge ? TRACE_YELLOW_COLOR : isTraceVisitedEdge ? TRACE_BLUE_COLOR : isPathEdge ? PATH_COLOR : DEFAULT_NODE_COLOR, transparent: true, opacity: isTraceNeighborEdge || isTraceVisitedEdge || isPathEdge ? 0.95 : 0.16 + weight / 24 })));

      const weightLabel = createLabelSprite(weight.toFixed(2), isTraceNeighborEdge ? "rgba(255, 223, 102, 1)" : isTraceVisitedEdge ? "rgba(76, 167, 255, 1)" : isPathEdge ? "rgba(60, 255, 134, 1)" : "rgba(255, 255, 255, 0.9)");
      weightLabel.scale.set(0.82, 0.3, 1);
      weightLabel.position.set((source.x + target.x) / 2, (source.y + target.y) / 2 + 0.12, (source.z + target.z) / 2);
      graphGroup.add(weightLabel);
    }

    nodeCountValue.textContent = String(graphState.nodeRecords.length);
  }

  function syncGraphAndRender() {
    updatePathControls();
    renderGraph();
  }

  function runSelectedPath() {
    if (graphState.selectedStartNode === null || graphState.selectedEndNode === null || graphState.selectedStartNode === graphState.selectedEndNode) {
      return;
    }

    const fastestPath = calculateFastestPath(graphState.nodeRecords, graphState.edgeRecords, graphState.selectedStartNode, graphState.selectedEndNode);

    if (!graphState.tracePlaybackEnabled) {
      stopTracePlayback();
      clearTraceData();
      graphState.highlightedPath = fastestPath;
      syncGraphAndRender();
      return;
    }

    playTraceSteps(calculateTraceSteps(graphState.nodeRecords, graphState.edgeRecords, graphState.selectedStartNode, graphState.selectedEndNode), fastestPath);
    syncGraphAndRender();
  }

  function replaceGraph(nodeCount, useInitialGraph = false) {
    graphState.edgeRecords = useInitialGraph ? INITIAL_EDGE_RECORDS.map((record) => [...record]) : createEdgeRecords(nodeCount);
    graphState.nodeValues = useInitialGraph ? [...INITIAL_NODE_VALUES] : createNodeValues(nodeCount);
    graphState.nodeRecords = createNodeRecordsFromValues(graphState.nodeValues, graphState.edgeRecords);
    stopTracePlayback();
    clearTraceData();
    graphState.selectedStartNode = null;
    graphState.selectedEndNode = null;
    syncGraphAndRender();
  }

  const clock = new THREE.Clock();

  function resizeScene() {
    camera.aspect = sceneRoot.clientWidth / sceneRoot.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(sceneRoot.clientWidth, sceneRoot.clientHeight);
  }

  window.addEventListener("resize", resizeScene);
  sceneRoot.addEventListener("pointerdown", (event) => {
    autoSpinState.amount = 0;
    autoSpinState.resumeAt = autoSpinState.lastElapsed + AUTO_SPIN_RESUME_DELAY_MS / 1000;
    dragState.active = true;
    dragState.pointerX = event.clientX;
    dragState.pointerY = event.clientY;
    graphState.dragDistance = 0;
    sceneRoot.classList.add("is-dragging");
  });
  sceneRoot.addEventListener("click", (event) => {
    if (graphState.dragDistance > 6) {
      return;
    }

    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const selectedMesh = raycaster.intersectObjects(graphState.nodeMeshes, false)[0]?.object;

    if (!selectedMesh || typeof selectedMesh.userData.nodeIndex !== "number") {
      return;
    }

    if (graphState.selectedStartNode === null || graphState.selectedStartNode === selectedMesh.userData.nodeIndex) {
      graphState.selectedStartNode = selectedMesh.userData.nodeIndex;
      if (graphState.selectedEndNode === selectedMesh.userData.nodeIndex) {
        graphState.selectedEndNode = null;
      }
    } else if (graphState.selectedEndNode === null || graphState.selectedEndNode === selectedMesh.userData.nodeIndex) {
      graphState.selectedEndNode = selectedMesh.userData.nodeIndex;
    } else {
      graphState.selectedStartNode = graphState.selectedEndNode;
      graphState.selectedEndNode = selectedMesh.userData.nodeIndex;
    }

    stopTracePlayback();
    clearTraceData();
    syncGraphAndRender();
  });
  window.addEventListener("pointermove", (event) => {
    if (!dragState.active) {
      return;
    }

    autoSpinState.amount = 0;
    autoSpinState.resumeAt = autoSpinState.lastElapsed + AUTO_SPIN_RESUME_DELAY_MS / 1000;
    const deltaX = event.clientX - dragState.pointerX;
    const deltaY = event.clientY - dragState.pointerY;
    graphState.dragDistance += Math.abs(deltaX) + Math.abs(deltaY);
    dragState.pointerX = event.clientX;
    dragState.pointerY = event.clientY;
    dragState.rotationY += deltaX * 0.008;
    dragState.rotationX = THREE.MathUtils.clamp(dragState.rotationX + deltaY * 0.004, -0.65, 0.65);
  });
  window.addEventListener("pointerup", () => {
    autoSpinState.amount = 0;
    autoSpinState.resumeAt = autoSpinState.lastElapsed + AUTO_SPIN_RESUME_DELAY_MS / 1000;
    dragState.active = false;
    sceneRoot.classList.remove("is-dragging");
  });
  window.addEventListener("pointercancel", () => {
    autoSpinState.amount = 0;
    autoSpinState.resumeAt = autoSpinState.lastElapsed + AUTO_SPIN_RESUME_DELAY_MS / 1000;
    dragState.active = false;
    sceneRoot.classList.remove("is-dragging");
  });
  nodeCountSlider.addEventListener("input", (event) => replaceGraph(THREE.MathUtils.clamp(Number(event.currentTarget.value), MIN_NODE_COUNT, MAX_NODE_COUNT)));
  runPathButton.addEventListener("click", runSelectedPath);
  traceEnabledToggle.addEventListener("change", (event) => {
    if (event.currentTarget.checked) {
      graphState.tracePlaybackEnabled = true;
    } else {
      stopTracePlayback();
      graphState.tracePlaybackEnabled = false;
      if (graphState.traceCompletionPath.length > 0) {
        graphState.highlightedPath = [...graphState.traceCompletionPath];
      }
      graphState.traceSteps = [];
      graphState.traceCompletionPath = [];
      clearTraceVisualState();
    }

    syncGraphAndRender();
  });
  tracePlayPauseButton.addEventListener("click", () => {
    if (graphState.tracePlaybackActive) {
      stopTracePlayback();
    } else if (graphState.traceSteps.length > 0) {
      if (graphState.traceCompleted || graphState.traceStepIndex < 0) {
        moveToTraceStep(0);
      }
      graphState.tracePlaybackActive = true;
      scheduleNextTraceStep();
    }
    syncGraphAndRender();
  });

  resizeScene();
  replaceGraph(MIN_NODE_COUNT, true);

  if (getDijkstrasBridge()) {
    syncGraphAndRender();
  } else {
    let attempts = 0;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      if (getDijkstrasBridge() || attempts >= 80) {
        window.clearInterval(intervalId);
        syncGraphAndRender();
      }
    }, 150);
  }

  function animate() {
    const elapsed = clock.getElapsedTime();
    const deltaTime = elapsed - autoSpinState.lastFrameElapsed;
    autoSpinState.lastElapsed = elapsed;
    autoSpinState.lastFrameElapsed = elapsed;

    if (!dragState.active && elapsed >= autoSpinState.resumeAt) {
      autoSpinState.amount = Math.min((elapsed - autoSpinState.resumeAt) / (AUTO_SPIN_RAMP_MS / 1000), 1);
    }

    autoSpinState.angle += Math.max(deltaTime, 0) * AUTO_SPIN_SPEED * autoSpinState.amount;
    graphGroup.rotation.y = autoSpinState.angle + dragState.rotationY;
    graphGroup.rotation.x = Math.sin(elapsed * 0.25) * 0.08 + dragState.rotationX;
    stars.rotation.y = elapsed * 0.01;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
}

const graphDemoRoot = document.querySelector("[data-graph-demo]");

if (graphDemoRoot instanceof HTMLElement) {
  try {
    initGraphDemo(graphDemoRoot);
  } catch (error) {
    console.error(error);
  }
}