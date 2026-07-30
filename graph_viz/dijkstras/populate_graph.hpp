#pragma once 
#include <iostream> 
#include <string> 
#include <vector> 
#include <fstream>
#include <sstream>  
#include "node.hpp"

std::vector<Node> populateGraph(std::vector<float>& nodes,std::vector<float>& edges);

std::vector<float> parse_nodes(const std::string& arg);