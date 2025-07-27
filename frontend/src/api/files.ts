import request from './index'

export interface FileUploadResponse {
  message: string
  file: {
    id: string
    originalName: string
    size: number
    sheetNames: string[]
    previewData: any[]
    uploadTime: string
  }
}

export interface FileListResponse {
  files: Array<{
    id: string
    originalName: string
    size: number
    sheetNames: string[]
    uploadTime: string
  }>
}

export interface FileInfo {
  id: string
  originalName: string
  size: number
  sheetNames: string[]
  previewData: any[]
  uploadTime: string
}

export interface ExcelDataResponse {
  sheetName: string
  headers: string[]
  data: any[][]
  totalRows: number
  returnedRows: number
  columns: number
}

export interface SaveDataRequest {
  sheets: any[]
  timestamp: number
}

export const filesAPI = {
  // 上传文件
  upload: (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData()
    formData.append('excel', file)
    
    return request.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // 获取文件列表
  getList: (): Promise<FileListResponse> => {
    return request.get('/files/list')
  },

  // 获取文件信息
  getInfo: (fileId: string): Promise<FileInfo> => {
    return request.get(`/files/${fileId}/info`)
  },

  // 获取文件数据
  getData: (fileId: string, params?: { sheet?: number; limit?: number }): Promise<ExcelDataResponse> => {
    return request.get(`/files/${fileId}/data`, { params })
  },

  // 保存编辑后的数据
  saveData: (fileId: string, data: SaveDataRequest): Promise<{ message: string }> => {
    return request.post(`/files/${fileId}/save`, data)
  },

  // 导出Excel文件
  exportExcel: (fileId: string): Promise<Blob> => {
    return request.get(`/files/${fileId}/export`, {
      responseType: 'blob'
    })
  },

  // 删除文件
  delete: (fileId: string): Promise<{ message: string }> => {
    return request.delete(`/files/${fileId}`)
  }
} 