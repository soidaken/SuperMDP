//go:build !windows

package main

import "errors"

// GetSystemFonts 在非 Windows 平台暂不支持（GDI 枚举为 Windows 特性）。
func (a *App) GetSystemFonts() ([]string, error) {
	return nil, errors.New("当前平台不支持系统字体枚举")
}
