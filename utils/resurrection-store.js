const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'resurrection-state.json');

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 默认复活数据
const DEFAULT_STATE = {
  revived: 983366550629,
  autoResurrectEnabled: true,
  autoResurrectTotal: 0,
  lastSaved: new Date().toISOString(),
  lastSynced: null,
  version: '1.0',
};

// 读取复活数据
function getResurrectionState() {
  try {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return { ...DEFAULT_STATE, ...data };
    }
  } catch (error) {
    logger.error('读取复活数据失败', { error: error.message });
  }
  return { ...DEFAULT_STATE };
}

// 保存复活数据
function saveResurrectionState(state) {
  try {
    ensureDataDir();
    const dataToSave = {
      ...state,
      lastSaved: new Date().toISOString(),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    logger.info('复活数据已保存到服务器', { revived: dataToSave.revived });
    return dataToSave;
  } catch (error) {
    logger.error('保存复活数据失败', { error: error.message });
    throw error;
  }
}

// 更新复活数据（部分更新）
function updateResurrectionState(updates) {
  const current = getResurrectionState();
  const updated = { ...current, ...updates };
  return saveResurrectionState(updated);
}

// 重置复活数据
function resetResurrectionState() {
  return saveResurrectionState({ ...DEFAULT_STATE });
}

module.exports = {
  getResurrectionState,
  saveResurrectionState,
  updateResurrectionState,
  resetResurrectionState,
};
