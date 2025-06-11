document.addEventListener('DOMContentLoaded', () => {
    const initialHeadInput = document.getElementById('initialHead');
    const maxCylinderInput = document.getElementById('maxCylinder');
    const directionSelect = document.getElementById('direction');
    const addRequestForm = document.getElementById('addRequestForm');
    const requestCylinderInput = document.getElementById('requestCylinder');
    const resetRequestsButton = document.getElementById('resetRequests');
    const requestListUl = document.getElementById('requestList');
    const runSCANButton = document.getElementById('runSCAN');

    const diskTrackDiv = document.getElementById('diskTrack');
    const diskHeadDiv = document.getElementById('diskHead');
    const cylinderLabelsDiv = document.getElementById('cylinderLabels');
    const currentActionP = document.getElementById('currentAction');

    const servicedOrderSpan = document.getElementById('servicedOrder');
    const totalHeadMovementSpan = document.getElementById('totalHeadMovement');
    const movementLogUl = document.getElementById('movementLog').querySelector('ul');

    let requests = [];
    let headMarker; // For the actual head element
    let requestMarkers = {}; // Store DOM elements for request markers {cylinder: element}

    const DEFAULT_MAX_CYLINDER = 199;
    const MOVEMENT_DELAY = 700; // ms for animation and step delay

    // --- Input and Setup ---
    addRequestForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const cylinder = parseInt(requestCylinderInput.value);
        const maxCylinder = parseInt(maxCylinderInput.value) || DEFAULT_MAX_CYLINDER;

        if (isNaN(cylinder) || cylinder < 0 || cylinder > maxCylinder) {
            alert(`Please enter a valid cylinder number between 0 and ${maxCylinder}.`);
            return;
        }
        if (!requests.includes(cylinder)) {
            requests.push(cylinder);
            renderRequestList();
            renderDiskVisualization(); // Re-render to add new marker
            runSCANButton.disabled = false;
        } else {
            alert(`Request for cylinder ${cylinder} already exists.`);
        }
        requestCylinderInput.value = '';
        requestCylinderInput.focus();
    });

    resetRequestsButton.addEventListener('click', () => {
        requests = [];
        renderRequestList();
        clearVisualizationAndResults();
        initialHeadInput.value = "50";
        maxCylinderInput.value = "199";
        directionSelect.value = "RIGHT";
        renderDiskVisualization(); // Reset to initial state
        runSCANButton.disabled = true;
    });
    
    [initialHeadInput, maxCylinderInput].forEach(input => {
        input.addEventListener('change', renderDiskVisualization);
    });


    function renderRequestList() {
        requestListUl.innerHTML = '';
        requests.forEach(req => {
            const li = document.createElement('li');
            li.textContent = req;
            // For new item animation:
            li.classList.add('new-request');
            requestListUl.appendChild(li);
            setTimeout(() => li.classList.remove('new-request'), 300);
        });
    }

    function clearVisualizationAndResults() {
        servicedOrderSpan.textContent = 'N/A';
        totalHeadMovementSpan.textContent = 'N/A';
        currentActionP.textContent = 'Status: Idle';
        movementLogUl.innerHTML = '';
        // Clear old request markers and path segments
        document.querySelectorAll('.request-marker, .seek-path-segment').forEach(el => el.remove());
        requestMarkers = {};
        // Disk head is persistent, just reset its position in renderDiskVisualization
    }

    // --- Visualization ---
    function renderDiskVisualization() {
        const headPos = parseInt(initialHeadInput.value);
        const maxCyl = parseInt(maxCylinderInput.value) || DEFAULT_MAX_CYLINDER;

        // Clear existing markers before re-rendering
        Object.values(requestMarkers).forEach(marker => marker.remove());
        requestMarkers = {};
        document.querySelectorAll('.seek-path-segment').forEach(el => el.remove()); // Clear path

        // Position Head
        positionElementOnTrack(diskHeadDiv, headPos, maxCyl);

        // Create Request Markers
        requests.forEach(reqCylinder => {
            if (!requestMarkers[reqCylinder]) { // Avoid duplicating if already exists
                const marker = document.createElement('div');
                marker.classList.add('request-marker');
                marker.dataset.cylinder = reqCylinder;
                diskTrackDiv.appendChild(marker);
                positionElementOnTrack(marker, reqCylinder, maxCyl);
                requestMarkers[reqCylinder] = marker;
            }
        });
        
        // Update Cylinder Labels
        renderCylinderLabels(maxCyl);
    }
    
    function renderCylinderLabels(maxCylinder) {
        cylinderLabelsDiv.innerHTML = ''; // Clear existing
        const numLabels = Math.min(10, maxCylinder + 1); // Show up to 10 labels
        const step = Math.max(1, Math.floor(maxCylinder / (numLabels -1 < 1 ? 1 : numLabels -1)));

        for (let i = 0; i <= maxCylinder; i += step) {
            if (i > maxCylinder && cylinderLabelsDiv.children.length > 0 && 
                parseInt(cylinderLabelsDiv.lastChild.textContent) !== maxCylinder) {
                // Ensure the last label is maxCylinder if step doesn't hit it
                // This condition might need adjustment to ensure it always adds maxCylinder if not present
            }
            const label = document.createElement('span');
            label.classList.add('cylinder-label');
            label.textContent = i;
            positionElementOnTrack(label, i, maxCylinder, true); // true for label positioning
            cylinderLabelsDiv.appendChild(label);
        }
        // Ensure 0 and maxCylinder labels are always present if not covered by step
        if (maxCylinder > 0 && (maxCylinder % step !== 0 || numLabels === 1)) {
             const lastLabel = document.createElement('span');
             lastLabel.classList.add('cylinder-label');
             lastLabel.textContent = maxCylinder;
             positionElementOnTrack(lastLabel, maxCylinder, maxCylinder, true);
             cylinderLabelsDiv.appendChild(lastLabel);
        }
        if (step > 0 && cylinderLabelsDiv.firstChild && cylinderLabelsDiv.firstChild.textContent !== '0' ) {
             const firstLabel = document.createElement('span');
             firstLabel.classList.add('cylinder-label');
             firstLabel.textContent = '0';
             positionElementOnTrack(firstLabel, 0, maxCylinder, true);
             cylinderLabelsDiv.insertBefore(firstLabel, cylinderLabelsDiv.firstChild);
        }
    }


    function positionElementOnTrack(element, cylinder, maxCylinder, isLabel = false) {
        const percentage = (cylinder / maxCylinder) * 100;
        if (isLabel) {
            element.style.left = `${percentage}%`;
        } else {
            // For head and request markers, adjust for their width to center them
            const elementWidthPercent = (element.offsetWidth / diskTrackDiv.offsetWidth) * 100;
            element.style.left = `calc(${percentage}% - ${element.offsetWidth / 2}px)`;
        }
    }
    
    async function moveHeadTo(cylinder, maxCylinder, isServicing = false) {
        const currentHeadPos = parseFloat(diskHeadDiv.style.left || "0%"); // More robust way to get current numeric position
        
        positionElementOnTrack(diskHeadDiv, cylinder, maxCylinder);
        
        if (isServicing && requestMarkers[cylinder]) {
            requestMarkers[cylinder].classList.add('serviced');
            currentActionP.textContent = `Status: Serviced request at cylinder ${cylinder}. Moving...`;
        } else if (!isServicing && cylinder === 0) {
             currentActionP.textContent = `Status: Reached cylinder 0. Changing direction.`;
        } else if (!isServicing && cylinder === maxCylinder) {
             currentActionP.textContent = `Status: Reached cylinder ${maxCylinder}. Changing direction.`;
        } else {
            currentActionP.textContent = `Status: Moving head to cylinder ${cylinder}...`;
        }
        await delay(MOVEMENT_DELAY);
    }
    
    function drawSeekPathSegment(fromCylinder, toCylinder, maxCylinder) {
        const segment = document.createElement('div');
        segment.classList.add('seek-path-segment');
        
        const startPercent = (Math.min(fromCylinder, toCylinder) / maxCylinder) * 100;
        const widthPercent = (Math.abs(toCylinder - fromCylinder) / maxCylinder) * 100;

        segment.style.left = `${startPercent}%`;
        segment.style.width = `0%`; // Start with 0 width for animation
        diskTrackDiv.appendChild(segment);

        // Trigger reflow for transition
        segment.getBoundingClientRect(); 
        segment.style.width = `${widthPercent}%`;
    }


    // --- SCAN Algorithm ---
    runSCANButton.addEventListener('click', async () => {
        if (requests.length === 0) {
            alert('Add some requests first!');
            return;
        }

        runSCANButton.disabled = true;
        resetRequestsButton.disabled = true;
        addRequestForm.querySelector('button').disabled = true;

        clearVisualizationAndResults(); // Clear previous run visuals but keep markers
        renderDiskVisualization(); // Ensure markers are fresh if any were removed by clear

        let currentHead = parseInt(initialHeadInput.value);
        const maxCyl = parseInt(maxCylinderInput.value) || DEFAULT_MAX_CYLINDER;
        let direction = directionSelect.value; // "LEFT" or "RIGHT"

        let seekSequence = [currentHead];
        let totalMovement = 0;
        let localRequests = [...requests].sort((a, b) => a - b); // Crucial: work with sorted copy

        currentActionP.textContent = `Status: Starting SCAN from ${currentHead}, direction: ${direction}`;
        await delay(MOVEMENT_DELAY);
        
        addLogEntry(`Initial head position: ${currentHead}`);

        let directionChanged = false;

        // SCAN moves in one direction, then reverses
        for (let pass = 0; pass < 2; pass++) {
            if (direction === "RIGHT") {
                // Service requests from currentHead up to maxCyl
                for (let i = 0; i < localRequests.length; i++) {
                    if (localRequests[i] >= currentHead) {
                        const reqToService = localRequests[i];
                        drawSeekPathSegment(currentHead, reqToService, maxCyl);
                        await moveHeadTo(reqToService, maxCyl, true);
                        totalMovement += Math.abs(reqToService - currentHead);
                        seekSequence.push(reqToService);
                        currentHead = reqToService;
                        addLogEntry(`Serviced ${reqToService}. Movement: ${Math.abs(seekSequence[seekSequence.length-1] - seekSequence[seekSequence.length-2])}`);
                        localRequests.splice(i, 1); // Remove serviced request
                        i--; // Adjust index after removal
                    }
                }
                // If moving right and haven't reached end, or if there are still requests in the other direction
                if (currentHead < maxCyl && (localRequests.length > 0 || pass === 0) ) {
                     if (currentHead !== maxCyl) { // Only move to end if not already there
                        drawSeekPathSegment(currentHead, maxCyl, maxCyl);
                        await moveHeadTo(maxCyl, maxCyl, false);
                        totalMovement += Math.abs(maxCyl - currentHead);
                        seekSequence.push(maxCyl);
                        currentHead = maxCyl;
                        addLogEntry(`Reached end (Cylinder ${maxCyl}). Movement: ${Math.abs(seekSequence[seekSequence.length-1] - seekSequence[seekSequence.length-2])}`);
                    }
                }
                direction = "LEFT"; // Change direction for next pass or if this was the first
                if (localRequests.length === 0) break; // All done
            
            } else { // direction === "LEFT"
                 // Service requests from currentHead down to 0
                 // Iterate backwards through sorted requests to find ones to the left
                for (let i = localRequests.length - 1; i >= 0; i--) {
                    if (localRequests[i] <= currentHead) {
                        const reqToService = localRequests[i];
                        drawSeekPathSegment(currentHead, reqToService, maxCyl);
                        await moveHeadTo(reqToService, maxCyl, true);
                        totalMovement += Math.abs(reqToService - currentHead);
                        seekSequence.push(reqToService);
                        currentHead = reqToService;
                        addLogEntry(`Serviced ${reqToService}. Movement: ${Math.abs(seekSequence[seekSequence.length-1] - seekSequence[seekSequence.length-2])}`);
                        localRequests.splice(i, 1); // Remove serviced request
                        // No index adjustment needed when iterating backwards and removing
                    }
                }
                // If moving left and haven't reached start, or if there are still requests in the other direction
                if (currentHead > 0 && (localRequests.length > 0 || pass === 0)) {
                     if (currentHead !== 0) { // Only move to end if not already there
                        drawSeekPathSegment(currentHead, 0, maxCyl);
                        await moveHeadTo(0, maxCyl, false);
                        totalMovement += Math.abs(0 - currentHead);
                        seekSequence.push(0);
                        currentHead = 0;
                        addLogEntry(`Reached start (Cylinder 0). Movement: ${Math.abs(seekSequence[seekSequence.length-1] - seekSequence[seekSequence.length-2])}`);
                    }
                }
                direction = "RIGHT"; // Change direction
                if (localRequests.length === 0) break; // All done
            }
             if (localRequests.length === 0 && pass === 0 && (currentHead === 0 || currentHead === maxCyl)) {
                // This means all requests were in one sweep, no need for a second pass.
                // However, SCAN always goes to the end of the disk in the initial direction
                // if it hasn't already by servicing a request at that end.
                // The logic above for moving to maxCyl/0 should handle this.
            }
        }


        servicedOrderSpan.textContent = seekSequence.slice(1).join(' -> '); // Exclude initial head
        totalHeadMovementSpan.textContent = totalMovement;
        currentActionP.textContent = `Status: SCAN Complete. Total head movement: ${totalMovement}.`;
        addLogEntry(`SCAN complete. Total Movement: ${totalMovement}. Order: ${seekSequence.slice(1).join(', ')}`);

        runSCANButton.disabled = false;
        resetRequestsButton.disabled = false;
        addRequestForm.querySelector('button').disabled = false;
    });
    
    function addLogEntry(message) {
        const li = document.createElement('li');
        li.textContent = message;
        movementLogUl.appendChild(li);
        movementLogUl.scrollTop = movementLogUl.scrollHeight; // Auto-scroll
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Initial Render
    renderDiskVisualization();
    if (requests.length === 0) {
        runSCANButton.disabled = true;
    }
});