import api from './index'
import type {
  ShareFileRequest,
  ShareFileResponse,
  SharedFilesResponse,
  NotificationsResponse,
  CreatePublicLinkRequest,
  CreatePublicLinkResponse,
  OnlineUser
} from '@/types/collaboration'

export const collaborationAPI = {
  // 分享文件给其他用户
  shareFile: async (data: ShareFileRequest): Promise<ShareFileResponse> => {
    return await api.post('/collaboration/share', data)
  },

  // 获取分享给我的文件列表
  getSharedWithMe: async (): Promise<SharedFilesResponse> => {
    return await api.get('/collaboration/shared-with-me')
  },

  // 获取我分享的文件列表
  getSharedByMe: async (): Promise<SharedFilesResponse> => {
    return await api.get('/collaboration/shared-by-me')
  },

  // 撤销文件分享
  revokeShare: async (fileId: string, userId: string): Promise<{ message: string }> => {
    return await api.delete(`/collaboration/share/${fileId}/${userId}`)
  },

  // 创建公开链接
  createPublicLink: async (data: CreatePublicLinkRequest): Promise<CreatePublicLinkResponse> => {
    return await api.post('/collaboration/public-link', data)
  },

  // 获取用户通知
  getNotifications: async (params?: {
    page?: number
    limit?: number
    unreadOnly?: boolean
  }): Promise<NotificationsResponse> => {
    return await api.get('/collaboration/notifications', { params })
  },

  // 标记通知为已读
  markNotificationRead: async (notificationId: string): Promise<{ message: string }> => {
    return await api.put(`/collaboration/notifications/${notificationId}/read`)
  },

  // 获取文件的在线协作用户
  getOnlineUsers: async (fileId: string): Promise<{ users: OnlineUser[] }> => {
    return await api.get(`/collaboration/online-users/${fileId}`)
  }
} 