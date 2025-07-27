import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { ElMessage } from 'element-plus'
import { authAPI } from '@/api/auth'
import type { User, LoginData, RegisterData } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref<User | null>(null)
  const token = ref<string>('')
  const loading = ref(false)

  // 计算属性
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  // 登录
  const login = async (loginData: LoginData): Promise<boolean> => {
    try {
      loading.value = true
      const response = await authAPI.login(loginData)
      
      if (response.token && response.user) {
        token.value = response.token
        user.value = response.user
        
        // 保存到本地存储
        localStorage.setItem('auth_token', response.token)
        localStorage.setItem('user_info', JSON.stringify(response.user))
        
        ElMessage.success(response.message || '登录成功')
        return true
      }
      
      return false
    } catch (error: any) {
      console.error('登录失败:', error)
      ElMessage.error(error.response?.data?.error || '登录失败')
      return false
    } finally {
      loading.value = false
    }
  }

  // 注册
  const register = async (registerData: RegisterData): Promise<boolean> => {
    try {
      loading.value = true
      const response = await authAPI.register(registerData)
      
      if (response.token && response.user) {
        token.value = response.token
        user.value = response.user
        
        // 保存到本地存储
        localStorage.setItem('auth_token', response.token)
        localStorage.setItem('user_info', JSON.stringify(response.user))
        
        ElMessage.success(response.message || '注册成功')
        return true
      }
      
      return false
    } catch (error: any) {
      console.error('注册失败:', error)
      ElMessage.error(error.response?.data?.error || '注册失败')
      return false
    } finally {
      loading.value = false
    }
  }

  // 登出
  const logout = () => {
    user.value = null
    token.value = ''
    
    // 清除本地存储
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    
    ElMessage.success('已成功登出')
  }

  // 检查认证状态
  const checkAuth = async () => {
    try {
      const storedToken = localStorage.getItem('auth_token')
      const storedUser = localStorage.getItem('user_info')
      
      if (!storedToken || !storedUser) {
        return false
      }
      
      // 验证token是否有效
      const response = await authAPI.verifyToken(storedToken)
      
      if (response.valid && response.user) {
        token.value = storedToken
        user.value = response.user
        return true
      } else {
        // token无效，清除本地存储
        logout()
        return false
      }
    } catch (error) {
      console.error('认证检查失败:', error)
      logout()
      return false
    }
  }

  // 更新用户信息
  const updateUser = (userData: Partial<User>) => {
    if (user.value) {
      user.value = { ...user.value, ...userData }
      localStorage.setItem('user_info', JSON.stringify(user.value))
    }
  }

  return {
    // 状态
    user: readonly(user),
    token: readonly(token),
    loading: readonly(loading),
    
    // 计算属性
    isAuthenticated,
    
    // 方法
    login,
    register,
    logout,
    checkAuth,
    updateUser
  }
}) 