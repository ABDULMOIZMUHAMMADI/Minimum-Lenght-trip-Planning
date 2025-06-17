// Initialize map centered on Karachi
const map = L.map('map').setView([24.8607, 67.0011], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Initialize variables
const locations = [];
let headOffice = null;
const markers = [];
let routePolyline = null;

// DOM Elements
const headOfficeInput = document.getElementById('head-office');
const headOfficeBtn = document.getElementById('head-office-btn');
const deliveryInput = document.getElementById('delivery-address');
const addLocationBtn = document.getElementById('add-location-btn');
const optimizeBtn = document.getElementById('optimize-btn');
const locationList = document.getElementById('location-list');
const routeInfo = document.getElementById('route-info');

// Set head office
headOfficeBtn.addEventListener('click', async () => {
    const address = headOfficeInput.value.trim();
    if (!address) return;
    
    try {
        const response = await fetch('/get_address', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ address })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
            return;
        }
        
        // Clear previous head office
        if (headOffice) {
            map.removeLayer(headOffice.marker);
        }
        
        // Create new head office marker
        const marker = L.marker([data.lat, data.lng], {
            title: `Head Office: ${address}`,
            icon: L.divIcon({
                className: 'head-office-marker',
                html: '<div style="background-color:#198754;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">H</div>'
            })
        }).addTo(map);
        
        marker.bindPopup(`<b>Head Office</b><br>${address}`);
        
        headOffice = {
            address,
            coords: [data.lat, data.lng],
            marker
        };
        
        // Add to locations if not already present
        if (!locations.find(loc => loc.address === address)) {
            locations.unshift({
                address,
                coords: [data.lat, data.lng],
                marker,
                isHeadOffice: true
            });
            updateLocationList();
        }
        
        headOfficeInput.value = '';
    } catch (error) {
        console.error('Error setting head office:', error);
        alert('Failed to set head office');
    }
});

// Add delivery location
addLocationBtn.addEventListener('click', async () => {
    const address = deliveryInput.value.trim();
    if (!address) return;
    
    try {
        const response = await fetch('/get_address', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ address })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
            return;
        }
        
        // Check if location already exists
        if (locations.find(loc => loc.address === address)) {
            alert('Location already added');
            return;
        }
        
        // Create marker
        const marker = L.marker([data.lat, data.lng], {
            title: `Delivery: ${address}`,
            icon: L.divIcon({
                className: 'route-marker',
                html: `<div style="background-color:#0d6efd;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${locations.length + 1}</div>`
            })
        }).addTo(map);
        
        marker.bindPopup(`<b>Delivery Location</b><br>${address}`);
        
        // Add to locations
        locations.push({
            address,
            coords: [data.lat, data.lng],
            marker
        });
        
        updateLocationList();
        deliveryInput.value = '';
    } catch (error) {
        console.error('Error adding location:', error);
        alert('Failed to add location');
    }
});

// Optimize route
optimizeBtn.addEventListener('click', async () => {
    if (locations.length < 2) {
        alert('Please add at least 2 locations (including head office)');
        return;
    }
    
    // Extract coordinates
    const coords = locations.map(loc => loc.coords);
    
    try {
        const response = await fetch('/optimize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ locations: coords })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
            return;
        }
        
        // Remove existing route if any
        if (routePolyline) {
            map.removeLayer(routePolyline);
        }
        
        // Draw optimized route
        routePolyline = L.polyline(data.path, {
            color: '#dc3545',
            weight: 5,
            opacity: 0.8
        }).addTo(map);
        
        // Update route info
        routeInfo.innerHTML = `
            <p class="mb-1"><strong>Total Distance:</strong> ${data.distance_km}</p>
            <p class="mb-1"><strong>Stops:</strong> ${locations.length} locations</p>
            <p class="mb-0"><strong>Route Efficiency:</strong> ${calculateEfficiency(data.distance)}</p>
        `;
        
        // Fit map to route
        map.fitBounds(routePolyline.getBounds());
    } catch (error) {
        console.error('Optimization error:', error);
        alert('Failed to optimize route');
    }
});

// Helper functions
function updateLocationList() {
    locationList.innerHTML = '';
    
    locations.forEach((location, index) => {
        const li = document.createElement('div');
        li.className = `list-group-item d-flex justify-content-between align-items-center ${location.isHeadOffice ? 'list-group-item-success' : ''}`;
        
        const content = document.createElement('div');
        content.innerHTML = `
            <span class="badge ${location.isHeadOffice ? 'bg-success' : 'bg-primary'} me-2">
                ${location.isHeadOffice ? 'H' : index}
            </span>
            ${location.address}
        `;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm btn-outline-danger';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => removeLocation(index);
        
        li.appendChild(content);
        li.appendChild(removeBtn);
        locationList.appendChild(li);
    });
}

function removeLocation(index) {
    const location = locations[index];
    map.removeLayer(location.marker);
    locations.splice(index, 1);
    updateLocationList();
}

function calculateEfficiency(distance) {
    // Calculate a simple efficiency metric
    const minPossible = distance / locations.length;
    const efficiency = (minPossible / (distance / (locations.length * 0.8))) * 100;
    return `${Math.min(100, Math.round(efficiency))}%`;
}

// Initialize location list
updateLocationList();