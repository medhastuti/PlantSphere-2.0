/* ------------------------
   Firebase Config
   ------------------------ */
const firebaseConfig = {
  apiKey: "AIzaSyBvoQsg7FZMl7nrRpqyApxPbpotoPXbGB0",
  authDomain: "plantsphere-b13e7.firebaseapp.com",
  databaseURL: "https://plantsphere-b13e7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "plantsphere-b13e7",
  storageBucket: "plantsphere-b13e7.firebasestorage.app",
  messagingSenderId: "555353027312",
  appId: "1:555353027312:web:174c73d084da7adfdac835",
  measurementId: "G-J0MEE3R9B3"
};

/* ------------------------
   Firebase Paths (Final)
   ------------------------ */
const PATHS = {
  pumpState: "pump/state",
  pumpStatus: "pump/status",
  waterLevel: "water/value",
  dhtTemp: "environment/temperature",
  dhtHumidity: "environment/humidity",
  solar: "solar/voltage",
  ldr: "ldr/value",
  soilMoist: "soil/value"
};

/* ------------------------
   DOM Elements
   ------------------------ */
const connectionStatusEl = document.getElementById("connectionStatus");

const pumpToggleBtn = document.getElementById("pumpToggle");
const pumpStateText = document.getElementById("pumpStateText");
const pumpBadge = document.getElementById("pumpBadge");
const pumpUpdated = document.getElementById("pumpUpdated");

const waterValueEl = document.getElementById("waterValue");
const waterWaveEl = document.getElementById("waterWave");
const waterStatusEl = document.getElementById("waterStatus");
const waterUpdatedEl = document.getElementById("waterUpdated");

const tempValueEl = document.getElementById("tempValue");
const tempUpdatedEl = document.getElementById("tempUpdated");
const humValueEl = document.getElementById("humValue");
const humUpdatedEl = document.getElementById("humUpdated");
const tempBadge = document.getElementById("tempBadge");
const humBadge = document.getElementById("humBadge");

const soilMoistEl = document.getElementById("soilMoist");
const soilUpdatedEl = document.getElementById("soilUpdated");
const soilStatusEl = document.getElementById("soilStatus");
const soilGaugeValue = document.getElementById("soilGaugeValue");

const ldrValueEl = document.getElementById("ldrValue");
const ldrFillEl = document.getElementById("ldrFill");
const ldrStatusEl = document.getElementById("ldrStatus");
const ldrUpdatedEl = document.getElementById("ldrUpdated");

const voltageCanvas = document.getElementById("voltageCanvas");
const voltageValueEl = document.getElementById("voltageValue");
const voltageUpdatedEl = document.getElementById("voltageUpdated");
const voltageBadge = document.getElementById("voltageBadge");
const voltagePointsCountEl = document.getElementById("voltagePointsCount");

/* Set label */
document.getElementById('pathsHint').textContent = JSON.stringify(PATHS);

/* ------------------------
   Firebase Init
   ------------------------ */
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const connectedRef = database.ref(".info/connected");

// ----- NODEMCU WEB WATCHER FLAG (helps detect offline) -----
const nodeConnRef = database.ref("deviceStatus/nodemcu/connected");

// mark this browser active
nodeConnRef.set(true);

// if browser disconnects → mark it false
nodeConnRef.onDisconnect().set(false);


let firebaseConnected = false;

/* ------------------------
   Utility
   ------------------------ */
function safeSet(el, text) { if (el) el.textContent = text; }

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

/* ------------------------
   Gauge Setup
   ------------------------ */
function setupGauge(svgId, color){
  const svg = document.getElementById(svgId);
  if (!svg) return null;
  const arc = svg.querySelector('.gauge-arc');
  if (arc) arc.style.stroke = color;
  const len = arc ? arc.getTotalLength() : 1;
  if (arc){
    arc.style.strokeDasharray = len;
    arc.style.strokeDashoffset = len;
    arc.getBoundingClientRect();
  }
  return { svg, arc, len };
}

function setGauge(g, value){
  if (!g || !g.arc) return;
  const clamped = Math.max(0, Math.min(100, Number(value)));
  const offset = g.len * (1 - clamped / 100);
  requestAnimationFrame(() => { g.arc.style.strokeDashoffset = offset; });
}

const soilGauge = setupGauge("soilGauge", "#22c55e");
const tempGauge = setupGauge("tempGauge", "#fb923c");
const humGauge = setupGauge("humGauge", "#38bdf8");

