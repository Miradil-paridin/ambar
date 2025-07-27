import api from './index'
import type { 
  LoginData, 
  RegisterData, 
  AuthResponse, 
  TokenVerifyResponse 
} from '@/types/auth'

export const authAPI = {
  // 用户登录
  login: async (data: LoginData): Promise<AuthResponse> => {
    return await api.post('/auth/login', data)
  },

  // 用户注册
  register: async (data: RegisterData): Promise<AuthResponse> => {
    return await api.post('/auth/register', data)
  },

  // 验证token
  verifyToken: async (token: string): Promise<TokenVerifyResponse> => {
    return await api.get('/auth/verify', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  }
} 