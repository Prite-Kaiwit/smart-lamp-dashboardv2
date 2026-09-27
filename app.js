/**
 * LumiTrack IoT Dashboard - Real-time Hardware Synchronized Logic
 * Synchronized with ESP32, MongoDB Atlas & Backend API
 */

let state = {
  temperature: null,
  humidity: null,
  hasPeople: null,
  lightRaw: null,
  lightLevel: null,
  lightStatus: null,
  lampStatus: null,
  mode: null,
  brightness: null,
  autoScroll: true,
  isLiveArduino: true,
  theme: 'dark',
  mongoConnected: false
};

const BACKEND_URL = (window.APP_CONFIG?.BACKEND_URL || '').replace(/\/$/, '');

function apiUrl(path) {
  return `${BACKEND_URL}${path}`;
}

let telemetryHistory = [];
let terminalLines = [];
let telemetryChartInstance = null;
let activeChartTab = 'all';
let syncTimer = null;
let isHistoryLoaded = false;

// Web Serial API states (Direct USB connection)
let serialPort = null;
let serialReader = null;
let isSerialConnected = false;

function generateObjectId() {
  const timestamp = Math.floor(new Date().getTime() / 1000).toString(16);
  const randomChars = 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, () => (Math.random() * 16 | 0).toString(16));
  return (timestamp + randomChars).toLowerCase();
}

