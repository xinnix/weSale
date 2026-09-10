import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages'

export default defineUniPages({
  pages: [
    {
      path: 'pages/index',
      type: 'home',
    },
    {
      path: 'pages/hi',
      type: 'page',
      layout: 'home',
    },
    {
      path: 'pages/login',
      type: 'page',
    },
    {
      path: 'pages/profile/index',
      type: 'page',
      style: {
        backgroundColor: '#F5FAFF',
        navigationStyle: 'default',
        navigationBarBackgroundColor: '#F5FAFF',
        navigationBarTextStyle: 'black',
        navigationBarTitleText: '个人中心',
      },
    },
    {
      path: 'pages/agents/index',
      type: 'page',
      style: {
        backgroundColor: '#F5FAFF',
        navigationStyle: 'default',
        navigationBarBackgroundColor: '#F5FAFF',
        navigationBarTextStyle: 'black',
        navigationBarTitleText: 'AI 助手',
      },
    },
    {
      path: 'pages/agents/chat',
      type: 'page',
      style: {
        backgroundColor: '#F5FAFF',
        navigationStyle: 'default',
        navigationBarBackgroundColor: '#F5FAFF',
        navigationBarTextStyle: 'black',
        navigationBarTitleText: 'AI 对话',
      },
    },
  ],
  globalStyle: {
    backgroundColor: '@bgColor',
    backgroundColorBottom: '@bgColorBottom',
    backgroundColorTop: '@bgColorTop',
    backgroundTextStyle: '@bgTxtStyle',
    navigationBarBackgroundColor: '#000000',
    navigationBarTextStyle: '@navTxtStyle',
    navigationBarTitleText: 'weSale 商城',
    navigationStyle: 'custom',
  },
})
