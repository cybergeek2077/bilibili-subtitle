import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.less'
import store from './store'
import {Provider} from 'react-redux'
import Router from './Router'
import { APP_DOM_ID } from './consts/const'
import { isContextInvalidatedError } from './utils/env_util'
import { setContextInvalidated } from './redux/envReducer'

// 扩展重新加载后旧页面的请求都会失败，不再逐条报错，改为提示刷新页面
window.addEventListener('unhandledrejection', (event) => {
  if (isContextInvalidatedError(event.reason)) {
    event.preventDefault()
    store.dispatch(setContextInvalidated())
  }
})

const body = document.querySelector('body')
const app = document.createElement('div')
app.id = APP_DOM_ID
if (body != null) {
  body.prepend(app)
}

ReactDOM.createRoot(document.getElementById(APP_DOM_ID) as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <Router/>
    </Provider>
  </React.StrictMode>
)
