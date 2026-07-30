#include <iostream> 
#include <string> 
#include <vector> 
#include <limits>
#include <queue> 
#include <algorithm>
#include <cmath>
#include "algorithms.hpp"
#include "populate_graph.hpp"
#include "node.hpp"

namespace {

using HeapElement = std::pair<float, int>;

struct TraceStep {
    int current_node;
    int parent_node;
    std::vector<int> visited_nodes;
    std::vector<int> frontier_neighbors;
};

std::vector<int> rebuild_path(
    const std::vector<int>& prev_node,
    const std::vector<float>& distance,
    int start_node,
    int end_node
) {
    if (start_node == end_node) {
        return {start_node};
    }

    if (!std::isfinite(distance[end_node])) {
        return {};
    }

    std::vector<int> path;
    int search_idx = end_node;

    while (search_idx != -1 && search_idx != start_node) {
        path.push_back(search_idx);
        search_idx = prev_node[search_idx];
    }

    if (search_idx == -1) {
        return {};
    }

    path.push_back(start_node);
    std::reverse(path.begin(), path.end());
    return path;
}

void run_dijkstras(
    const std::vector<Node>& graph,
    int start_node,
    int end_node,
    std::vector<float>& distance,
    std::vector<int>& prev_node,
    std::vector<TraceStep>* trace_steps
) {
    const int num_nodes = static_cast<int>(graph.size());
    std::vector<bool> visited(num_nodes, false);
    std::vector<int> visited_order;
    std::priority_queue<HeapElement, std::vector<HeapElement>, std::greater<HeapElement>> min_heap;

    distance.assign(num_nodes, std::numeric_limits<float>::infinity());
    prev_node.assign(num_nodes, -1);
    distance[start_node] = 0.0f;
    min_heap.push({0.0f, start_node});

    while (!min_heap.empty()) {
        const HeapElement current_node = min_heap.top();
        min_heap.pop();

        const int idx = current_node.second;
        if (visited[idx]) {
            continue;
        }

        std::vector<int> frontier_neighbors;

        for (const auto& neighbor : graph[idx].neighbors) {
            const int neighbor_idx = neighbor.first;
            const float edge_weight = neighbor.second;

            if (visited[neighbor_idx]) {
                continue;
            }

            frontier_neighbors.push_back(neighbor_idx);

            const float total_weight = distance[idx] + edge_weight;
            if (total_weight < distance[neighbor_idx]) {
                distance[neighbor_idx] = total_weight;
                prev_node[neighbor_idx] = idx;
                min_heap.push({total_weight, neighbor_idx});
            }
        }

        visited[idx] = true;
        visited_order.push_back(idx);

        if (trace_steps != nullptr) {
            trace_steps->push_back({
                idx,
                prev_node[idx],
                visited_order,
                frontier_neighbors
            });
        }

        if (idx == end_node) {
            break;
        }
    }
}

} // namespace

std::vector<int> dijkstras(const std::vector<Node>& graph, int start_node, int end_node){
    std::vector<float> distance;
    std::vector<int> prev_node;
    run_dijkstras(graph, start_node, end_node, distance, prev_node, nullptr);
    return rebuild_path(prev_node, distance, start_node, end_node);
}

std::vector<float> dijkstras_trace(const std::vector<Node>& graph, int start_node, int end_node) {
    std::vector<float> distance;
    std::vector<int> prev_node;
    std::vector<TraceStep> trace_steps;
    run_dijkstras(graph, start_node, end_node, distance, prev_node, &trace_steps);

    std::vector<float> trace_flat;
    trace_flat.push_back(static_cast<float>(trace_steps.size()));

    for (const TraceStep& step : trace_steps) {
        trace_flat.push_back(static_cast<float>(step.current_node));
        trace_flat.push_back(static_cast<float>(step.parent_node));
        trace_flat.push_back(static_cast<float>(step.visited_nodes.size()));
        for (int visited_node : step.visited_nodes) {
            trace_flat.push_back(static_cast<float>(visited_node));
        }

        trace_flat.push_back(static_cast<float>(step.frontier_neighbors.size()));
        for (int frontier_node : step.frontier_neighbors) {
            trace_flat.push_back(static_cast<float>(frontier_node));
        }
    }

    return trace_flat;
}



    //add to min heap based on weights
        //for each neighbor node
        //if total distance < current distance (with total dist being current nodes dist + dist to node)
        //  set its new distance and new parent node (our current node)
        //  else leave with prev node
        //once done for all neighbors 
    //mark current node as visited
    //visit neighbor with closest distance (from minheap)
    //repeat this