function getTimestamp() {
  const d = new Date();
  const pad = (n, width = 2) => String(n).padStart(width, '0');
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  return `${hh}:${mm}:${ss}.${ms}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const simBtnText = document.getElementById('simBtnText');
  if (simBtnText) simBtnText.textContent = '🟢 ดึงข้อมูลสดจากระบบ';
  const simDot = document.getElementById('simDot');
  if (simDot) simDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-ping';

  initChart();
  updateMongoViews();

  // Load initial historical records from MongoDB Atlas
  fetchInitialHistory();

  // Start polling real sensor data
  fetchLiveHardwareData();
  syncTimer = setInterval(fetchLiveHardwareData, 2000);
});

// Fetch initial historical records from Backend & MongoDB Atlas
async function fetchInitialHistory() {
  try {
    const res = await fetch(apiUrl('/api/sensors/history?limit=15'), { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        telemetryHistory = json.data.reverse().map(item => {
          const d = item.createdAt ? new Date(item.createdAt) : new Date();
          const pad = (n) => String(n).padStart(2, '0');
          const timeLabel = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          return {
            _id: item._id ? item._id.toString() : generateObjectId(),
            timestamp: timeLabel,
            fullTime: d.toISOString(),
            temperature: item.temperature,
            humidity: item.humidity,
            peopleDetected: Boolean(item.peopleDetected),
            lightRaw: item.lightRaw,
            lightLevel: item.lightLevel,
            lightStatus: item.lightStatus,
            lampStatus: item.lampStatus,
            mode: item.mode
          };
        });
        isHistoryLoaded = true;
        updateChartData();
        updateMongoViews();
      }
    }
  } catch (err) {
    // Backend offline / static mode fallback
  }
}

// Fetch live hardware data from the backend
async function fetchLiveHardwareData() {
  try {
    const res = await fetch(apiUrl('/api/sensors/latest'), { cache: 'no-store' });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);

    const result = await res.json();
    const data = result.data;
    console.log(data);
    updateDashboard(data);
  } catch (err) {
    console.error('Error fetching live data:', err);
  }
}

function updateDashboard(data) {
  if (data) {
      state.temperature = data.temperature;
      state.humidity = data.humidity;
      state.hasPeople = data.peopleDetected;
      state.lightRaw = data.lightRaw;
      state.lightLevel = data.lightLevel;
      state.lightStatus = data.lightStatus;
      state.lampStatus = data.lampStatus;
      state.mode = data.mode;
      state.mongoConnected = true;

      // Update MongoDB connection status badge
      const mongoStatus = document.getElementById('mongoStatusText');
      if (mongoStatus) {
        if (state.mongoConnected) {
          mongoStatus.textContent = 'เชื่อมต่อ MongoDB Atlas สำเร็จ';
          mongoStatus.className = 'text-emerald-400 font-bold';
        } else {
          mongoStatus.textContent = 'ESP32 ออนไลน์ & พร้อมบันทึก';
          mongoStatus.className = 'text-amber-300 font-medium';
        }
      }

      // Add to telemetry history
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timeLabel = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      telemetryHistory.push({
        _id: generateObjectId(),
        timestamp: timeLabel,
        fullTime: now.toISOString(),
        temperature: state.temperature,
        humidity: state.humidity,
        peopleDetected: state.hasPeople,
        lightRaw: state.lightRaw,
        lightLevel: state.lightLevel,
        lightStatus: state.lightStatus,
        lampStatus: state.lampStatus,
        mode: state.mode
      });

      if (telemetryHistory.length > 20) {
        telemetryHistory.shift();
      }

      // Append log line
      logCurrentStateToTerminal();

      // Refresh UI
      updateUI();
      updateChartData();
      updateMongoViews();
  }
}

// Update all UI elements
function updateUI() {
  const isLampOn = state.lampStatus === 'ON';

  if (isLampOn) {
    document.body.classList.remove('lamp-off');
    document.body.classList.add('lamp-on');
    const toggle = document.getElementById('lampToggleSwitch');
    if (toggle) toggle.checked = true;
    const heroLampStatus = document.getElementById('heroLampStatus');
    if (heroLampStatus) {
      heroLampStatus.textContent = 'ON (เปิด)';
      heroLampStatus.className = 'text-lg md:text-xl font-bold text-emerald-400 font-mono';
    }
    const badge = document.getElementById('lampBadgeStatus');
    if (badge) {
      badge.textContent = 'กำลังสว่าง (ON)';
      badge.className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-600/40';
    }
    const powerText = document.getElementById('lampPowerText');
    if (powerText) powerText.textContent = 'หลอดไฟเปิดทำงาน (ESP32 Relay: HIGH)';
    const iconWrap = document.getElementById('heroLampIconWrap');
    if (iconWrap) iconWrap.className = 'p-3 bg-emerald-950/60 border border-emerald-600/30 rounded-xl text-emerald-400 shadow-warm-glow';
  } else {
    document.body.classList.remove('lamp-on');
    document.body.classList.add('lamp-off');
    const toggle = document.getElementById('lampToggleSwitch');
    if (toggle) toggle.checked = false;
    const heroLampStatus = document.getElementById('heroLampStatus');
    if (heroLampStatus) {
      heroLampStatus.textContent = 'OFF (ปิด)';
      heroLampStatus.className = 'text-lg md:text-xl font-bold text-stone-500 font-mono';
    }
    const badge = document.getElementById('lampBadgeStatus');
    if (badge) {
      badge.textContent = 'ปิดการทำงาน (OFF)';
      badge.className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-800 text-stone-400 border border-stone-700';
    }
    const powerText = document.getElementById('lampPowerText');
    if (powerText) powerText.textContent = 'หลอดไฟปิดการทำงาน (ESP32 Relay: LOW)';
    const iconWrap = document.getElementById('heroLampIconWrap');
    if (iconWrap) iconWrap.className = 'p-3 bg-stone-900 border border-stone-800 rounded-xl text-stone-500';
  }

  // Hero Mode
  const heroModeBadge = document.getElementById('heroModeBadge');
  if (heroModeBadge) heroModeBadge.textContent = state.mode;
  updateModeButtonsUI();

  // Temperature
  const valTemp = document.getElementById('valTemperature');
  if (valTemp) valTemp.textContent = state.temperature == null ? '--' : state.temperature.toFixed(1);
  const tempPercent = state.temperature == null ? 0 : Math.min(100, Math.max(0, ((state.temperature - 15) / (45 - 15)) * 100));
  const barTemp = document.getElementById('barTemp');
  if (barTemp) barTemp.style.width = `${tempPercent}%`;

  // Humidity
  const valHum = document.getElementById('valHumidity');
  if (valHum) valHum.textContent = state.humidity == null ? '--' : state.humidity.toFixed(1);
  const barHum = document.getElementById('barHumidity');
  if (barHum) barHum.style.width = `${state.humidity == null ? 0 : state.humidity}%`;

  // Light
  const valLightLvl = document.getElementById('valLightLevel');
  if (valLightLvl) valLightLvl.textContent = state.lightLevel ?? '--';
  const valLightRaw = document.getElementById('valLightRaw');
  if (valLightRaw) valLightRaw.textContent = state.lightRaw ?? '--';
  const barLight = document.getElementById('barLightLevel');
  if (barLight) barLight.style.width = `${state.lightLevel ?? 0}%`;
  const lightBadge = document.getElementById('lightBadgeStatus');
  if (lightBadge) lightBadge.textContent = state.lightStatus ?? '--';
  const heroLightStatus = document.getElementById('heroLightStatus');
  if (heroLightStatus) heroLightStatus.textContent = state.lightStatus ?? '--';
  const heroLightLevel = document.getElementById('heroLightLevel');
  if (heroLightLevel) heroLightLevel.textContent = `ระดับแสง ${state.lightLevel ?? '--'} / 100 (ดิบ: ${state.lightRaw ?? '--'})`;

  // Proximity / Human Detection (No distance)
  const heroPeopleStatus = document.getElementById('heroPeopleStatus');
  const heroPeopleDist = document.getElementById('heroPeopleDist');
  const peopleBadge = document.getElementById('peopleBadge');
  const valProximityStatus = document.getElementById('valProximityStatus');
  const distDescription = document.getElementById('distDescription');
  const radarRing3 = document.getElementById('radarRing3');
  const simPeopleStatus = document.getElementById('simPeopleStatus');
  const simPeopleBtnYes = document.getElementById('simPeopleBtnYes');
  const simPeopleBtnNo = document.getElementById('simPeopleBtnNo');

  if (state.hasPeople) {
    if (heroPeopleStatus) {
      heroPeopleStatus.textContent = 'YES (มีคน)';
      heroPeopleStatus.className = 'text-lg md:text-xl font-bold text-orange-400 font-mono';
    }
    if (heroPeopleDist) {
      heroPeopleDist.innerHTML = 'สถานะ: <strong class="text-emerald-400">ตรวจพบคน (DETECTED)</strong>';
    }
    if (peopleBadge) {
      peopleBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> YES (ตรวจพบคน)';
      peopleBadge.className = 'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-600/40';
    }
    if (valProximityStatus) {
      valProximityStatus.textContent = 'DETECTED';
      valProximityStatus.className = 'text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono';
    }
    if (distDescription) {
      distDescription.textContent = 'เซ็นเซอร์ Proximity ยืนยันพบคนในพื้นที่';
    }
    if (radarRing3) radarRing3.classList.add('animate-ping');

    if (simPeopleStatus) {
      simPeopleStatus.textContent = 'DETECTED';
      simPeopleStatus.className = 'font-mono text-emerald-400 font-bold';
    }
    if (simPeopleBtnYes) {
      simPeopleBtnYes.className = 'flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-600/40 shadow-sm flex items-center justify-center gap-1.5';
    }
    if (simPeopleBtnNo) {
      simPeopleBtnNo.className = 'flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold bg-stone-900 text-stone-400 border border-stone-800 hover:bg-stone-800 transition flex items-center justify-center gap-1.5';
    }
  } else {
    if (heroPeopleStatus) {
      heroPeopleStatus.textContent = 'NO (ไม่มีคน)';
      heroPeopleStatus.className = 'text-lg md:text-xl font-bold text-stone-500 font-mono';
    }
    if (heroPeopleDist) {
      heroPeopleDist.innerHTML = 'สถานะ: <strong class="text-stone-400">ไม่พบคน (CLEAR)</strong>';
    }
    if (peopleBadge) {
      peopleBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-stone-500"></span> NO (ไม่พบคน)';
      peopleBadge.className = 'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-800 text-stone-400 border border-stone-700';
    }
    if (valProximityStatus) {
      valProximityStatus.textContent = 'CLEAR';
      valProximityStatus.className = 'text-2xl sm:text-3xl font-extrabold text-stone-500 font-mono';
    }
    if (distDescription) {
      distDescription.textContent = 'ไม่มีบุคคลอยู่ในพื้นที่ตรวจจับ';
    }
    if (radarRing3) radarRing3.classList.remove('animate-ping');

    if (simPeopleStatus) {
      simPeopleStatus.textContent = 'CLEAR';
      simPeopleStatus.className = 'font-mono text-stone-500 font-bold';
    }
    if (simPeopleBtnYes) {
      simPeopleBtnYes.className = 'flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold bg-stone-900 text-stone-400 border border-stone-800 hover:bg-stone-800 transition flex items-center justify-center gap-1.5';
    }
    if (simPeopleBtnNo) {
      simPeopleBtnNo.className = 'flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold bg-stone-800 text-stone-300 border border-stone-600 shadow-sm flex items-center justify-center gap-1.5';
    }
  }

  // Header sync time
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const syncElem = document.getElementById('headerSyncTime');
  if (syncElem) {
    syncElem.textContent = `ข้อมูลจริง ESP32: ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
}

