# 内置字体许可声明（Font Licenses）

本应用随发行包内置以下字体（位于 `app/frontend/public/fonts/`），
在分发本应用（安装包 / 便携版 / GitHub Releases）时须保留本声明。

## JetBrains Mono

- 文件：`JetBrainsMono-Regular.ttf`、`JetBrainsMono-Bold.ttf`
- 作者：JetBrains
- 许可：[SIL Open Font License 1.1](https://openfontlicense.org/)（OFL-1.1）
- 来源：https://www.jetbrains.com/lp/mono/
- 用途：英文字体（默认，界面与正文的拉丁字符）

OFL-1.1 允许：自由使用、嵌入、修改、再分发（须保留版权声明与许可文本、
不得单独出售字体文件）。完整许可文本：
https://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=OFL

## HarmonyOS Sans SC

- 文件：`HarmonyOS_Sans_SC_Regular.ttf`、`HarmonyOS_Sans_SC_Bold.ttf`
- 作者：华为技术有限公司（Huawei）
- 许可：HarmonyOS Sans 字体许可（允许免费使用与再分发，含嵌入式使用；
  不得用于违法用途；再分发须保留版权声明）
- 来源：https://developer.huawei.com/consumer/cn/design/resource/
- 用途：中文字体（默认，界面与正文的 CJK 字符）

## 备注

- 以上字体内置于应用资源（`@font-face` 本地加载，离线可用），
  任何目标机器（即使未安装这些字体）都能获得一致的渲染效果。
- 用户仍可在设置中选择系统已安装的其他字体覆盖默认字体。
