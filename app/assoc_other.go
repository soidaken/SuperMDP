//go:build !windows

package main

// RegisterAssociations 在非 Windows 平台不支持（文件关联是 Windows 特性）。
func (a *App) RegisterAssociations() (bool, string) {
	return false, "当前平台不支持文件关联设置"
}
