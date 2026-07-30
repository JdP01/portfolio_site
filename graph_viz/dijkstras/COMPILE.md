# Compile Instructions

## Build With Emscripten

From this folder:

```bash
cd /home/jp/Desktop/dijkstras
emcc translate.cpp populate_graph.cpp algorithms.cpp -std=c++17 -O2 \
  -lembind \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s NO_EXIT_RUNTIME=1 \
  -o translate.js
```

This generates:

- `translate.js`
- `translate.wasm`

## What This Exposes

After loading `viewer.js` and `translate.js`, JavaScript can call:

```js
window.dijkstrasBridge.fastestPath(nodes, edges, startNode, endNode)
```

Inputs:

- `nodes`: flat number array in groups of 5
- `edges`: flat number array in groups of 3
- `startNode`: integer node index
- `endNode`: integer node index

Return value:

- plain JavaScript array containing the fastest path node indices

## Input Layout

Nodes are passed as:

```txt
[index, value, x, y, z, index2, value2, x2, y2, z2, ...]
```

Edges are passed as:

```txt
[fromIndex, toIndex, weight, fromIndex2, toIndex2, weight2, ...]
```

## Minimal Usage Example

```html
<script src="viewer.js"></script>
<script src="translate.js"></script>
<script>
  const previousInit = Module.onRuntimeInitialized;
  Module.onRuntimeInitialized = () => {
    if (previousInit) previousInit();

    const nodes = [
      0, 10, 0, 0, 0,
      1, 20, 1, 0, 0,
      2, 30, 2, 0, 0,
      3, 40, 3, 0, 0
    ];

    const edges = [
      0, 1, 1,
      1, 2, 2,
      0, 2, 5,
      2, 3, 1
    ];

    const path = window.dijkstrasBridge.fastestPath(nodes, edges, 0, 3);
    console.log(path);
  };
</script>
```

## Optional Local C++ Syntax Check

This does not build wasm. It only checks that the C++ files compile locally:

```bash
cd /home/jp/Desktop/dijkstras
g++ -std=c++17 -c translate.cpp populate_graph.cpp algorithms.cpp
```
