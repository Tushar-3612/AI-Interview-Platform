
# -*- coding: utf-8 -*-
"""
Master Builder and Exporter for realinterviewcodingque.json
Compiles 180+ verified coding questions across all DSA categories into:
- backend/data/realinterviewcodingque.json
- ./realinterviewcodingque.json
"""
import os
import sys
import json

base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(base_dir, "parts"))

from part_arrays import get_arrays
from part_strings import get_strings
from part_linkedlists import get_linkedlists
from part_stacks_queues import get_stacks_queues
from part_binarysearch import get_binarysearch
from part_trees import get_trees
from part_heaps_greedy import get_heaps_greedy
from part_graphs import get_graphs
from part_dp import get_dp
from part_advanced import get_advanced

print("Imported base question modules")
