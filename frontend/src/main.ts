import { createApp } from 'vue';
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import App from './App.vue';
import router from './router';
import { pinia } from './stores/pinia';
import './styles/main.css';

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'bodyaLight',
    themes: {
      bodyaLight: {
        dark: false,
        colors: {
          primary: '#26736a',
          'primary-darken-1': '#1d5d56',
          secondary: '#d87942',
          accent: '#f1b76c',
          background: '#f4f5f2',
          surface: '#ffffff',
          'surface-variant': '#edf0eb',
          error: '#ba4a4a',
          info: '#4976a7',
          success: '#387d62',
          warning: '#b66b2e',
        },
      },
    },
  },
  defaults: {
    VBtn: {
      rounded: 'lg',
      elevation: 0,
    },
    VCard: {
      rounded: 'xl',
      elevation: 0,
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
      hideDetails: 'auto',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
      hideDetails: 'auto',
    },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
      hideDetails: 'auto',
    },
  },
});

createApp(App).use(pinia).use(router).use(vuetify).mount('#app');
