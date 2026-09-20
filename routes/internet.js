const express = require('express');
const router = express.Router();
const {
  getInternetState,
  saveInternetState,
  updateInternetState,
  resetInternetState,
  addDnsQuery
} = require('../utils/internet-store');

// GET /api/internet/state - 获取互联网状态
router.get('/state', async (req, res) => {
  try {
    const state = getInternetState();
    res.json({
      success: true,
      data: state
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// POST /api/internet/state - 保存互联网状态（全量覆盖）
router.post('/state', async (req, res) => {
  try {
    const state = req.body;
    const newState = saveInternetState(state);
    if (newState) {
      res.json({
        success: true,
        data: newState
      });
    } else {
      res.status(500).json({
        success: false,
        error: '保存互联网状态失败'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// PATCH /api/internet/state - 更新互联网状态（部分更新）
router.patch('/state', async (req, res) => {
  try {
    const updates = req.body;
    const newState = updateInternetState(updates);
    if (newState) {
      res.json({
        success: true,
        data: newState
      });
    } else {
      res.status(500).json({
        success: false,
        error: '更新互联网状态失败'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// POST /api/internet/reset - 重置互联网状态
router.post('/reset', async (req, res) => {
  try {
    const newState = resetInternetState();
    res.json({
      success: true,
      data: newState
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// POST /api/internet/dns-query - 记录DNS查询
router.post('/dns-query', async (req, res) => {
  try {
    const { domain, records } = req.body;
    if (!domain) {
      return res.status(400).json({
        success: false,
        error: '域名不能为空'
      });
    }
    const query = addDnsQuery(domain, records || []);
    if (query) {
      res.json({
        success: true,
        data: query
      });
    } else {
      res.status(500).json({
        success: false,
        error: '记录DNS查询失败'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// GET /api/internet/nodes - 获取节点列表
router.get('/nodes', async (req, res) => {
  try {
    const state = getInternetState();
    res.json({
      success: true,
      data: {
        nodes: state.nodes,
        online: state.nodesOnline,
        total: state.nodesTotal,
        avgLatency: state.avgLatency,
        bandwidth: state.globalBandwidth
      }
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// GET /api/internet/security - 获取安全状态
router.get('/security', async (req, res) => {
  try {
    const state = getInternetState();
    res.json({
      success: true,
      data: {
        firewallBlockRate: state.firewallBlockRate,
        trafficEncryptionRate: state.trafficEncryptionRate,
        attacksBlockedToday: state.attacksBlockedToday,
        securityNodesOnline: state.securityNodesOnline
      }
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

module.exports = router;
