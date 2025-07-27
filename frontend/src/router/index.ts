import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import Dashboard from '@/views/Dashboard.vue'
import Files from '@/views/Files.vue'
import Charts from '@/views/Charts.vue'
import Visualization from '@/views/Visualization.vue'
import CollaborativeEditor from '@/views/CollaborativeEditor.vue'
import NotFound from '@/views/NotFound.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/login',
      name: 'Login',
      component: Login,
      meta: { requiresGuest: true }
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: Dashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/files',
      name: 'Files',
      component: Files,
      meta: { requiresAuth: true }
    },
    {
      path: '/charts',
      name: 'Charts',
      component: Charts,
      meta: { requiresAuth: true }
    },
    {
      path: '/visualization/:fileId',
      name: 'Visualization',
      component: Visualization,
      meta: { requiresAuth: true }
    },
    {
      path: '/editor/:fileId',
      name: 'Editor',
      component: CollaborativeEditor,
      meta: { requiresAuth: true }
    },
    {
      path: '/collaborative/:fileId',
      name: 'CollaborativeEditor',
      component: () => import('../views/CollaborativeEditor.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/x-spreadsheet/:fileId',
      name: 'XSpreadsheetEditor', 
      component: () => import('../views/XSpreadsheetEditor.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: NotFound
    }
  ]
})

// 导航守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('auth_token')
  
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if (to.meta.requiresGuest && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router 