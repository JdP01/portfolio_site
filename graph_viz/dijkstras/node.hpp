#pragma once 
#include <iostream> 
#include <vector>


struct Node { 

    int value = 0;
    //store neighbor index & edge weight {idx,wt}
    //XYZ coordinates
    float coords[3];

    std::vector<std::pair<int, float>> neighbors = {};

};