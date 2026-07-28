import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { pinia } from '@/stores/pinia';
import type { UserRole } from '@/types/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/auth/LoginPage.vue'),
      meta: { title: 'Вхід', public: true },
    },
    {
      path: '/',
      redirect: '/overview',
    },
    {
      path: '/overview',
      name: 'overview',
      component: () => import('@/pages/overview/OverviewPage.vue'),
      meta: { title: 'Огляд' },
    },
    {
      path: '/clients',
      name: 'clients',
      component: () => import('@/pages/clients/ClientsPage.vue'),
      meta: { title: 'Клієнти' },
    },
    {
      path: '/clients/:id',
      name: 'client-details',
      component: () => import('@/pages/clients/ClientDetailsPage.vue'),
      meta: { title: 'Картка клієнта' },
    },
    {
      path: '/deals',
      name: 'deals',
      component: () => import('@/pages/deals/DealsPage.vue'),
      meta: { title: 'Угоди' },
    },
    {
      path: '/team',
      name: 'team',
      component: () => import('@/pages/admin/ManagersPage.vue'),
      meta: { title: 'Менеджери', roles: ['ADMIN'] satisfies UserRole[] },
    },
    {
      path: '/account',
      name: 'account',
      component: () => import('@/pages/account/AccountPage.vue'),
      meta: { title: 'Мій акаунт' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/overview',
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia);
  await auth.initialize();

  if (to.meta.public) {
    return auth.isAuthenticated && to.name === 'login'
      ? { name: 'overview' }
      : true;
  }

  if (!auth.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  const roles = to.meta.roles as UserRole[] | undefined;
  if (roles?.length && (!auth.user || !roles.includes(auth.user.role))) {
    return { name: 'overview' };
  }

  return true;
});

router.afterEach((to) => {
  document.title = `${String(to.meta.title || 'CRM')} · Bodya CRM`;
});

export default router;
