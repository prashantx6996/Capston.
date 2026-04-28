const API_URL = "https://api.thingspeak.com/channels/3319374/feeds.json?api_key=0ZUF9R9I3MC4739H&results=15";
let qualityChart = null;

// Theming variables for the chart
const THEME = {
    textColor: '#94A3B8',
    gridColor: 'rgba(255, 255, 255, 0.05)',
    tdsLine: 'rgba(167, 139, 250, 1)',
    tdsBg: 'rgba(167, 139, 250, 0.2)',
    turbidityLine: 'rgba(96, 165, 250, 1)',
    turbidityBg: 'rgba(96, 165, 250, 0.2)',
};

async function fetchData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        const feeds = data.feeds;
        if (!feeds || feeds.length === 0) return;

        const latest = feeds[feeds.length - 1];

        // Parse metrics Safely
        const tds = parseFloat(latest.field1) || 0;
        const turbidity = parseFloat(latest.field2) || 0;
        const temp = parseFloat(latest.field3) || 0;

        // Update UI
        animateValue("tds", tds);
        animateValue("turbidity", turbidity);
        animateValue("temp", temp);

        // Update Statuses
        updateStatus("tds-status", tds, 500, "ppm");
        updateStatus("turbidity-status", turbidity, 5, "NTU");
        // Temperature logic (assuming > 35 is warning, > 45 is critical)
        updateStatus("temp-status", temp, 45, "°C", 35); 

        // Check overall system alerts
        checkAlerts(tds, turbidity);

        // Update Chart
        updateChart(feeds);

    } catch (error) {
        console.error("Error fetching ThingSpeak data:", error);
    }
}

// Simple number counting animation
function animateValue(id, target) {
    const el = document.getElementById(id);
    const start = parseFloat(el.innerText) || 0;
    const duration = 1000;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing out Quint
        const ease = 1 - Math.pow(1 - progress, 5);
        
        const current = start + (target - start) * ease;
        
        // Format to 1 decimal place if it's not a whole number or it's temperature
        if(id === "temp" || target % 1 !== 0) {
            el.innerText = current.toFixed(1);
        } else {
            el.innerText = Math.round(current);
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.innerText = target;
        }
    }
    
    requestAnimationFrame(update);
}

function updateStatus(id, value, criticalLimit, unit, warningLimit = null) {
    const el = document.getElementById(id);
    const warnThresh = warningLimit || (criticalLimit * 0.8);
    
    // Remove previous classes
    el.classList.remove("status-safe", "status-warning", "status-danger");

    if (value >= criticalLimit) {
        el.innerText = "Critical";
        el.classList.add("status-danger");
    } else if (value >= warnThresh) {
        el.innerText = "Warning";
        el.classList.add("status-warning");
    } else {
        el.innerText = "Safe";
        el.classList.add("status-safe");
    }
}

function checkAlerts(tds, turbidity) {
    const container = document.getElementById("alert-container");
    const icon = document.getElementById("alert-icon");
    const title = document.getElementById("alert-title");
    const message = document.getElementById("alert-message");

    container.classList.remove("alert-safe", "alert-banner");
    
    if (tds > 500 || turbidity > 5) {
        container.className = "alert-banner";
        icon.className = "fa-solid fa-triangle-exclamation";
        title.innerText = "Water Quality Warning";
        message.innerText = "Parameters have exceeded safe thresholds. Immediate action recommended.";
    } else {
        container.className = "alert-banner alert-safe";
        icon.className = "fa-solid fa-circle-check";
        title.innerText = "System Status Normal";
        message.innerText = "Water parameters are well within safe operating limits.";
    }
}

