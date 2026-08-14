# 边界与稳健性用例（验收者补充，供真机人工验证）

> 本文件内容多为**故意损坏/恶意**的输入，用于验证渲染器的降级与清洗行为。
> 正常显示要求：不崩溃、不白屏、无脚本执行、无控制台报错。

## 1. 损坏的围栏代码块（未闭合）

```javascript
const x = 1
function broken( {
  return

## 2. 非法公式（应优雅降级为原样/错误提示，不白屏）

行内：$x_{ 与块级：

$$
\frac{
$$

$$
\begin{matrix}a&b
$$

## 3. mermaid 语法错误（应降级为源码代码块 + 状态栏提示）

```mermaid
flowchart LR
A-->B bad syntax !!!
```

## 4. 未定义脚注引用（应显示字面文本）

正文引用[^nope]，没有对应定义。

## 5. 超长单行

（本行以下为 10 万个 "x" 组成的单行，渲染不应卡死或崩溃）

xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
（实际测试时用工具生成 10 万字符单行；上方仅为占位）

## 6. 1000 行表格

（用脚本生成 1000 行 3 列表格，渲染后表格完整、可滚动查看，不崩溃）

| 列A | 列B | 列C |
| --- | --- | --- |
| 占位 | 占位 | 占位 |

## 7. XSS 变体（全部应显示为清洗后的文本，**绝不执行**）

<svg onload="alert(1)"></svg>

<math><mtext><img src=x onerror="alert(1)"></mtext></math>

<details open ontoggle="alert(1)"><summary>点我</summary></details>

<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">data 链接</a>

<a href="javascript:alert(1)">javascript 链接</a>

<scr<script>ipt>alert(1)</scr<script>ipt>

<img src="x" onerror="alert('xss')">

## 8. 结束

> 以上各项应：渲染正常或优雅降级、状态栏无异常、窗口无卡死。
