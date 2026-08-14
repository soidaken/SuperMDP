# 生成 5MB 混合语料 fixture（验收用）
$ErrorActionPreference = 'Stop'
$sb = [System.Text.StringBuilder]::new()
$target = 5 * 1024 * 1024
$i = 0
while ($sb.Length -lt $target) {
  [void]$sb.AppendLine("## 第 $i 节 · 产品需求与实现说明")
  [void]$sb.AppendLine()
  [void]$sb.AppendLine('本章节描述**核心功能**与验收标准。用户可通过 `Ctrl+O` 或拖拽打开文件，渲染结果遵循 CommonMark 规范，支持 GFM 全特性。详见[文档](https://example.com/docs/' + $i + ')。')
  [void]$sb.AppendLine()
  [void]$sb.AppendLine('背景与动机：提供流畅、美观、只读的桌面 Markdown 预览体验，支持代码高亮、数学公式与图表，保证离线可用。中英文混排 normal text 验证排版。')
  [void]$sb.AppendLine()
  [void]$sb.AppendLine('- 需求一：打开与拖拽')
  [void]$sb.AppendLine('- 需求二：自动刷新')
  [void]$sb.AppendLine('- 需求三：主题切换')
  [void]$sb.AppendLine()
  [void]$sb.AppendLine('```python')
  [void]$sb.AppendLine('def process(items):')
  [void]$sb.AppendLine('    total = sum(items)')
  [void]$sb.AppendLine('    return total / len(items) if items else 0')
  [void]$sb.AppendLine('```')
  [void]$sb.AppendLine()
  [void]$sb.AppendLine('| 编号 | 描述 | 优先级 |')
  [void]$sb.AppendLine('| --- | --- | --- |')
  [void]$sb.AppendLine('| ' + $i + '-1 | 打开文件对话框 | P0 |')
  [void]$sb.AppendLine('| ' + $i + '-2 | 拖拽支持 | P1 |')
  [void]$sb.AppendLine()
  [void]$sb.AppendLine('> 验收标准：全部用例通过，无回归。')
  [void]$sb.AppendLine()
  [void]$sb.AppendLine('行内公式 $E = mc^2$ 与块级：')
  [void]$sb.AppendLine()
  [void]$sb.AppendLine('$$\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}$$')
  [void]$sb.AppendLine()
  $i++
}
$content = $sb.ToString()
$sizeMB = [math]::Round($content.Length / 1MB, 2)
[System.IO.File]::WriteAllText('E:\superMDP\docs\acceptance\fixtures\big-5mb.md', $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "big-5mb.md bytes=$($content.Length) sizeMB=$sizeMB sections=$i"

# GBK fixture
$text = @'
# GBK 编码测试文件

这是用 GBK（代码页 936）编码的中文内容，用于验证后端编码转换。

- 标题：编码转换验证
- 内容：中文 + 英文 mixed content
- 公式占位：$E = mc^2$

结尾。
'@
$gbk = [System.Text.Encoding]::GetEncoding(936)
[System.IO.File]::WriteAllBytes('E:\superMDP\docs\acceptance\fixtures\gbk-sample.md', $gbk.GetBytes($text))
$bytes = [System.IO.File]::ReadAllBytes('E:\superMDP\docs\acceptance\fixtures\gbk-sample.md')
$decoded = [System.Text.Encoding]::GetEncoding(936).GetString($bytes)
Write-Host "gbk-sample.md bytes=$($bytes.Length) roundtrip=$($decoded -match '编码转换验证')"

# UTF-16LE BOM fixture
$u16 = [System.Text.Encoding]::Unicode
$u16text = '# UTF-16LE 测试

这是 UTF-16LE 编码的 Markdown 文件，含中文。'
[System.IO.File]::WriteAllBytes('E:\superMDP\docs\acceptance\fixtures\utf16le-sample.md', $u16.GetPreamble() + $u16.GetBytes($u16text))
Write-Host "utf16le-sample.md bytes=$((Get-Item E:\superMDP\docs\acceptance\fixtures\utf16le-sample.md).Length)"

# BOM-only fixture
[System.IO.File]::WriteAllBytes('E:\superMDP\docs\acceptance\fixtures\bom-only.md', [byte[]](0xEF, 0xBB, 0xBF))
Write-Host "bom-only.md bytes=$((Get-Item E:\superMDP\docs\acceptance\fixtures\bom-only.md).Length)"
