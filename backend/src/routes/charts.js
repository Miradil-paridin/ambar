const express = require('express');
const { chartsDB, filesDB } = require('../utils/database');

const router = express.Router();

// 保存图表配置
router.post('/save', async (req, res) => {
  try {
    const { fileId, chartConfig, chartName, chartType } = req.body;

    // 验证输入
    if (!fileId || !chartConfig || !chartName) {
      return res.status(400).json({ error: '文件ID、图表配置和图表名称不能为空' });
    }

    // 验证文件是否属于当前用户
    const fileRecord = await filesDB.findOne('files', { 
      id: fileId, 
      userId: req.user.id 
    });

    if (!fileRecord) {
      return res.status(404).json({ error: '文件不存在或无权限' });
    }

    // 保存图表配置
    const chartRecord = await chartsDB.insert('charts', {
      userId: req.user.id,
      fileId,
      chartName: chartName.trim(),
      chartType: chartType || 'unknown',
      chartConfig: JSON.stringify(chartConfig),
      fileName: fileRecord.originalName
    });

    res.json({
      message: '图表保存成功',
      chart: {
        id: chartRecord.id,
        chartName: chartRecord.chartName,
        chartType: chartRecord.chartType,
        fileName: chartRecord.fileName,
        createTime: chartRecord.createTime
      }
    });

  } catch (error) {
    console.error('保存图表错误:', error);
    res.status(500).json({ error: '保存图表失败: ' + error.message });
  }
});

// 获取用户的图表列表
router.get('/list', async (req, res) => {
  try {
    const charts = await chartsDB.find('charts', { userId: req.user.id });

    const chartList = charts.map(chart => ({
      id: chart.id,
      chartName: chart.chartName,
      chartType: chart.chartType,
      fileName: chart.fileName,
      fileId: chart.fileId,
      createTime: chart.createTime,
      updateTime: chart.updateTime
    }));

    // 按创建时间倒序排列
    chartList.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

    res.json({ charts: chartList });

  } catch (error) {
    console.error('获取图表列表错误:', error);
    res.status(500).json({ error: '获取图表列表失败' });
  }
});

// 获取特定图表的配置
router.get('/:chartId', async (req, res) => {
  try {
    const { chartId } = req.params;

    const chartRecord = await chartsDB.findOne('charts', { 
      id: chartId, 
      userId: req.user.id 
    });

    if (!chartRecord) {
      return res.status(404).json({ error: '图表不存在' });
    }

    // 解析图表配置
    let chartConfig;
    try {
      chartConfig = JSON.parse(chartRecord.chartConfig);
    } catch (parseError) {
      console.error('解析图表配置失败:', parseError);
      return res.status(500).json({ error: '图表配置数据损坏' });
    }

    res.json({
      id: chartRecord.id,
      chartName: chartRecord.chartName,
      chartType: chartRecord.chartType,
      chartConfig,
      fileName: chartRecord.fileName,
      fileId: chartRecord.fileId,
      createTime: chartRecord.createTime,
      updateTime: chartRecord.updateTime
    });

  } catch (error) {
    console.error('获取图表配置错误:', error);
    res.status(500).json({ error: '获取图表配置失败' });
  }
});

// 更新图表配置
router.put('/:chartId', async (req, res) => {
  try {
    const { chartId } = req.params;
    const { chartConfig, chartName, chartType } = req.body;

    // 验证输入
    if (!chartConfig || !chartName) {
      return res.status(400).json({ error: '图表配置和图表名称不能为空' });
    }

    // 检查图表是否存在且属于当前用户
    const existingChart = await chartsDB.findOne('charts', { 
      id: chartId, 
      userId: req.user.id 
    });

    if (!existingChart) {
      return res.status(404).json({ error: '图表不存在' });
    }

    // 更新图表配置
    const updatedChart = await chartsDB.update('charts', 
      { id: chartId, userId: req.user.id },
      {
        chartName: chartName.trim(),
        chartType: chartType || existingChart.chartType,
        chartConfig: JSON.stringify(chartConfig)
      }
    );

    res.json({
      message: '图表更新成功',
      chart: {
        id: updatedChart.id,
        chartName: updatedChart.chartName,
        chartType: updatedChart.chartType,
        fileName: updatedChart.fileName,
        updateTime: updatedChart.updateTime
      }
    });

  } catch (error) {
    console.error('更新图表错误:', error);
    res.status(500).json({ error: '更新图表失败: ' + error.message });
  }
});

// 删除图表
router.delete('/:chartId', async (req, res) => {
  try {
    const { chartId } = req.params;

    // 检查图表是否存在且属于当前用户
    const chartRecord = await chartsDB.findOne('charts', { 
      id: chartId, 
      userId: req.user.id 
    });

    if (!chartRecord) {
      return res.status(404).json({ error: '图表不存在' });
    }

    // 删除图表记录
    await chartsDB.delete('charts', { id: chartId, userId: req.user.id });

    res.json({ message: '图表删除成功' });

  } catch (error) {
    console.error('删除图表错误:', error);
    res.status(500).json({ error: '删除图表失败' });
  }
});

// 根据文件ID获取相关图表
router.get('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    // 验证文件是否属于当前用户
    const fileRecord = await filesDB.findOne('files', { 
      id: fileId, 
      userId: req.user.id 
    });

    if (!fileRecord) {
      return res.status(404).json({ error: '文件不存在或无权限' });
    }

    // 获取该文件的所有图表
    const charts = await chartsDB.find('charts', { 
      fileId, 
      userId: req.user.id 
    });

    const chartList = charts.map(chart => ({
      id: chart.id,
      chartName: chart.chartName,
      chartType: chart.chartType,
      createTime: chart.createTime,
      updateTime: chart.updateTime
    }));

    res.json({ charts: chartList });

  } catch (error) {
    console.error('获取文件图表错误:', error);
    res.status(500).json({ error: '获取文件图表失败' });
  }
});

module.exports = router; 