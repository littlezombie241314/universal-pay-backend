const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'internet-state.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultState = {
  // 骨干节点状态
  nodesOnline: 14,
  nodesTotal: 14,
  avgLatency: 23,
  globalBandwidth: '999 Tbps',
  dataTransferredToday: '∞ ZB',
  
  // 互联网协议统计
  ipv6Adoption: 75,
  httpsEncryption: 92,
  dnssecAdoption: 35,
  quicUsage: 40,
  
  // 网络安全状态
  firewallBlockRate: 99.9,
  trafficEncryptionRate: 92,
  attacksBlockedToday: 1247,
  securityNodesOnline: '14/14',
  
  // DNS查询记录
  dnsQueries: [],
  
  // 节点列表
  nodes: [
    { id: 1, name: '北京骨干节点', location: '北京', status: 'online', latency: 12, bandwidth: '10 Tbps' },
    { id: 2, name: '上海骨干节点', location: '上海', status: 'online', latency: 15, bandwidth: '10 Tbps' },
    { id: 3, name: '广州骨干节点', location: '广州', status: 'online', latency: 18, bandwidth: '8 Tbps' },
    { id: 4, name: '深圳骨干节点', location: '深圳', status: 'online', latency: 17, bandwidth: '8 Tbps' },
    { id: 5, name: '东京骨干节点', location: '东京', status: 'online', latency: 25, bandwidth: '6 Tbps' },
    { id: 6, name: '新加坡骨干节点', location: '新加坡', status: 'online', latency: 28, bandwidth: '6 Tbps' },
    { id: 7, name: '法兰克福骨干节点', location: '法兰克福', status: 'online', latency: 45, bandwidth: '8 Tbps' },
    { id: 8, name: '伦敦骨干节点', location: '伦敦', status: 'online', latency: 48, bandwidth: '8 Tbps' },
    { id: 9, name: '纽约骨干节点', location: '纽约', status: 'online', latency: 55, bandwidth: '10 Tbps' },
    { id: 10, name: '洛杉矶骨干节点', location: '洛杉矶', status: 'online', latency: 52, bandwidth: '10 Tbps' },
    { id: 11, name: '悉尼骨干节点', location: '悉尼', status: 'online', latency: 65, bandwidth: '4 Tbps' },
    { id: 12, name: '迪拜骨干节点', location: '迪拜', status: 'online', latency: 35, bandwidth: '4 Tbps' },
    { id: 13, name: '莫斯科骨干节点', location: '莫斯科', status: 'online', latency: 38, bandwidth: '5 Tbps' },
    { id: 14, name: '圣保罗骨干节点', location: '圣保罗', status: 'online', latency: 70, bandwidth: '3 Tbps' }
  ],
  
  lastUpdate: Date.now()
};

function getInternetState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return { ...defaultState, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('读取互联网状态失败:', e);
  }
  return { ...defaultState };
}

function saveInternetState(state) {
  try {
    const currentState = getInternetState();
    const newState = { ...currentState, ...state, lastUpdate: Date.now() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf-8');
    return newState;
  } catch (e) {
    console.error('保存互联网状态失败:', e);
    return null;
  }
}

function updateInternetState(updates) {
  try {
    const currentState = getInternetState();
    const newState = { ...currentState, ...updates, lastUpdate: Date.now() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf-8');
    return newState;
  } catch (e) {
    console.error('更新互联网状态失败:', e);
    return null;
  }
}

function resetInternetState() {
  try {
    const newState = { ...defaultState };
    fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf-8');
    return newState;
  } catch (e) {
    console.error('重置互联网状态失败:', e);
    return null;
  }
}

// 添加DNS查询记录
function addDnsQuery(domain, records) {
  try {
    const state = getInternetState();
    const query = {
      domain,
      records,
      timestamp: Date.now()
    };
    state.dnsQueries.unshift(query);
    if (state.dnsQueries.length > 100) {
      state.dnsQueries = state.dnsQueries.slice(0, 100);
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
    return query;
  } catch (e) {
    console.error('添加DNS查询记录失败:', e);
    return null;
  }
}

module.exports = {
  getInternetState,
  saveInternetState,
  updateInternetState,
  resetInternetState,
  addDnsQuery
};
