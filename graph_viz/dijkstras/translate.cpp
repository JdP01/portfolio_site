#include <iostream>
#include <stdexcept>
#include <vector>
#include "populate_graph.hpp"
#include "node.hpp"
#include "algorithms.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
#endif

std::vector<int> call_dijkstras(std::vector<float> nodes,std::vector<float> edges, int start, int end){ 

    //node array will have [index,value,x,y,z,index2,value2,x2,y2,z2, ....]
    //edge array will have [startn,endn,weight, startn2,endn2,weight2, ...]

    if (nodes.size() % 5 != 0) {
        throw std::invalid_argument("nodes array length must be divisible by 5");
    }

    if (edges.size() % 3 != 0) {
        throw std::invalid_argument("edges array length must be divisible by 3");
    }

    std::vector<Node> graph = populateGraph(nodes, edges); 

    if (start < 0 || end < 0 || start >= static_cast<int>(graph.size()) || end >= static_cast<int>(graph.size())) {
        throw std::out_of_range("start or end index is out of range");
    }

    std::vector<int> fastest_path = dijkstras(graph,start,end);
    //call dijkstras with our populated graph

    return fastest_path;
}

std::vector<float> call_dijkstras_trace(std::vector<float> nodes, std::vector<float> edges, int start, int end) {

    if (nodes.size() % 5 != 0) {
        throw std::invalid_argument("nodes array length must be divisible by 5");
    }

    if (edges.size() % 3 != 0) {
        throw std::invalid_argument("edges array length must be divisible by 3");
    }

    std::vector<Node> graph = populateGraph(nodes, edges);

    if (start < 0 || end < 0 || start >= static_cast<int>(graph.size()) || end >= static_cast<int>(graph.size())) {
        throw std::out_of_range("start or end index is out of range");
    }

    return dijkstras_trace(graph, start, end);
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(dijkstras_module) {
    emscripten::register_vector<float>("VectorFloat");
    emscripten::register_vector<int>("VectorInt");
    emscripten::function("fastestPath", &call_dijkstras);
    emscripten::function("tracePath", &call_dijkstras_trace);
}
#endif