/* ------------------------
   Voltage Graph (Dummy Mode Only)
   ------------------------ */
const voltageBuffer = [];
const MAX_POINTS = 40;

function resizeVoltageCanvas(){
  if (!voltageCanvas) return;
  const ctx = voltageCanvas.getContext("2d");
  const w = voltageCanvas.clientWidth;
  const h = voltageCanvas.clientHeight || 180;
  const dpr = window.devicePixelRatio || 1;
  voltageCanvas.width = Math.floor(w * dpr);
  voltageCanvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawVoltageGraph();
}

window.addEventListener("resize", debounce(resizeVoltageCanvas, 150));

function drawVoltageGraph() {
  if (!voltageCanvas) return;

  const ctx = voltageCanvas.getContext("2d");
  const w = voltageCanvas.clientWidth;
  const h = voltageCanvas.clientHeight;

  ctx.clearRect(0, 0, w, h);

  if (!voltageBuffer.length) {
    ctx.fillStyle = "#9aa4b2";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText("No voltage data", 12, 20);
    return;
  }

  const paddingLeft = 30;     // no numbers on left, small padding
  const paddingRight = 50;    // space on right for numbers
  const padding = 20;

  const plotW = w - paddingLeft - paddingRight;
  const plotH = h - padding * 2;

  // Extract values
  const values = voltageBuffer.map(p => p.v);
  let minV = Math.min(...values);
  let maxV = Math.max(...values);

  if (minV === maxV) { minV -= 1; maxV += 1; }

  // ---------------- GRID LINES ----------------
  const gridLines = 5;
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= gridLines; i++) {
    const y = padding + (plotH / gridLines) * i;

    // horizontal line
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();

    // Voltage scale numbers (RIGHT SIDE)
    const scaleValue = maxV - ((maxV - minV) / gridLines) * i;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(scaleValue.toFixed(2) + " V", w - paddingRight + 6, y + 4);
  }

  // ---------------- GRAPH LINE ----------------
  ctx.beginPath();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "#60a5fa";

  voltageBuffer.forEach((pt, i) => {
    const x = paddingLeft + (plotW * i / (voltageBuffer.length - 1));
    const y = padding + (1 - (pt.v - minV) / (maxV - minV)) * plotH;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  // ---------------- POINT DOTS ----------------
  voltageBuffer.forEach((pt, i) => {
    const x = paddingLeft + (plotW * i / (voltageBuffer.length - 1));
    const y = padding + (1 - (pt.v - minV) / (maxV - minV)) * plotH;
    ctx.beginPath();
    ctx.fillStyle = "#93c5fd";
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}



/* ------------------------
   Dummy Mode (FIXED)
   ------------------------ */
let dummyIntervals = [];
let dummyPumpState = false;

function stopDummyData(){
  dummyIntervals.forEach(i=>clearInterval(i));
  dummyIntervals = [];
}

function startDummyData(){
  stopDummyData();
  console.warn("Demo mode!");

  dummyPumpState = false;
  updatePumpUI(false, Date.now());

  /* ---- SOIL ---- */
  dummyIntervals.push(setInterval(()=>{
    const moist = Math.random() * 80;
    safeSet(soilMoistEl, moist.toFixed(1)+"%");
    soilGaugeValue.textContent = moist.toFixed(1);
    setGauge(soilGauge, moist);
    soilStatusEl.textContent = moist < 30 ? "Dry" : moist < 60 ? "Moist" : "Wet";
    soilUpdatedEl.textContent = new Date().toLocaleString();
  },1500));

  /* ---- TEMP + HUM ---- */
  dummyIntervals.push(setInterval(()=>{
    const t = 18 + Math.random()*15;
    const h = 30 + Math.random()*50;
    safeSet(tempValueEl, t.toFixed(1)+" °C");
    safeSet(humValueEl, h.toFixed(1)+"%");
    setGauge(tempGauge, (t/60)*100);
    setGauge(humGauge, h);
    tempUpdatedEl.textContent = new Date().toLocaleString();
    humUpdatedEl.textContent = new Date().toLocaleString();
  },2000));

  /* ---- WATER LEVEL (FIXED % MODE) ---- */
  dummyIntervals.push(setInterval(()=>{
    const pct = Math.random() * 100; // 0–100%

    // % text
    safeSet(waterValueEl, pct.toFixed(1) + "%");

    // Wave height (smooth)
    waterWaveEl.style.height = pct + "%";

    // Status logic
    if (pct >= 70) {
      waterStatusEl.textContent = "HIGH";
      waterStatusEl.className = "badge ok";
    } 
    else if (pct >= 30) {
      waterStatusEl.textContent = "MEDIUM";
      waterStatusEl.className = "badge warn";
    } 
    else {
      waterStatusEl.textContent = "LOW";
      waterStatusEl.className = "badge err";
    }

    waterUpdatedEl.textContent = new Date().toLocaleString();
  },1800));

  /* ---- LDR ---- */
  dummyIntervals.push(setInterval(()=>{
    const pct = Math.random() * 100;
    safeSet(ldrValueEl, pct.toFixed(1)+"%");
    ldrFillEl.style.width = pct+"%";
    ldrStatusEl.textContent = pct > 70 ? "Bright" : pct > 30 ? "Medium" : "Dark";
    ldrUpdatedEl.textContent = new Date().toLocaleString();
  },1600));

  /* ---- SOLAR VOLTAGE (Graph + Status) ---- */
  dummyIntervals.push(setInterval(() => {

    // realistic solar voltage pattern  
    // morning (3.0V+), noon peak (4.5V), evening drop (0.5–2.5V)
    let v;

    const hour = new Date().getHours();

    if (hour >= 10 && hour <= 16) {
      // noon → peak sunlight
      v = 3.5 + Math.random() * 1.2;     // 3.5V – 4.7V
    }
    else if (hour >= 7 && hour < 10) {
      // morning
      v = 2.5 + Math.random() * 1.0;     // 2.5V – 3.5V
    }
    else if (hour >= 16 && hour <= 18) {
      // sunset
      v = 1.2 + Math.random() * 1.5;     // 1.2V – 2.7V
    }
    else {
      // night
      v = 0.2 + Math.random() * 1.0;     // 0.2V – 1.2V
    }

    v = Number(v.toFixed(2)); // keep UI clean

    // Show voltage value
    safeSet(voltageValueEl, v.toFixed(2) + " V");
    voltageUpdatedEl.textContent = new Date().toLocaleString();

    // Status
    const sunlight = v >= 3.0;
    voltageBadge.textContent = sunlight ? "Good" : "Low";
    voltageBadge.className = sunlight ? "badge ok" : "badge warn";

    // Add point to buffer
    voltageBuffer.push({ v });

    if (voltageBuffer.length > MAX_POINTS) voltageBuffer.shift();

    voltagePointsCountEl.textContent = voltageBuffer.length;

    // Redraw graph
    drawVoltageGraph();

  }, 1700));

}


/* ------------------------
   Pump UI
   ------------------------ */
function updatePumpUI(state, updatedAt = null) {
  state = String(state || "off").toLowerCase();

  const isOn = (state === "on");

  pumpStateText.textContent = isOn ? "ON" : "OFF";
  pumpBadge.textContent = isOn ? "ON" : "OFF";

  pumpBadge.className = isOn ? "badge ok" : "badge err";
  pumpToggleBtn.checked = isOn;

  pumpUpdated.textContent = updatedAt 
      ? new Date(updatedAt).toLocaleString()
      : new Date().toLocaleString();
}


/* ------------------------
   Firebase Connectivity Listener
   ------------------------ */
connectedRef.on("value", snap=>{
  if (snap.val() === true) {
    firebaseConnected = true;
    connectionStatusEl.textContent = "Connected";
    connectionStatusEl.className = "badge ok";
    stopDummyData();
  } else {
    firebaseConnected = false;
    connectionStatusEl.textContent = "Disconnected • Demo Mode";
    connectionStatusEl.className = "badge err";
    startDummyData();
  }
});

/* =======================================
   COMBINED CONNECTIVITY CONTROLLER
   - Firebase Connected?
   - NodeMCU Connected?
   - Decide DEMO / LIVE MODE
   ======================================= */

let firebaseOnline = false;
let nodeOnline = false;

// Firebase connectivity
connectedRef.on("value", snap => {
  firebaseOnline = snap.val() === true;
  evaluateConnectionMode();
});

// NodeMCU connectivity (lastSeen + 10 sec)
database.ref("deviceStatus/nodemcu/lastSeen").on("value", snap => {
  const ts = Number(snap.val());
  if (!ts) {
    nodeOnline = false;
    evaluateConnectionMode();
    return;
  }

  const diff = (Date.now() / 1000) - ts;
  nodeOnline = diff <= 10;

  evaluateConnectionMode();
});

// FINAL decision maker
function evaluateConnectionMode() {
  const shouldDemo = !(firebaseOnline && nodeOnline);

  if (shouldDemo) {
    connectionStatusEl.textContent = 
      firebaseOnline ? "Disconnected • Demo Mode" : "Firebase Offline • Demo Mode";
    connectionStatusEl.className = "badge err";

    if (firebaseConnected !== false) {
      firebaseConnected = false;
      console.warn("→ Switching to DEMO MODE");
      startDummyData();
    }
  } else {
    connectionStatusEl.textContent = "Connected";
    connectionStatusEl.className = "badge ok";

    if (firebaseConnected !== true) {
      firebaseConnected = true;
      console.warn("→ Switching to LIVE MODE");
      stopDummyData();
    }
  }
}


/* ------------------------
   Pump Controls
   ------------------------ */
const pumpRef = database.ref(PATHS.pumpState);

database.ref(PATHS.pumpState).on("value", snap => {
  const manual = String(snap.val() || "off").toLowerCase();

  // Manual button follows manual Firebase state ONLY
  pumpToggleBtn.checked = manual === "on";
});


pumpToggleBtn.addEventListener("change", () => {
  if (!firebaseConnected) return;

  const newState = pumpToggleBtn.checked ? "on" : "off";

  // Manual control writes only to pump/state
  database.ref(PATHS.pumpState).set(newState);
});




/* ------------------------
   Soil Moisture
   ------------------------ */
database.ref(PATHS.soilMoist).on("value", snap => {
  console.warn("SOIL EVENT TRIGGERED → SNAP:", snap.val());

  const raw = Number(snap.val());
  if (isNaN(raw)) return;

  // Convert raw 0–1100 to % moisture
  const moistPercent = Math.max(0, Math.min(100, 100 - (raw / 1070) * 100));

  safeSet(soilMoistEl, moistPercent.toFixed(1) + "%");
  soilGaugeValue.textContent = moistPercent.toFixed(1);
  setGauge(soilGauge, moistPercent);
  soilUpdatedEl.textContent = new Date().toLocaleString();

  if (moistPercent < 30) {
    soilStatusEl.textContent = "Dry";
    soilStatusEl.className = "badge err";
  } else if (moistPercent < 60) {
    soilStatusEl.textContent = "Moist";
    soilStatusEl.className = "badge warn";
  } else {
    soilStatusEl.textContent = "Wet";
    soilStatusEl.className = "badge ok";
  }
});



/* PUMP STATUS LISTENER */
database.ref(PATHS.pumpStatus).on("value", snap => {
  let status = String(snap.val() || "off").toLowerCase();
  const isOn = status === "on";

  // Update UI showing REAL pump status
  pumpStateText.textContent = isOn ? "ON" : "OFF";
  pumpBadge.textContent = isOn ? "ON" : "OFF";
  pumpBadge.className = isOn ? "badge ok" : "badge err";
  pumpUpdated.textContent = new Date().toLocaleString();

  // ❗ Do NOT touch manual toggle here
});



/* ------------------------
   Water Level (Analog 200 → 900 → %)
   ------------------------ */
database.ref("water/value").on("value", snap => {
  const raw = Number(snap.val());
  if (isNaN(raw)) return;

  const MIN_WATER = 200;  // empty
  const MAX_WATER = 900;  // full

  let pct;

  if (raw <= MIN_WATER) pct = 0;
  else if (raw >= MAX_WATER) pct = 100;
  else pct = ((raw - MIN_WATER) / (MAX_WATER - MIN_WATER)) * 100;

  pct = Math.max(0, Math.min(100, pct));

  // Show percentage ***
  safeSet(waterValueEl, pct.toFixed(1) + "%");

  // Wave
  waterWaveEl.style.height = pct + "%";

  // Status
  let status = "";
  let cls = "";

  if (pct >= 70){ status="HIGH"; cls="badge ok"; }
  else if (pct >= 30){ status="MEDIUM"; cls="badge warn"; }
  else{ status="LOW"; cls="badge err"; }

  waterStatusEl.textContent = status;
  waterStatusEl.className = cls;

  waterUpdatedEl.textContent = new Date().toLocaleString();
});



/* ------------------------
   DHT11 Temperature
   ------------------------ */
database.ref(PATHS.dhtTemp).on("value", snap=>{
  const t = Number(snap.val());
  if (isNaN(t)) return;

  safeSet(tempValueEl, t.toFixed(1)+" °C");
  tempUpdatedEl.textContent = new Date().toLocaleString();

  // update gauge arc
  setGauge(tempGauge, (t/60)*100);

  // update gauge text (FIX)
  tempGaugeValue.textContent = t.toFixed(1);

  tempBadge.textContent = "OK";
  tempBadge.className = "badge ok";
});

/* ------------------------
   DHT Humidity
   ------------------------ */
database.ref(PATHS.dhtHumidity).on("value", snap=>{
  const h = Number(snap.val());
  if (isNaN(h)) return;

  safeSet(humValueEl, h.toFixed(1)+"%");
  humUpdatedEl.textContent = new Date().toLocaleString();

  // update gauge arc
  setGauge(humGauge, h);

  // update gauge text (FIX)
  humGaugeValue.textContent = h.toFixed(1);

  humBadge.textContent = "OK";
  humBadge.className = "badge ok";
});


/* ------------------------
   SOLAR VOLTAGE (Merged: Sunlight Status + Graph)
   ------------------------ */
database.ref("solar/voltage").on("value", snap => {
  const v = Number(snap.val());
  if (isNaN(v)) return;

  // 1) Show voltage value
  safeSet(voltageValueEl, v.toFixed(2) + " V");
  voltageUpdatedEl.textContent = new Date().toLocaleString();

  // 2) Determine sunlight or no sunlight
  const sunlight = v >= 3.0;   // ← YOU CAN ADJUST THIS THRESHOLD

  voltageBadge.textContent = sunlight ? "Good" : "Low";
  voltageBadge.className = sunlight ? "badge ok" : "badge warn";

  // 3) Add to graph buffer
  voltageBuffer.push({ v });
  if (voltageBuffer.length > MAX_POINTS) voltageBuffer.shift();

  voltagePointsCountEl.textContent = voltageBuffer.length;

  // 4) Redraw the graph
  drawVoltageGraph();
});


/* ------------------------
   LDR ANALOG (0–1024 → %)
   ------------------------ */
database.ref(PATHS.ldr).on("value", snap => {
  const raw = Number(snap.val());
  if (isNaN(raw)) return;

  // Convert raw 0–1024 to brightness %
  let pct = Math.max(0, Math.min(100, (raw / 1024) * 100));

  // Show percentage
  safeSet(ldrValueEl, pct.toFixed(1) + "%");
  ldrUpdatedEl.textContent = new Date().toLocaleString();

  // Light bar width
  ldrFillEl.style.width = pct + "%";

  // Status text
  if (pct > 70) {
    ldrStatusEl.textContent = "Bright";
    ldrStatusEl.className = "badge ok";
  }
  else if (pct > 30) {
    ldrStatusEl.textContent = "Medium";
    ldrStatusEl.className = "badge warn";
  }
  else {
    ldrStatusEl.textContent = "Dark";
    ldrStatusEl.className = "badge err";
  }
});


/* ------------------------
   NODEMCU ONLINE/OFFLINE STATUS + LAST SEEN
   ------------------------ */

const deviceStateRef = database.ref("deviceStatus/nodemcu/state");
const deviceLastSeenRef = database.ref("deviceStatus/nodemcu/lastSeen");

/* ============================
   NODEMCU ONLINE/OFFLINE STATUS
   ============================ */

const nodeStateBadge = document.getElementById("nodeStateBadge");
const nodeLastSeen = document.getElementById("nodeLastSeen");

let browserConnectedFlag = true; // from onDisconnect()

// Watch browser online/offline helper flag
database.ref("deviceStatus/nodemcu/connected").on("value", snap => {
    browserConnectedFlag = !!snap.val();
});

// Watch the ESP lastSeen (UNIX timestamp)
database.ref("deviceStatus/nodemcu/lastSeen").on("value", snap => {
    const ts = Number(snap.val());
    if (!ts || isNaN(ts)) return;

    const now = Math.floor(Date.now() / 1000);
    const diff = now - ts;

    // 10 sec threshold
    const isOnline = diff <= 10 && browserConnectedFlag;

    // Update UI
    nodeStateBadge.textContent = isOnline ? "ONLINE" : "OFFLINE";
    nodeStateBadge.className = isOnline ? "badge ok" : "badge err";

    nodeLastSeen.textContent = "Last Seen: " + new Date(ts * 1000).toLocaleString();

    console.log("DEBUG:", { ts, diff, browserConnectedFlag, isOnline });
});




/* ------------------------
   Initial Setup
   ------------------------ */
updatePumpUI(false);
startDummyData();
resizeVoltageCanvas();

window.addEventListener("beforeunload", ()=>{
  stopDummyData();
});
