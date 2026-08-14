import React from 'react'
import {createRoot} from 'react-dom/client'
// 加载顺序：ui.css（设计令牌）→ markdown-theme.css（依赖令牌）→ katex → overrides
// 不引入任何 hljs 官方主题，代码块配色由 markdown-theme.css 自写
import './styles/ui.css'
import './styles/markdown-theme.css'
import 'katex/dist/katex.min.css'
import './styles/overrides.css'
import App from './App'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
)
