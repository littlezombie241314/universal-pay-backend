const express = require('express');
const router = express.Router();
const {
  getSolarStormState,
  saveSolarStormState,
  updateSolarStormState,
  addEventLog,
  resetSolarStormState
} = require('../utils/solar-storm-store');

// GET /api/solar-storm/state - 获取太阳风暴状态
router.get('/state', async (req, res) => {
  try {
    const state = getSolarStormState();
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

// POST /api/solar-storm/state - 保存太阳风暴状态（全量覆盖）
router.post('/state', async (req, res) => {
  try {
    const state = req.body;
    const newState = saveSolarStormState(state);
    if (newState) {
      res.json({
        success: true,
        data: newState
      });
    } else {
      res.status(500).json({
        success: false,
        error: '保存太阳风暴状态失败'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// PATCH /api/solar-storm/state - 更新太阳风暴状态（部分更新）
router.patch('/state', async (req, res) => {
  try {
    const updates = req.body;
    const newState = updateSolarStormState(updates);
    if (newState) {
      res.json({
        success: true,
        data: newState
      });
    } else {
      res.status(500).json({
        success: false,
        error: '更新太阳风暴状态失败'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// POST /api/solar-storm/log - 添加事件日志
router.post('/log', async (req, res) => {
  try {
    const { log } = req.body;
    if (!log) {
      return res.status(400).json({
        success: false,
        error: '日志内容不能为空'
      });
    }
    const newState = addEventLog({
      message: log,
      timestamp: Date.now()
    });
    if (newState) {
      res.json({
        success: true,
        data: newState
      });
    } else {
      res.status(500).json({
        success: false,
        error: '添加事件日志失败'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// POST /api/solar-storm/reset - 重置太阳风暴状态
router.post('/reset', async (req, res) => {
  try {
    const newState = resetSolarStormState();
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

// GET /api/solar-storm/stats - 获取太阳风暴状态统计
router.get('/stats', async (req, res) => {
  try {
    const state = getSolarStormState();
    const stats = {
      currentLevel: state.solarStorm.level,
      currentLevelText: state.solarStorm.levelText,
      solarWindSpeed: state.solarStorm.solarWindSpeed,
      kpIndex: state.solarStorm.kpIndex,
      protectionActive: state.solarStorm.protectionActive,
      eventCount: state.solarStorm.eventCount,
      flareLevel: state.flareCME.flareLevel,
      flareText: state.flareCME.flareText,
      cmeSpeed: state.flareCME.cmeSpeed,
      logCount: (state.eventLogs || []).length,
      lastUpdate: state.lastUpdate
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
