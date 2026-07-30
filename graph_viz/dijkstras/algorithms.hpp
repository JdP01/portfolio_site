#pragma once 
#include <iostream> 
#include <string> 
#include <vector> 
#include "node.hpp"

std::vector<int> dijkstras(const std::vector<Node>& graph, int start_node, int end_node); 
std::vector<float> dijkstras_trace(const std::vector<Node>& graph, int start_node, int end_node);
