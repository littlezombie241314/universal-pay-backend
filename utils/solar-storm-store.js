const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'solar-storm-state.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 默认太阳风暴状态
const defaultState = {
  // 太阳风暴监测状态
  solarStorm: {
    level: 'G0',
    levelText: '平静',
    solarWindSpeed: 350,
    kpIndex: 2,
    disturbance: '微弱',
    protectionActive: false,
    eventCount: 0
  },
  // 耀斑与CME专项状态
  flareCME: {
    flareLevel: 'A',
    flareSubLevel: 0,
    flareText: '无耀斑',
    xrayFlux: 1.2e-8,
    cmeSpeed: 0,
    cmeETA: null,
    cmeDirection: 'none',
    flareActive: false,
    cmeActive: false
  },
  // 事件日志（最近50条）
  eventLogs: [],
  lastUpdate: Date.now()
};

// 读取太阳风暴状态
function getSolarStormState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      // 深度合并默认值和保存的值
      return {
        ...defaultState,
        ...parsed,
        solarStorm: { ...defaultState.solarStorm, ...(parsed.solarStorm || {}) },
        flareCME: { ...defaultState.flareCME, ...(parsed.flareCME || {}) },
        eventLogs: parsed.eventLogs || []
      };
    }
  } catch (e) {
    console.error('读取太阳风暴状态失败:', e);
  }
  return { ...defaultState, solarStorm: { ...defaultState.solarStorm }, flareCME: { ...defaultState.flareCME } };
}

// 保存太阳风暴状态（全量覆盖）
function saveSolarStormState(state) {
  try {
    const currentState = getSolarStormState();
    const newState = {
      ...currentState,
      ...state,
      lastUpdate: Date.now()
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf-8');
    return newState;
  } catch (e) {
    console.error('保存太阳风暴状态失败:', e);
    return null;
  }
}

// 更新太阳风暴状态（部分更新）
function updateSolarStormState(updates) {
  try {
    const currentState = getSolarStormState();
    const newState = {
      ...currentState,
      ...updates,
      lastUpdate: Date.now()
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf-8');
    return newState;
  } catch (e) {
    console.error('更新太阳风暴状态失败:', e);
    return null;
  }
}

// 添加事件日志
function addEventLog(log) {
  try {
    const currentState = getSolarStormState();
    const newLogs = [log, ...(currentState.eventLogs || [])].slice(0, 50);
    const newState = {
      ...currentState,
      eventLogs: newLogs,
      lastUpdate: Date.now()
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf-8');
    return newState;
  } catch (e) {
    console.error('添加事件日志失败:', e);
    return null;
  }
}

// 重置太阳风暴状态
function resetSolarStormState() {
  try {
    const newState = {
      ...defaultState,
      solarStorm: { ...defaultState.solarStorm },
      flareCME: { ...defaultState.flareCME },
      lastUpdate: Date.now()
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf-8');
    return newState;
  } catch (e) {
    console.error('重置太阳风暴状态失败:', e);
    return null;
  }
}

module.exports = {
  getSolarStormState,
  saveSolarStormState,
  updateSolarStormState,
  addEventLog,
  resetSolarStormState
};
