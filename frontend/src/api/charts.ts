import api from './index'
import type { 
  SaveChartRequest, 
  ChartInfo, 
  ChartListResponse 
} from '@/types/file'

export const chartsAPI = {
  // 保存图表配置
  save: async (data: SaveChartRequest): Promise<{ 
    message: string
    chart: ChartInfo 
  }> => {
    return await api.post('/charts/save', data)
  },

  // 获取图表列表
  getList: async (): Promise<ChartListResponse> => {
    return await api.get('/charts/list')
  },

  // 获取特定图表配置
  getChart: async (chartId: string): Promise<ChartInfo> => {
    return await api.get(`/charts/${chartId}`)
  },

  // 更新图表配置
  update: async (chartId: string, data: Partial<SaveChartRequest>): Promise<{
    message: string
    chart: ChartInfo
  }> => {
    return await api.put(`/charts/${chartId}`, data)
  },

  // 删除图表
  delete: async (chartId: string): Promise<{ message: string }> => {
    return await api.delete(`/charts/${chartId}`)
  },

  // 根据文件ID获取相关图表
  getByFileId: async (fileId: string): Promise<ChartListResponse> => {
    return await api.get(`/charts/file/${fileId}`)
  }
} 