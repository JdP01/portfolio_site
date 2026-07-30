function toVectorFloat(values) {
  const vector = new Module.VectorFloat();

  values.forEach((value) => {
    vector.push_back(value);
  });

  return vector;
}

function vectorIntToArray(vector) {
  const result = [];

  for (let index = 0; index < vector.size(); index += 1) {
    result.push(vector.get(index));
  }

  return result;
}

function vectorFloatToArray(vector) {
  const result = [];

  for (let index = 0; index < vector.size(); index += 1) {
    result.push(vector.get(index));
  }

  return result;
}

function fastestPath(nodes, edges, startNode, endNode) {
  const nodesVector = toVectorFloat(nodes);
  const edgesVector = toVectorFloat(edges);

  try {
    const pathVector = Module.fastestPath(nodesVector, edgesVector, startNode, endNode);

    try {
      return vectorIntToArray(pathVector);
    } finally {
      pathVector.delete();
    }
  } finally {
    nodesVector.delete();
    edgesVector.delete();
  }
}

function tracePath(nodes, edges, startNode, endNode) {
  if (typeof Module.tracePath !== "function") {
    return [];
  }

  const nodesVector = toVectorFloat(nodes);
  const edgesVector = toVectorFloat(edges);

  try {
    const traceVector = Module.tracePath(nodesVector, edgesVector, startNode, endNode);

    try {
      return vectorFloatToArray(traceVector);
    } finally {
      traceVector.delete();
    }
  } finally {
    nodesVector.delete();
    edgesVector.delete();
  }
}

window.Module = {
  onRuntimeInitialized() {
    window.dijkstrasBridge = {
      fastestPath,
      tracePath
    };
  }
};
