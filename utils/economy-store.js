const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'economy-state.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 默认经济状态
const defaultState = {
  universeBalance: '9999999999999999999999',
  currentUser: '',
  internalAccounts: {},
  salaryState: null,
  debtState: null,
  balanceTarget: null,
  backendConfig: null,
  syncQueue: null,
  coveredBeings: 8741151817700,
  lastUpdate: Date.now()
};

// 读取经济状态
function getEconomyState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return { ...defaultState, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('读取经济状态失败:', e);
  }
  return { ...defaultState };
}

// 保存经济状态（全量覆盖）
function saveEconomyState(state) {
  try {
    const currentState = getEconomyState();
    const newState = { ...currentState, ...state, lastUpdate: Date.now() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf-8');
    return newState;
  } catch (e) {
    console.error('保存经济状态失败:', e);
    return null;
  }
}

// 更新经济状态（部分更新）
function updateEconomyState(updates) {
  try {
    const currentState = getEconomyState();
    const newState = { ...currentState, ...updates, lastUpdate: Date.now() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf-8');
    return newState;
  } catch (e) {
    console.error('更新经济状态失败:', e);
    return null;
  }
}

// 重置经济状态
function resetEconomyState() {
  try {
    const newState = { ...defaultState, lastUpdate: Date.now() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf-8');
    return newState;
  } catch (e) {
    console.error('重置经济状态失败:', e);
    return null;
  }
}

module.exports = {
  getEconomyState,
  saveEconomyState,
  updateEconomyState,
  resetEconomyState
};
