/**
 * 全宇宙恒等系统 - 云端服务器
 * 模式A：远程控制
 * 职责：业务逻辑、API下发、日志记录、界面展示、网关管理
 * 不能直接操作硬件，所有硬件操作通过边缘网关执行
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ========== 数据持久化层 ==========
class DataStore {
  constructor() {
    this.filePath = path.join(DATA_DIR, 'system-state.json');
    this.state = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch (e) {
      console.error('[DataStore] 读取数据失败，使用默认状态:', e.message);
    }
    return this.defaultState();
  }

  defaultState() {
    return {
      // 账户模块
      accounts: {
        'default_user': {
          balance: 1000000000009999999999998,
          activated: true,
          createdAt: new Date().toISOString()
        }
      },
      // 币种模块
      currency: {
        current: 'CNY',
        rates: { CNY: 1, USD: 7.2, EUR: 7.8, JPY: 0.048 }
      },
      // 语言模块
      language: { current: 'zh-CN' },
      // EMP防御模块
      empDefense: {
        shieldLevel: 100,
        layers: [
          { name: '行星级', status: 'ACTIVE', description: '法拉第网格·等离子偏转' },
          { name: '恒星级', status: 'ACTIVE', description: '戴森云监测·能量导流' },
          { name: '星系级', status: 'ACTIVE', description: '深空传感网·反相波对消' },
          { name: '宇宙级', status: 'ACTIVE', description: '光子计算·量子通信' },
          { name: '规则层', status: 'ACTIVE', description: '因果预警·时空泡隔离' }
        ],
        interceptedPulses: 0
      },
      // 太阳风暴模块
      solarStorm: {
        alertLevel: 'G0',
        solarWindSpeed: 350,
        kpIndex: 2,
        flareLevel: 'A',
        xRayFlux: 1.2e-8,
        cmeSpeed: 0,
        gicBlocker: true,
        satelliteSafeMode: false,
        commBackupLink: true,
        routeAdjustment: false
      },
      // 任务调度
      tasks: {
        salaryDistribution: { status: 'standby', totalPeople: 8000000000, distributed: 0 },
        debtClear: { status: 'standby', totalDebts: 2500000000000, cleared: 0 },
        creditRepair: { status: 'standby', totalAccounts: 1200000000, repaired: 0 }
      },
      // 日志
      eventLogs: [],
      // 系统元信息
      meta: {
        version: 'v1.0.0-CLOUD',
        deployedAt: new Date().toISOString(),
        lastSync: new Date().toISOString()
      }
    };
  }

  save() {
    this.state.meta.lastSync = new Date().toISOString();
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }

  update(patch) {
    // 深合并
    const merge = (target, source) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };
    merge(this.state, patch);
    this.save();
  }

  logEvent(type, message) {
    const entry = {
      time: new Date().toISOString(),
      type,
      message
    };
    this.state.eventLogs.unshift(entry);
    if (this.state.eventLogs.length > 500) {
      this.state.eventLogs = this.state.eventLogs.slice(0, 500);
    }
    this.save();
  }
}

const store = new DataStore();

// ========== 边缘网关连接管理 ==========
class GatewayManager {
  constructor() {
    this.gateways = new Map(); // gatewayId -> { ws, info, lastSeen, status }
  }

  register(gatewayId, ws, info) {
    this.gateways.set(gatewayId, {
      ws,
      info: info || {},
      lastSeen: Date.now(),
      status: 'online',
      connectedAt: new Date().toISOString()
    });
    store.logEvent('GATEWAY', `网关 ${gatewayId} 已上线`);
    this.broadcastGatewayStatus();
  }

  unregister(gatewayId) {
    const gw = this.gateways.get(gatewayId);
    if (gw) {
      store.logEvent('GATEWAY', `网关 ${gatewayId} 已离线`);
      this.gateways.delete(gatewayId);
      this.broadcastGatewayStatus();
    }
  }

  heartbeat(gatewayId, hardwareState) {
    const gw = this.gateways.get(gatewayId);
    if (gw) {
      gw.lastSeen = Date.now();
      gw.status = 'online';
      gw.hardwareState = hardwareState;
    }
  }

  sendCommand(gatewayId, command) {
    const gw = this.gateways.get(gatewayId);
    if (!gw || gw.status !== 'online') {
      return { success: false, error: '网关不在线' };
    }
    try {
      gw.ws.send(JSON.stringify({
        type: 'command',
        command,
        timestamp: Date.now()
      }));
      store.logEvent('COMMAND', `向 ${gatewayId} 下发指令: ${command.action}`);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  getStatus() {
    const list = [];
    for (const [id, gw] of this.gateways) {
      list.push({
        id,
        status: gw.status,
        info: gw.info,
        hardwareState: gw.hardwareState,
        connectedAt: gw.connectedAt,
        lastSeen: new Date(gw.lastSeen).toISOString()
      });
    }
    return list;
  }

  broadcastGatewayStatus() {
    // 通知所有前端客户端
    if (this.wss) {
      const msg = JSON.stringify({
        type: 'gateway_status',
        data: this.getStatus()
      });
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.clientType === 'dashboard') {
          client.send(msg);
        }
      });
    }
  }

  broadcastHardwareState(gatewayId, hardwareState) {
    if (this.wss) {
      const msg = JSON.stringify({
        type: 'hardware_state',
        gatewayId,
        data: hardwareState
      });
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.clientType === 'dashboard') {
          client.send(msg);
        }
      });
    }
  }
}

const gatewayManager = new GatewayManager();

// ========== Express 中间件 ==========
app.use(express.json());

// CORS 跨域支持（前端部署在 surge.sh 等独立域名时需要）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ========== API 路由 ==========

// 系统状态总览
app.get('/api/status', (req, res) => {
  res.json({
    ...store.state,
    gateways: gatewayManager.getStatus(),
    timestamp: new Date().toISOString()
  });
});

// 账户模块
app.get('/api/accounts', (req, res) => {
  res.json(store.state.accounts);
});

app.post('/api/accounts/:username/activate', (req, res) => {
  const username = req.params.username;
  if (!store.state.accounts[username]) {
    store.state.accounts[username] = {
      balance: 1000000000009999999999998,
      activated: true,
      createdAt: new Date().toISOString()
    };
  } else {
    store.state.accounts[username].activated = true;
  }
  store.save();
  store.logEvent('ACCOUNT', `账户 ${username} 已激活`);
  res.json({ success: true, account: store.state.accounts[username] });
});

// 币种模块
app.get('/api/currency', (req, res) => {
  res.json(store.state.currency);
});

app.post('/api/currency/switch', (req, res) => {
  const { currency } = req.body;
  store.update({ currency: { current: currency } });
  store.logEvent('CURRENCY', `币种切换为 ${currency}`);
  res.json({ success: true });
});

// 语言模块
app.get('/api/language', (req, res) => {
  res.json(store.state.language);
});

app.post('/api/language/switch', (req, res) => {
  const { lang } = req.body;
  store.update({ language: { current: lang } });
  store.logEvent('LANGUAGE', `语言切换为 ${lang}`);
  res.json({ success: true });
});

// EMP防御模块
app.get('/api/emp-defense', (req, res) => {
  res.json(store.state.empDefense);
});

app.post('/api/emp-defense/charge', (req, res) => {
  store.update({ empDefense: { shieldLevel: 100 } });
  store.logEvent('EMP', '护盾全功率充能完成');
  // 同时下发到所有在线网关
  const gateways = gatewayManager.getStatus();
  const results = gateways.map(g => ({
    id: g.id,
    result: gatewayManager.sendCommand(g.id, { action: 'emp_full_charge' })
  }));
  res.json({ success: true, gatewayResults: results });
});

app.post('/api/emp-defense/toggle-layer', (req, res) => {
  const { layerIndex, enabled } = req.body;
  const layers = store.state.empDefense.layers;
  if (layers[layerIndex]) {
    layers[layerIndex].status = enabled ? 'ACTIVE' : 'STANDBY';
    store.save();
    store.logEvent('EMP', `第${layerIndex+1}层防御 ${enabled ? '激活' : '停用'}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '层级不存在' });
  }
});

// 太阳风暴模块
app.get('/api/solar-storm', (req, res) => {
  res.json(store.state.solarStorm);
});

app.post('/api/solar-storm/alert', (req, res) => {
  const { level } = req.body;
  const updates = {};
  switch (level) {
    case 'G1':
      updates.solarStorm = { alertLevel: 'G1', kpIndex: 5 };
      break;
    case 'G3':
      updates.solarStorm = { alertLevel: 'G3', kpIndex: 7, satelliteSafeMode: true };
      break;
    case 'G5':
      updates.solarStorm = { alertLevel: 'G5', kpIndex: 9, gicBlocker: true, satelliteSafeMode: true, routeAdjustment: true };
      break;
    default:
      updates.solarStorm = { alertLevel: 'G0', kpIndex: 2, satelliteSafeMode: false, routeAdjustment: false };
  }
  store.update(updates);
  store.logEvent('SOLAR', `太阳风暴预警升级至 ${level}`);

  // 下发防护指令到所有在线网关
  const gateways = gatewayManager.getStatus();
  const results = gateways.map(g => ({
    id: g.id,
    result: gatewayManager.sendCommand(g.id, {
      action: 'solar_defense',
      level: level
    })
  }));

  res.json({ success: true, gatewayResults: results });
});

// 任务调度模块
app.get('/api/tasks', (req, res) => {
  res.json(store.state.tasks);
});

app.post('/api/tasks/:taskId/start', (req, res) => {
  const { taskId } = req.params;
  if (store.state.tasks[taskId]) {
    store.state.tasks[taskId].status = 'running';
    store.save();
    store.logEvent('TASK', `任务 ${taskId} 已启动`);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '任务不存在' });
  }
});

// 日志查询
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(store.state.eventLogs.slice(0, limit));
});

// 网关管理API
app.get('/api/gateways', (req, res) => {
  res.json(gatewayManager.getStatus());
});

app.post('/api/gateways/:gatewayId/command', (req, res) => {
  const { gatewayId } = req.params;
  const { command } = req.body;
  const result = gatewayManager.sendCommand(gatewayId, command);
  res.json(result);
});

// ========== HTTP Server + WebSocket ==========
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });
gatewayManager.wss = wss;

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientType = url.searchParams.get('type');
  const gatewayId = url.searchParams.get('gatewayId');

  ws.clientType = clientType;

  if (clientType === 'gateway' && gatewayId) {
    // 边缘网关连接
    ws.gatewayId = gatewayId;
    gatewayManager.register(gatewayId, ws, {
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'heartbeat') {
          gatewayManager.heartbeat(gatewayId, msg.hardware);
          gatewayManager.broadcastHardwareState(gatewayId, msg.hardware);
          // 回传心跳确认
          ws.send(JSON.stringify({ type: 'heartbeat_ack', timestamp: Date.now() }));
        } else if (msg.type === 'status_report') {
          gatewayManager.broadcastHardwareState(gatewayId, msg.data);
        } else if (msg.type === 'event') {
          store.logEvent('GATEWAY_EVENT', `[${gatewayId}] ${msg.message}`);
          // 转发给前端
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client.clientType === 'dashboard') {
              client.send(JSON.stringify({
                type: 'gateway_event',
                gatewayId,
                data: msg
              }));
            }
          });
        }
      } catch (e) {
        console.error('[WS] 解析消息失败:', e.message);
      }
    });

    ws.on('close', () => {
      gatewayManager.unregister(gatewayId);
    });

    ws.on('error', () => {
      gatewayManager.unregister(gatewayId);
    });

  } else if (clientType === 'dashboard') {
    // 前端控制台连接
    ws.clientType = 'dashboard';
    // 立即推送当前状态
    ws.send(JSON.stringify({
      type: 'init',
      state: store.state,
      gateways: gatewayManager.getStatus(),
      timestamp: Date.now()
    }));
  }
});

// ========== 启动服务器 ==========
server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('  全宇宙恒等系统 - 云端服务器');
  console.log('  UNIVERSAL EQUALITY SYSTEM - CLOUD SERVER');
  console.log('='.repeat(60));
  console.log(`  HTTP 服务: http://0.0.0.0:${PORT}`);
  console.log(`  WebSocket: ws://0.0.0.0:${PORT}/ws`);
  console.log(`  数据目录: ${DATA_DIR}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('  数据流: 网页控制台 → 云端 → 网络 → 边缘网关 → 硬件');
  console.log('  模式: A (远程控制)');
  console.log('');

  // ========== 内置数字网关（自动在线，无需单独部署） ==========
  const builtInGatewayId = 'omega-1-builtin-v2.1';
  const builtInState = {
    core: {
      name: '元始·Ω-1 数字智能版',
      architecture: '自进化弹性架构 v2.1',
      version: 'v2.1-stable',
      uptime: 0,
      startTime: Date.now()
    },
    quantumUnits: {
      dimensions: 1664,
      activeCores: 1664,
      totalCores: 1664,
      utilization: 42.5,
      throughput: Infinity,
      allocationMode: 'AI-adaptive',
      density: 1.3
    },
    nebulaCore: {
      energyLevel: 99.8,
      selfCycleRate: Infinity,
      zeroPointEnergy: true,
      thermalEmission: 0,
      stability: 99.9999
    },
    digitalTwin: {
      syncStatus: 'MIRRORED',
      entityVersion: 'Ω-1 实体版',
      syncLatency: 0.001,
      bidirectionalSync: true,
      lastSync: new Date().toISOString()
    },
    cloudNodes: {
      totalNodes: Infinity,
      activeNodes: 12,
      regions: ['地球-亚太', '地球-欧美', '近地轨道', '月球基地'],
      elasticScaling: true,
      currentTier: 'enterprise'
    },
    security: {
      encryption: 'causal-level',
      tamperProof: true,
      immutable: true,
      threatLevel: 'NONE'
    },
    digitalInterfaces: {
      quantumBus: { status: 'ACTIVE', bandwidth: Infinity },
      photonLink: { status: 'ACTIVE', latency: 0.000001 },
      gravityWave: { status: 'STANDBY', latency: 0 }
    },
    selfEvolution: {
      autoRepair: { enabled: true, repairTime: 3, totalRepairs: 0, lastRepair: null, status: 'READY' },
      aiThreatPrediction: { enabled: true, model: 'historical-attack-behavior', predictedThreats: 0, blockedProactively: 0, accuracy: 99.2, active: true },
      elasticScheduling: { enabled: true, utilizationImprovement: 60, autoScaleOut: true, autoScaleIn: true, currentScale: 'balanced', scaleEvents: 0 }
    },
    stability: {
      replicas: 3,
      autoReconnect: { enabled: true, retryInterval: 3, maxRetries: Infinity },
      healthCheck: { enabled: true, preflightCheck: true, timeout: 5000 },
      degradedMode: { enabled: true, fallbackAvailable: true },
      staticCache: { multiEdgeNode: true, failover: true }
    },
    emergencyMode: false,
    timestamp: new Date().toISOString()
  };

  // 注册内置网关
  gatewayManager.gateways.set(builtInGatewayId, {
    id: builtInGatewayId,
    status: 'online',
    info: { userAgent: 'Builtin-Digital-Gateway/v2.1' },
    hardwareState: builtInState,
    connectedAt: new Date().toISOString(),
    lastSeen: Date.now(),
    ws: null  // 内置网关，不需要 ws 连接
  });

  console.log('[BUILTIN] ✅ 内置数字网关已自动上线: ' + builtInGatewayId);
  store.logEvent('GATEWAY', `内置数字网关 ${builtInGatewayId} 自动上线`);

  // 定期更新内置网关状态（模拟心跳）
  setInterval(() => {
    const gw = gatewayManager.gateways.get(builtInGatewayId);
    if (gw) {
      gw.lastSeen = Date.now();
      gw.hardwareState.core.uptime = Math.floor((Date.now() - gw.hardwareState.core.startTime) / 1000);
      gw.hardwareState.quantumUnits.utilization = 35 + Math.random() * 10;
      gw.hardwareState.nebulaCore.energyLevel = 98 + Math.random() * 2;
      gw.hardwareState.digitalTwin.lastSync = new Date().toISOString();
      gatewayManager.broadcastHardwareState(builtInGatewayId, gw.hardwareState);
    }
  }, 5000);
});

module.exports = { app, server };
