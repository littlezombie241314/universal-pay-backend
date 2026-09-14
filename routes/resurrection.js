const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const {
  getResurrectionState,
  saveResurrectionState,
  updateResurrectionState,
  resetResurrectionState,
} = require('../utils/resurrection-store');

// 获取复活数据
router.get('/state', async (req, res) => {
  try {
    const state = getResurrectionState();
    res.json({
      success: true,
      data: state,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('获取复活数据失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '获取复活数据失败',
      error: error.message,
    });
  }
});

// 保存复活数据（全量覆盖）
router.post('/state', async (req, res) => {
  try {
    const { revived, autoResurrectEnabled, autoResurrectTotal } = req.body;
    
    const updates = {};
    if (revived !== undefined && !isNaN(revived)) {
      updates.revived = Number(revived);
    }
    if (autoResurrectEnabled !== undefined) {
      updates.autoResurrectEnabled = Boolean(autoResurrectEnabled);
    }
    if (autoResurrectTotal !== undefined && !isNaN(autoResurrectTotal)) {
      updates.autoResurrectTotal = Number(autoResurrectTotal);
    }
    
    const saved = saveResurrectionState({
      ...getResurrectionState(),
      ...updates,
    });
    
    res.json({
      success: true,
      data: saved,
      message: '复活数据已保存到服务器',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('保存复活数据失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '保存复活数据失败',
      error: error.message,
    });
  }
});

// 更新复活数据（部分更新）
router.patch('/state', async (req, res) => {
  try {
    const updates = req.body;
    const updated = updateResurrectionState(updates);
    
    res.json({
      success: true,
      data: updated,
      message: '复活数据已更新',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('更新复活数据失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '更新复活数据失败',
      error: error.message,
    });
  }
});

// 增加复活数量
router.post('/add', async (req, res) => {
  try {
    const { amount, source = 'manual' } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: '复活数量必须为正数',
      });
    }
    
    const current = getResurrectionState();
    const newRevived = current.revived + Number(amount);
    const newTotal = (current.autoResurrectTotal || 0) + (source === 'auto' ? Number(amount) : 0);
    
    const updated = updateResurrectionState({
      revived: newRevived,
      autoResurrectTotal: newTotal,
      lastSynced: new Date().toISOString(),
    });
    
    res.json({
      success: true,
      data: updated,
      added: amount,
      source,
      message: `已增加 ${amount.toLocaleString()} 个复活存在`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('增加复活数量失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '增加复活数量失败',
      error: error.message,
    });
  }
});

// 重置复活数据
router.post('/reset', async (req, res) => {
  try {
    const reset = resetResurrectionState();
    res.json({
      success: true,
      data: reset,
      message: '复活数据已重置',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('重置复活数据失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '重置复活数据失败',
      error: error.message,
    });
  }
});

// 获取复活数据统计
router.get('/stats', async (req, res) => {
  try {
    const state = getResurrectionState();
    const stats = {
      totalRevived: state.revived,
      autoResurrectTotal: state.autoResurrectTotal || 0,
      autoResurrectEnabled: state.autoResurrectEnabled,
      lastSaved: state.lastSaved,
      lastSynced: state.lastSynced,
      uptime: process.uptime(),
    };
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('获取复活数据统计失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '获取复活数据统计失败',
      error: error.message,
    });
  }
});

module.exports = router;