function updateModeButtonsUI() {
  const modes = ['FORCE ON', 'AUTO', 'FORCE OFF'];
  const modeMap = {
    'FORCE ON': 'btnModeForceOn',
    'AUTO': 'btnModeAuto',
    'FORCE OFF': 'btnModeForceOff'
  };

  modes.forEach(m => {
    const btn = document.getElementById(modeMap[m]);
    if (!btn) return;
    if (state.mode === m) {
      btn.className = 'py-2.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 transition border bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm';
    } else {
      btn.className = 'py-2.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 transition border border-[#3A2F25] bg-[#171412] hover:bg-[#261F18] text-stone-400';
    }
  });
}

// Send control commands to the backend
async function setMode(newMode) {
  state.mode = newMode;
  updateUI();

  try {
    // Send to local backend
    fetch(apiUrl('/api/control/mode'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode })
    });
    alertBannerShow(`ส่งคำสั่งเปลี่ยนโหมดไปยังระบบสำเร็จ: ${newMode}`);
  } catch (e) {
    console.error(e);
  }
}

async function handleLampSwitch(isChecked) {
  const newStatus = isChecked ? 'ON' : 'OFF';
  state.lampStatus = newStatus;
  state.mode = isChecked ? 'FORCE ON' : 'FORCE OFF';
  updateUI();

  try {
    fetch(apiUrl('/api/control/lamp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    alertBannerShow(`ส่งคำสั่งควบคุมไฟไปยังระบบสำเร็จ: ${newStatus}`);
  } catch (e) {
    console.error(e);
  }
}

function toggleLampManual() {
  handleLampSwitch(state.lampStatus !== 'ON');
}

function changeBrightness(value) {
  state.brightness = parseInt(value, 10);
  const elem = document.getElementById('brightnessValue');
  if (elem) elem.textContent = `${state.brightness}%`;
  updateUI();
}

// Log formatting matching Serial Monitor format (No distance)
function logCurrentStateToTerminal() {
  const ts = getTimestamp();
  const lines = [
    `${ts} -> ------------------------------------`,
    `${ts} -> Temperature : ${state.temperature.toFixed(1)} C`,
    `${ts} -> Humidity    : ${state.humidity.toFixed(1)} %`,
    `${ts} -> People      : ${state.hasPeople ? 'YES' : 'NO'}`,
    `${ts} -> Light Raw   : ${state.lightRaw}`,
    `${ts} -> Light Level : ${state.lightLevel} / 100`,
    `${ts} -> Light Status: ${state.lightStatus}`,
    `${ts} -> Lamp Status : ${state.lampStatus}`,
    `${ts} -> Mode        : ${state.mode}`
  ];

  terminalLines.push(...lines);
  if (terminalLines.length > 150) {
    terminalLines = terminalLines.slice(terminalLines.length - 150);
  }

  renderTerminalLogs();
}

function renderTerminalLogs() {
  const container = document.getElementById('terminalLogs');
  if (!container) return;

  container.innerHTML = terminalLines.map(line => {
    let colorClass = 'text-stone-300';
    if (line.includes('Temperature')) colorClass = 'text-amber-400 font-semibold';
    else if (line.includes('Humidity')) colorClass = 'text-amber-200';
    else if (line.includes('People')) colorClass = 'text-orange-400 font-semibold';
    else if (line.includes('Light Raw') || line.includes('Light Level')) colorClass = 'text-yellow-300';
    else if (line.includes('Lamp Status : ON')) colorClass = 'text-emerald-400 font-bold';
    else if (line.includes('Lamp Status : OFF')) colorClass = 'text-rose-400';
    else if (line.includes('Mode')) colorClass = 'text-amber-300 font-bold';
    else if (line.includes('----')) colorClass = 'text-stone-600';

    return `<div class="${colorClass}">${escapeHtml(line)}</div>`;
  }).join('');

  const countElem = document.getElementById('logCount');
  if (countElem) countElem.textContent = terminalLines.length;

  if (state.autoScroll) {
    container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clearTerminal() {
  terminalLines = [];
  renderTerminalLogs();
}

function copyTerminal() {
  const text = terminalLines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    alertBannerShow('คัดลอกข้อความ Logs ลงในคลิปบอร์ดเรียบร้อยแล้ว');
  });
}

function exportLogsTxt() {
  const text = terminalLines.join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lumitrack_serial_${Date.now()}.txt`;
  a.click();
}

function toggleAutoScroll() {
  state.autoScroll = !state.autoScroll;
  const btn = document.getElementById('btnAutoScroll');
  if (state.autoScroll) {
    btn.className = 'p-1.5 rounded bg-amber-950/70 text-amber-400 border border-amber-700/50 hover:bg-amber-900 transition';
  } else {
    btn.className = 'p-1.5 rounded bg-stone-900 text-stone-500 border border-stone-800 hover:text-white transition';
  }
}

function toggleSimulation() {
  fetchLiveHardwareData();
  alertBannerShow('ดึงข้อมูลล่าสุดจากเซ็นเซอร์เรียบร้อยแล้ว');
}

// Chart.js without distance dataset
function initChart() {
  const canvas = document.getElementById('telemetryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  telemetryChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'อุณหภูมิ (°C)',
          data: [],
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 2.5,
          pointBackgroundColor: '#F59E0B',
          yAxisID: 'y'
        },
        {
          label: 'ความชื้น (%)',
          data: [],
          borderColor: '#38BDF8',
          backgroundColor: 'rgba(56, 189, 248, 0.05)',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
          pointBackgroundColor: '#38BDF8',
          yAxisID: 'y'
        },
        {
          label: 'ระดับแสง (%)',
          data: [],
          borderColor: '#FB923C',
          backgroundColor: 'rgba(251, 146, 60, 0.05)',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
          pointBackgroundColor: '#FB923C',
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#261F1A', drawBorder: false }, ticks: { color: '#8A7B6E', font: { family: 'JetBrains Mono', size: 10 } } },
        y: { grid: { color: '#261F1A', drawBorder: false }, ticks: { color: '#8A7B6E', font: { family: 'JetBrains Mono', size: 10 } }, min: 0, max: 100 }
      }
    }
  });
}

function updateChartData() {
  if (!telemetryChartInstance) return;

  telemetryChartInstance.data.labels = telemetryHistory.map(h => h.timestamp);
  telemetryChartInstance.data.datasets[0].data = telemetryHistory.map(h => h.temperature);
  telemetryChartInstance.data.datasets[1].data = telemetryHistory.map(h => h.humidity);
  telemetryChartInstance.data.datasets[2].data = telemetryHistory.map(h => h.lightLevel);

  telemetryChartInstance.update('none');
}

function switchChartTab(tab) {
  activeChartTab = tab;
  const tabs = ['all', 'tempHum', 'light'];
  const tabBtnMap = { all: 'tabBtnAll', tempHum: 'tabBtnTempHum', light: 'tabBtnLight' };

  tabs.forEach(t => {
    const btn = document.getElementById(tabBtnMap[t]);
    if (!btn) return;
    if (t === tab) btn.className = 'px-3 py-1.5 rounded-lg bg-amber-500 text-stone-950 font-semibold transition';
    else btn.className = 'px-3 py-1.5 rounded-lg text-stone-400 hover:text-white transition';
  });

  if (!telemetryChartInstance) return;
  const ds = telemetryChartInstance.data.datasets;
  if (tab === 'all') { ds[0].hidden = false; ds[1].hidden = false; ds[2].hidden = false; }
  else if (tab === 'tempHum') { ds[0].hidden = false; ds[1].hidden = false; ds[2].hidden = true; }
  else if (tab === 'light') { ds[0].hidden = true; ds[1].hidden = true; ds[2].hidden = false; }
  telemetryChartInstance.update();
}

function updateMongoViews() {
  const tbody = document.getElementById('mongoTableBody');
  if (!tbody) return;

  const recentItems = [...telemetryHistory].reverse().slice(0, 6);

  tbody.innerHTML = recentItems.map(item => `
    <tr class="hover:bg-[#201A15] transition">
      <td class="py-2.5 px-4 text-stone-400 font-mono">${(item._id || '').substring(0, 8)}...</td>
      <td class="py-2.5 px-4 text-amber-300">${item.timestamp}</td>
      <td class="py-2.5 px-4 text-orange-300 font-bold">${typeof item.temperature === 'number' ? item.temperature.toFixed(1) : item.temperature}</td>
      <td class="py-2.5 px-4 text-sky-300">${typeof item.humidity === 'number' ? item.humidity.toFixed(1) : item.humidity}</td>
      <td class="py-2.5 px-4 ${item.peopleDetected ? 'text-emerald-400 font-bold' : 'text-stone-500'}">${item.peopleDetected ? 'YES (ตรวจพบ)' : 'NO (ไม่พบ)'}</td>
      <td class="py-2.5 px-4 text-amber-400">${item.lightLevel}/100</td>
      <td class="py-2.5 px-4">${item.lightStatus}</td>
      <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded text-[10px] ${item.lampStatus === 'ON' ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/40' : 'bg-stone-800 text-stone-400'}">${item.lampStatus}</span></td>
      <td class="py-2.5 px-4 text-stone-300">${item.mode}</td>
    </tr>
  `).join('');

  const jsonDoc = {
    "_id": { "$oid": telemetryHistory[telemetryHistory.length - 1]?._id || generateObjectId() },
    "device_id": "ESP32-SmartClassRoom",
    "timestamp": new Date().toISOString(),
    "sensors": {
      "temperature_celsius": state.temperature,
      "humidity_percent": state.humidity,
      "people_detected": state.hasPeople,
      "light_raw_adc": state.lightRaw,
      "light_level_percent": state.lightLevel,
      "light_status": state.lightStatus
    },
    "controls": {
      "lamp_status": state.lampStatus,
      "mode": state.mode,
      "brightness_percent": state.brightness
    }
  };

  const jsonPre = document.getElementById('mongoJsonCode');
  if (jsonPre) jsonPre.textContent = JSON.stringify(jsonDoc, null, 2);
}

function updateSimValue() {
  fetchLiveHardwareData();
}

function resetToScreenshotValues() {
  fetchLiveHardwareData();
}

function toggleMongoView(view) {
  const tableView = document.getElementById('mongoTableView');
  const jsonView = document.getElementById('mongoJsonView');
  const btnTable = document.getElementById('btnViewTable');
  const btnJson = document.getElementById('btnViewJson');

  if (view === 'table') {
    tableView.classList.remove('hidden');
    jsonView.classList.add('hidden');
    btnTable.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white transition';
    btnJson.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#261F19] text-stone-400 hover:text-white transition';
  } else {
    tableView.classList.add('hidden');
    jsonView.classList.remove('hidden');
    btnTable.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#261F19] text-stone-400 hover:text-white transition';
    btnJson.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white transition';
  }
}

function openMongoModal() { document.getElementById('mongoModal').classList.remove('hidden'); }
function closeMongoModal() { document.getElementById('mongoModal').classList.add('hidden'); }

function toggleWarmTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  const themeIcon = document.getElementById('themeIcon');
  if (isLight) themeIcon.setAttribute('data-lucide', 'sun');
  else themeIcon.setAttribute('data-lucide', 'moon');
  lucide.createIcons();
}

function alertBannerShow(msg) {
  const banner = document.getElementById('alertBanner');
  const text = document.getElementById('alertBannerText');
  text.textContent = msg;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 4000);
}

function dismissAlert() { document.getElementById('alertBanner').classList.add('hidden'); }
function manualRefresh() {
  const icon = document.getElementById('refreshIcon');
  icon.classList.add('animate-spin');
  fetchLiveHardwareData();
  setTimeout(() => {
    icon.classList.remove('animate-spin');
    alertBannerShow('อัปเดตข้อมูลตรงจากระบบเรียบร้อยแล้ว');
  }, 500);
}

// ----------------------------------------------------
// Web Serial API (ต่อสาย USB ตรงจากคอม)
// ----------------------------------------------------
async function connectWebSerial() {
  if (!('serial' in navigator)) {
    alert('เบราว์เซอร์นี้ยังไม่รองรับ Web Serial API แนะนำให้ใช้ Google Chrome หรือ Microsoft Edge บนคอมพิวเตอร์ครับ');
    return;
  }

  const btn = document.getElementById('btnConnectSerial');
  const btnText = document.getElementById('serialBtnText');

  if (isSerialConnected) {
    try {
      if (serialReader) await serialReader.cancel();
      if (serialPort) await serialPort.close();
      isSerialConnected = false;
      if (btnText) btnText.textContent = 'ต่อสาย USB ตรง';
      if (btn) btn.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-600/50 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition shadow-sm';
      alertBannerShow('ตัดการเชื่อมต่อสาย USB แล้ว');
      if (!syncTimer) syncTimer = setInterval(fetchLiveHardwareData, 2000);
    } catch (e) {
      console.error(e);
    }
    return;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });
    isSerialConnected = true;

    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }

    if (btnText) btnText.textContent = '🔌 USB: อ่านค่าสด';
    if (btn) btn.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500 bg-emerald-950/80 text-emerald-300 transition shadow-sm';
    alertBannerShow('เชื่อมต่อพอร์ต Serial ของ ESP32 สำเร็จ! อ่านค่าจากสาย USB โดยตรง 100%');

    readSerialLoop();
  } catch (err) {
    console.error('Serial connection error:', err);
    if (err.name !== 'NotFoundError') {
      alert('ไม่สามารถเปิดพอร์ตได้: ' + err.message + '\n⚠️ สำคัญ: ให้ปิดหน้าต่าง Serial Monitor ในโปรแกรม Arduino IDE ก่อนกดปุ่มนี้ครับ');
    }
  }
}

async function readSerialLoop() {
  const textDecoder = new TextDecoderStream();
  const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
  serialReader = textDecoder.readable.getReader();

  let lineBuffer = '';

  try {
    while (true) {
      const { value, done } = await serialReader.read();
      if (done) break;
      if (value) {
        lineBuffer += value;
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            parseSerialLine(trimmed);
          }
        }
      }
    }
  } catch (err) {
    console.error('Serial read error:', err);
  } finally {
    try { serialReader.releaseLock(); } catch(e){}
  }
}

function parseSerialLine(line) {
  const ts = getTimestamp();
  terminalLines.push(`${ts} -> ${line}`);
  if (terminalLines.length > 150) terminalLines.shift();
  renderTerminalLogs();

  let stateChanged = false;

  if (line.includes('Temperature :')) {
    const match = line.match(/Temperature\s*:\s*([\d.]+)/i);
    if (match) { state.temperature = parseFloat(match[1]); stateChanged = true; }
  } else if (line.includes('Humidity :')) {
    const match = line.match(/Humidity\s*:\s*([\d.]+)/i);
    if (match) { state.humidity = parseFloat(match[1]); stateChanged = true; }
  } else if (line.includes('People :')) {
    state.hasPeople = line.includes('YES');
    stateChanged = true;
  } else if (line.includes('Light Raw :')) {
    const match = line.match(/Light Raw\s*:\s*(\d+)/i);
    if (match) { state.lightRaw = parseInt(match[1], 10); stateChanged = true; }
  } else if (line.includes('Light Level :')) {
    const match = line.match(/Light Level\s*:\s*(\d+)/i);
    if (match) { state.lightLevel = parseInt(match[1], 10); stateChanged = true; }
  } else if (line.includes('Light Status:')) {
    if (line.includes('DARK')) state.lightStatus = 'DARK (มืด)';
    else state.lightStatus = 'BRIGHT (สว่าง)';
    stateChanged = true;
  } else if (line.includes('Lamp Status :')) {
    state.lampStatus = line.includes('ON') ? 'ON' : 'OFF';
    stateChanged = true;
  } else if (line.includes('Mode :')) {
    if (line.includes('FORCE ON')) state.mode = 'FORCE ON';
    else if (line.includes('FORCE OFF')) state.mode = 'FORCE OFF';
    else if (line.includes('AUTO')) state.mode = 'AUTO';
    stateChanged = true;
  }

  if (stateChanged) {
    updateUI();
    updateChartData();

    // บันทึกลง MongoDB ผ่าน Backend ถ้าเปิดเซิร์ฟเวอร์อยู่
    try {
      fetch(apiUrl('/api/sensors/data'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temperature: state.temperature,
          humidity: state.humidity,
          peopleDetected: state.hasPeople,
          lightRaw: state.lightRaw,
          lightLevel: state.lightLevel,
          lightStatus: state.lightStatus,
          lampStatus: state.lampStatus,
          mode: state.mode
        })
      });
    } catch(e){}
  }
}
