const express = require('express');
const router = express.Router();
const {
  getEconomyState,
  saveEconomyState,
  updateEconomyState,
  resetEconomyState
} = require('../utils/economy-store');

// GET /api/economy/state - 获取经济状态
router.get('/state', async (req, res) => {
  try {
    const state = getEconomyState();
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

// POST /api/economy/state - 保存经济状态（全量覆盖）
router.post('/state', async (req, res) => {
  try {
    const state = req.body;
    const newState = saveEconomyState(state);
    if (newState) {
      res.json({
        success: true,
        data: newState
      });
    } else {
      res.status(500).json({
        success: false,
        error: '保存经济状态失败'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// PATCH /api/economy/state - 更新经济状态（部分更新）
router.patch('/state', async (req, res) => {
  try {
    const updates = req.body;
    const newState = updateEconomyState(updates);
    if (newState) {
      res.json({
        success: true,
        data: newState
      });
    } else {
      res.status(500).json({
        success: false,
        error: '更新经济状态失败'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// POST /api/economy/reset - 重置经济状态
router.post('/reset', async (req, res) => {
  try {
    const newState = resetEconomyState();
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

// GET /api/economy/stats - 获取经济状态统计
router.get('/stats', async (req, res) => {
  try {
    const state = getEconomyState();
    const stats = {
      universeBalance: state.universeBalance,
      internalAccountsCount: Object.keys(state.internalAccounts || {}).length,
      coveredBeings: state.coveredBeings,
      lastUpdate: state.lastUpdate,
      hasSalaryState: !!state.salaryState,
      hasDebtState: !!state.debtState
    };
    res.json({
      success: true,
      data: stats
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

module.exports = router;
