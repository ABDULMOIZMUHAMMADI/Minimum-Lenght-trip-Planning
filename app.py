from flask import Flask, render_template, request, jsonify
import osmnx as ox  # Corrected from "osunx"
import networkx as nx
import numpy as np
from geopy.geocoders import Nominatim  # Corrected from "gecoders"
from python_tsp.exact import solve_tsp_dynamic_programming
from python_tsp.heuristics import solve_tsp_simulated_annealing
import logging

app = Flask(__name__)
app.logger.setLevel(logging.INFO)

# Load Karachi road network at startup
try:
    app.logger.info("Loading Karachi road network...")
    KARACHI_GRAPH = ox.graph_from_place("Karachi, Pakistan", network_type="drive")
    app.logger.info(f"Loaded graph with {len(KARACHI_GRAPH.nodes)} nodes")
except Exception as e:
    app.logger.error(f"Error loading Karachi graph: {str(e)}")
    KARACHI_GRAPH = None

geolocator = Nominatim(user_agent="karachi_delivery_optimizer")

def get_coordinates(address):
    """Convert address to latitude and longitude"""
    location = geolocator.geocode(f"{address}, Karachi, Pakistan")
    if location:
        return location.latitude, location.longitude
    return None

def optimize_route(locations):
    """Find optimal route using TSP algorithms"""
    # Get nearest OSM nodes
    nodes = [ox.nearest_nodes(KARACHI_GRAPH, lng, lat) for lat, lng in locations]
    
    # Build distance matrix
    n = len(nodes)
    dist_matrix = np.zeros((n, n))
    
    for i in range(n):
        for j in range(n):
            if i == j:
                dist_matrix[i][j] = 0
            else:
                try:
                    route_length = nx.shortest_path_length(
                        KARACHI_GRAPH, 
                        nodes[i], 
                        nodes[j], 
                        weight="length"
                    )
                    dist_matrix[i][j] = route_length
                except nx.NetworkXNoPath:
                    dist_matrix[i][j] = 1e9  # Large penalty for unreachable nodes
    
    # Solve TSP
    if n <= 15:
        permutation, distance = solve_tsp_dynamic_programming(dist_matrix)
    else:
        permutation, distance = solve_tsp_simulated_annealing(dist_matrix)
    
    # Return path coordinates
    path_coords = []
    for idx in permutation:
        node = nodes[idx]
        path_coords.append([
            KARACHI_GRAPH.nodes[node]["y"], 
            KARACHI_GRAPH.nodes[node]["x"]
        ])
    
    # Return to start
    path_coords.append(path_coords[0])
    
    return path_coords, distance

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/get_address", methods=["POST"])
def get_address():
    data = request.json
    address = data.get("address")
    
    if not address:
        return jsonify({"error": "Address is required"}), 400
    
    coords = get_coordinates(address)
    if coords:
        return jsonify({"lat": coords[0], "lng": coords[1]})
    else:
        return jsonify({"error": "Address not found in Karachi"}), 404

@app.route("/optimize", methods=["POST"])
def optimize():
    try:
        data = request.json
        locations = data.get("locations")
        
        if not locations or len(locations) < 2:
            return jsonify({"error": "At least 2 locations required"}), 400
        
        path, distance = optimize_route(locations)
        return jsonify({
            "path": path,
            "distance": distance,
            "distance_km": f"{(distance/1000):.2f} km"
        })
    except Exception as e:
        app.logger.error(f"Optimization error: {str(e)}")
        return jsonify({"error": "Route optimization failed"}), 500

if __name__ == "__main__":
    app.run(debug=True)