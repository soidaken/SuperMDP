package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// 页面缩放：WebView2 原生 ZoomFactor（系统级，滚动/布局行为完全标准；
	// 用户在设置中修改后经 SetZoomPref 写入配置，重启生效）
	zoomPct := LoadZoom()

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "超级MD预览器",
		Width:     1280,
		Height:    1060,
		MinWidth:  800,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		// 启用 Wails 文件拖放：Go 侧解析拖入文件的绝对路径并经
		// "wails:file-drop" 事件回传前端（默认关闭，不开启则拖拽无响应）
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop: true,
		},
		// 页面级缩放（系统级，等效浏览器 Ctrl+ 放大，无 CSS zoom 的滚动缺陷）
		Windows: &windows.Options{
			ZoomFactor: float64(zoomPct) / 100.0,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
