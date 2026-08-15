//go:build windows

package main

import (
	"fmt"
	"os"
	"strings"

	"golang.org/x/sys/windows/registry"
)

// progID 是本应用注册的 Windows 文件关联 ProgID。
const progID = "SuperMDP.Markdown"

// RegisterAssociations 把 .md/.markdown/.mdown 注册为本应用打开（HKCU，无需管理员）。
// 返回 (是否成功, 用户提示)。若系统 UserChoice 记录了其他程序，提示用户手动切换。
func (a *App) RegisterAssociations() (bool, string) {
	exe, err := os.Executable()
	if err != nil {
		return false, "无法获取程序路径，注册失败"
	}

	// ProgID：打开命令 + 图标
	command := fmt.Sprintf(`"%s" "%%1"`, exe)
	writeString(`Software\Classes\`+progID+`\shell\open\command`, "", command)
	writeString(`Software\Classes\`+progID+`\DefaultIcon`, "", `"`+exe+`",0`)

	// 扩展名默认关联
	for _, ext := range mdExts {
		writeString(`Software\Classes\`+ext, "", progID)
	}

	// 检查 UserChoice 冲突（用户曾在"打开方式"里把其他程序设为默认）
	conflicts := []string{}
	for _, ext := range mdExts {
		k, err := registry.OpenKey(
			registry.CURRENT_USER,
			`Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\`+ext+`\UserChoice`,
			registry.QUERY_VALUE,
		)
		if err != nil {
			continue
		}
		v, _, err := k.GetStringValue("ProgId")
		k.Close()
		if err == nil && v != "" && v != progID {
			name := strings.TrimPrefix(v, "Applications\\")
			conflicts = append(conflicts, ext+"("+name+")")
		}
	}
	if len(conflicts) > 0 {
		return true, "关联已注册，但系统默认打开方式仍被 " + strings.Join(conflicts, "、") +
			" 占用。请右键 .md 文件 → 打开方式 → 选择超级MD预览器 → 始终使用。"
	}
	return true, "已将 .md 文件默认打开方式设为超级MD预览器"
}

// writeString 写入 HKCU 注册表字符串值，忽略错误（尽力而为）。
func writeString(key, name, value string) {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, key, registry.WRITE)
	if err != nil {
		return
	}
	defer k.Close()
	_ = k.SetStringValue(name, value)
}
