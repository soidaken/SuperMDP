package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

// 用户配置（%APPDATA%\SuperMDP\config.json）：
// 页面缩放使用 WebView2 原生 ZoomFactor（系统级，滚动行为完全正确），
// 由前端通过 SetZoomPref 写入，应用启动时读取生效（重启生效）。

const defaultZoomPct = 125

type appConfig struct {
	// Zoom 是页面缩放百分比（100 / 125 / 150 …），对应 WebView2 ZoomFactor。
	Zoom int `json:"zoom"`
}

func configPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	appDir := filepath.Join(dir, "SuperMDP")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(appDir, "config.json"), nil
}

// LoadZoom 读取页面缩放百分比（默认 125）。
func LoadZoom() int {
	path, err := configPath()
	if err != nil {
		return defaultZoomPct
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return defaultZoomPct
	}
	var cfg appConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return defaultZoomPct
	}
	if cfg.Zoom < 50 || cfg.Zoom > 200 {
		return defaultZoomPct
	}
	return cfg.Zoom
}

// SaveZoom 写入页面缩放百分比。
func SaveZoom(pct int) error {
	if pct < 50 || pct > 200 {
		return errors.New("缩放比例需在 50%~200% 之间")
	}
	path, err := configPath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(appConfig{Zoom: pct}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