function updateChart(feeds) {
    const ctx = document.getElementById('qualityChart').getContext('2d');
    
    // Create Gradients
    const gradientTDS = ctx.createLinearGradient(0, 0, 0, 400);
    gradientTDS.addColorStop(0, THEME.tdsBg);
    gradientTDS.addColorStop(1, 'rgba(167, 139, 250, 0)');

    const gradientTurb = ctx.createLinearGradient(0, 0, 0, 400);
    gradientTurb.addColorStop(0, THEME.turbidityBg);
    gradientTurb.addColorStop(1, 'rgba(96, 165, 250, 0)');

    const labels = feeds.map(f => {
        const d = new Date(f.created_at);
        return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    });
    const tdsData = feeds.map(f => parseFloat(f.field1) || 0);
    const turbData = feeds.map(f => parseFloat(f.field2) || 0);

    if (qualityChart) {
        qualityChart.data.labels = labels;
        qualityChart.data.datasets[0].data = tdsData;
        qualityChart.data.datasets[1].data = turbData;
        qualityChart.update();
        return;
    }

    qualityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'TDS (ppm)',
                    data: tdsData,
                    borderColor: THEME.tdsLine,
                    backgroundColor: gradientTDS,
                    borderWidth: 3,
                    pointBackgroundColor: '#0B192C',
                    pointBorderColor: THEME.tdsLine,
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Turbidity (NTU)',
                    data: turbData,
                    borderColor: THEME.turbidityLine,
                    backgroundColor: gradientTurb,
                    borderWidth: 3,
                    pointBackgroundColor: '#0B192C',
                    pointBorderColor: THEME.turbidityLine,
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: false // We built a custom legend in HTML
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    usePointStyle: true
                }
            },
            scales: {
                x: {
                    grid: {
                        color: THEME.gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: THEME.textColor,
                        maxTicksLimit: 8
                    }
                },
                y: {
                    grid: {
                        color: THEME.gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: THEME.textColor
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// Tab Switching Logic
function switchTab(tabId, element) {
    // Hide all views
    document.querySelectorAll('.nav-view').forEach(view => {
        view.style.display = 'none';
        view.classList.remove('active-view');
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.classList.remove('active');
    });
    
    // Show selected view
    const targetView = document.getElementById(tabId);
    if(targetView) {
        targetView.style.display = 'block';
        // Minor delay to re-trigger animations if any
        setTimeout(() => targetView.classList.add('active-view'), 10);
    }
    
    // Add active class to clicked nav link
    element.classList.add('active');
}

// Fetch historical data (using average=1440 for daily averages)
async function fetchHistory() {
    try {
        const url = "https://api.thingspeak.com/channels/3319374/feeds.json?api_key=0ZUF9R9I3MC4739H&results=10&average=1440";
        const response = await fetch(url);
        const data = await response.json();
        
        let feeds = data.feeds || [];
        
        // Filter out completely null days
        feeds = feeds.filter(f => f.field1 !== null || f.field2 !== null);
        
        // Take the latest 3 days
        const last3Days = feeds.slice(-3).reverse();

        const container = document.getElementById('history-container');
        container.innerHTML = ''; // Clear loading

        if(last3Days.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted);">No historical data available.</div>';
            return;
        }

        const today = new Date();

        last3Days.forEach((feed, index) => {
            const d = new Date(feed.created_at);
            
            // Generate readable labels (Day 1, Day 2, etc, or "Today" / "Yesterday")
            let title = `Day ${index + 1}`;
            
            // Format Date (e.g., June 15, 2023)
            const dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

            // Parse values
            const tdsVal = parseFloat(feed.field1) || 0;
            const turbVal = parseFloat(feed.field2) || 0;

            // Determine Status Safely
            const getStatusObj = (val, limit) => {
                if (val >= limit) return { text: "Critical", class: "status-danger" };
                if (val >= limit * 0.8) return { text: "Warning", class: "status-warning" };
                return { text: "Safe", class: "status-safe" };
            };

            const tdsStatus = getStatusObj(tdsVal, 500);
            const turbStatus = getStatusObj(turbVal, 5);

            // Construct HTML for Card
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="history-card-header">
                    <h4>${title}</h4>
                    <p>${dateStr}</p>
                </div>
                <div class="history-metrics">
                    <div class="history-metric">
                        <span class="history-metric-title">TDS</span>
                        <span class="history-metric-value">${tdsVal.toFixed(0)} <span style="font-size:16px;font-weight:400">ppm</span></span>
                        <span class="history-badge ${tdsStatus.class}">${tdsStatus.text}</span>
                    </div>
                    <div class="history-metric">
                        <span class="history-metric-title">Turbidity</span>
                        <span class="history-metric-value">${turbVal.toFixed(1)} <span style="font-size:16px;font-weight:400">NTU</span></span>
                        <span class="history-badge ${turbStatus.class}">${turbStatus.text}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Error fetching ThingSpeak history:", error);
    }
}


// Initial Call
fetchData();
fetchHistory();

// Refresh every 15 seconds
setInterval(fetchData, 15000);

// Refresh history every hour (3600000 ms)
setInterval(fetchHistory, 3600000);

// Download Data Report
async function downloadReport() {
    const btn = document.getElementById('download-report-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Downloading...';
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';

    try {
        const timeframe = document.getElementById('report-timeframe').value;
        let url = `https://api.thingspeak.com/channels/3319374/feeds.csv?api_key=0ZUF9R9I3MC4739H`;
        
        if (timeframe !== 'all') {
            url += `&days=${timeframe}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const csvData = await response.text();
        
        // Create a Blob and trigger download
        const blob = new Blob([csvData], { type: 'text/csv' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = timeframe === 'all' ? 'water_quality_report_all_time.csv' : `water_quality_report_last_${timeframe}_days.csv`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
        console.error("Error downloading report:", error);
        alert("Failed to download the data. Please try again later.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
}