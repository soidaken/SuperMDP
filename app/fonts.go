package main

import (
	"errors"
	"sort"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// 系统字体枚举（GDI EnumFontFamiliesExW）：
// 供前端"字体设置"使用——中文字体/英文字体选择器列出系统全部字体。

var (
	modGdi32   = windows.NewLazySystemDLL("gdi32.dll")
	modUser32  = windows.NewLazySystemDLL("user32.dll")
	procGetDC  = modUser32.NewProc("GetDC")
	procRelDC  = modUser32.NewProc("ReleaseDC")
	procEnuFFE = modGdi32.NewProc("EnumFontFamiliesExW")
)

// logFontW 是 Windows LOGFONTW 结构（仅枚举所需字段）。
type logFontW struct {
	lfHeight         int32
	lfWidth          int32
	lfEscapement     int32
	lfOrientation    int32
	lfWeight         int32
	lfItalic         byte
	lfUnderline      byte
	lfStrikeOut      byte
	lfCharSet        byte
	lfOutPrecision   byte
	lfClipPrecision  byte
	lfQuality        byte
	lfPitchAndFamily byte
	lfFaceName       [32]uint16
}

// GetSystemFonts 枚举系统全部字体族名称（去重、排序）。
// 结果含本地化名称（如"微软雅黑"），可直接用于 CSS font-family。
func (a *App) GetSystemFonts() ([]string, error) {
	hdc, _, _ := procGetDC.Call(0)
	if hdc == 0 {
		return nil, errors.New("无法获取设备上下文")
	}
	defer procRelDC.Call(0, hdc)

	var lf logFontW
	lf.lfCharSet = 1 // DEFAULT_CHARSET：枚举所有字符集

	seen := make(map[string]bool)
	var fonts []string

	cb := syscall.NewCallback(func(lplf *logFontW, _ uintptr, _ uintptr, _ uintptr) uintptr {
		name := windows.UTF16ToString(lplf.lfFaceName[:])
		// 过滤 "@" 前缀：竖排变体（CSS 中不可用）
		if !seen[name] && !strings.HasPrefix(name, "@") {
			seen[name] = true
			fonts = append(fonts, name)
		}
		return 1 // 继续枚举
	})

	r, _, _ := procEnuFFE.Call(hdc, uintptr(unsafe.Pointer(&lf)), cb, 0, 0)
	if r == 0 {
		return nil, errors.New("枚举系统字体失败")
	}
	sort.Strings(fonts)
	return fonts, nil
}
