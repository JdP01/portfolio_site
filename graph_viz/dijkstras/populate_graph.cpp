#include <iostream> 
#include <string> 
#include <vector> 
#include <fstream>
#include <sstream>  
#include "populate_graph.hpp"
#include "node.hpp"


std::vector<Node> populateGraph(std::vector<float>& nodes, std::vector<float>& edges){ 
    
    //initiate a graph example
    //Node first = {5,{{2,0.5}}};
    
    std::vector<Node> graph(nodes.size()/5);

    int idx;
    int idx2;
    int wt; 
    //node array will have [index,value,x,y,z,index2,value2,x2,y2,z2, ....]
    for(unsigned int i = 0; i < nodes.size(); i += 5){ //change nodes later to be the array
        idx = nodes[i]; 
        graph[idx].value = nodes[i+1]; //value
        graph[idx].coords[0] = nodes[i+2]; //X
        graph[idx].coords[1] = nodes[i+3]; //Y  
        graph[idx].coords[2] = nodes[i+4]; //Z  coordinates 

    }

    //edge array will have [from_idx,to_idx,wt, from_idx2,to_idx2,wt2, ...]
    for(unsigned int i = 0; i < edges.size(); i += 3){ 
        idx = edges[i]; //get from node
        idx2 = edges[i+1]; //get to node
        wt = edges[i+2]; 

       graph[idx].neighbors.push_back({idx2,wt}); //store neighbor index + edge weight
        graph[idx2].neighbors.push_back({idx,wt}); //make graph undirected
    }

    return graph;
}
