import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/lexend/400.css'
import '@fontsource/lexend/500.css'
import '@fontsource/lexend/600.css'
import '@fontsource/lexend/700.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import './styles/tokens.css'
import { App } from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
