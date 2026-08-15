package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

// maxFileSize is the upper size limit (in bytes) for files opened with ReadFile.
const maxFileSize = 64 * 1024 * 1024 // 64 MiB

// mdExts 是支持作为"默认打开程序"的扩展名（跨平台，关联注册见 assoc_*.go）。
var mdExts = []string{".md", ".markdown", ".mdown"}

// App struct
type App struct {
	ctx context.Context

	// startupFile 是启动时通过命令行传入的待打开文件（双击关联打开时）。
	startupFile string

	// File watcher state, managed in watcher.go.
	watchMu sync.Mutex
	watch   *watcherState
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 记录命令行传入的 Markdown 文件（注册为默认打开程序后，双击 .md 即进入此路径）
	for _, arg := range os.Args[1:] {
		if isMarkdownExt(arg) {
			a.startupFile = arg
			break
		}
	}

	// 启动时静默刷新文件关联（幂等；exe 路径变化时自动更新）
	_, _ = a.RegisterAssociations()
}

// isMarkdownExt 判断路径是否带受支持的 Markdown 扩展名。
func isMarkdownExt(p string) bool {
	ext := strings.ToLower(filepath.Ext(p))
	for _, e := range mdExts {
		if ext == e {
			return true
		}
	}
	return false
}

// GetStartupFile 返回启动时通过命令行传入的 Markdown 文件路径（无则返回空串）。
// 前端启动后调用它来打开"双击 .md 文件"进入的文件。
func (a *App) GetStartupFile() string {
	return a.startupFile
}

// SetZoomPref 保存页面缩放偏好（百分比），下次启动生效（WebView2 ZoomFactor）。
func (a *App) SetZoomPref(pct int) error {
	return SaveZoom(pct)
}

// shutdown stops any running file watcher so no events are emitted
// while the application is tearing down.
func (a *App) shutdown(ctx context.Context) {
	a.StopWatch()
}

// ReadResult is returned by ReadFile. Content is always a single
// decoded UTF-8 string; Encoding tells the frontend which conversion
// was applied.
type ReadResult struct {
	// Content is the decoded file content as a UTF-8 string.
	Content string
	// Encoding is one of "utf-8", "gbk", "utf-16le", "utf-16be" or "unknown".
	Encoding string
}

// FileInfo is returned by GetFileInfo for the status bar.
type FileInfo struct {
	Name string
	Size int64
	// ModTime is the file modification time formatted as RFC3339
	// (local time), ready to display or parse on the frontend.
	ModTime string
}

// OpenFileDialog shows the native "open file" dialog (owned by the main
// window) filtered to Markdown-like documents. It returns the selected
// absolute path, or an empty string when the user cancels.
func (a *App) OpenFileDialog() (string, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "打开 Markdown 文件",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Markdown 文件 (*.md;*.markdown;*.txt;*.mdown)",
				Pattern:     "*.md;*.markdown;*.txt;*.mdown",
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("打开文件对话框失败: %w", err)
	}
	return path, nil
}

// ReadFile reads the file at path and returns its decoded content.
//
//   - UTF-8 is the primary encoding; a UTF-8 BOM is stripped.
//   - UTF-16 files with a BOM are decoded accordingly.
//   - Non-UTF-8 content (e.g. legacy GBK) is converted to UTF-8.
//   - If no conversion applies the raw bytes are returned with
//     Encoding set to "unknown".
//   - Files larger than 64 MiB are rejected with a friendly error.
func (a *App) ReadFile(path string) (*ReadResult, error) {
	if strings.TrimSpace(path) == "" {
		return nil, errors.New("文件路径为空")
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("无法访问文件: %w", err)
	}
	if info.IsDir() {
		return nil, errors.New("该路径是一个目录，请选择一个文件")
	}
	if info.Size() > maxFileSize {
		return nil, fmt.Errorf("文件大小 %.1f MB，超过 64 MB 上限", float64(info.Size())/(1024*1024))
	}

	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("无法打开文件: %w", err)
	}
	defer f.Close()

	// Read at most maxFileSize+1 bytes so a file that grew past the
	// limit while being read is still caught.
	content, err := io.ReadAll(io.LimitReader(f, maxFileSize+1))
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}
	if len(content) > maxFileSize {
		return nil, errors.New("文件超过 64 MB 上限")
	}

	// Strip a UTF-8 BOM.
	content = bytes.TrimPrefix(content, []byte{0xEF, 0xBB, 0xBF})

	// UTF-16 with BOM (checked before utf8.Valid because UTF-16LE byte
	// pairs can occasionally form valid UTF-8 sequences).
	if bytes.HasPrefix(content, []byte{0xFF, 0xFE}) {
		return &ReadResult{Content: decodeUTF16(content[2:], true), Encoding: "utf-16le"}, nil
	}
	if bytes.HasPrefix(content, []byte{0xFE, 0xFF}) {
		return &ReadResult{Content: decodeUTF16(content[2:], false), Encoding: "utf-16be"}, nil
	}

	if utf8.Valid(content) {
		return &ReadResult{Content: string(content), Encoding: "utf-8"}, nil
	}

	// Invalid UTF-8: try GBK, the most common legacy Chinese encoding.
	if decoded, _, err := transform.String(simplifiedchinese.GBK.NewDecoder(), string(content)); err == nil {
		return &ReadResult{Content: decoded, Encoding: "gbk"}, nil
	}

	// Last resort: hand the raw bytes back and let the frontend decide.
	return &ReadResult{Content: string(content), Encoding: "unknown"}, nil
}

// GetFileInfo returns basic file metadata for the status bar.
func (a *App) GetFileInfo(path string) (*FileInfo, error) {
	if strings.TrimSpace(path) == "" {
		return nil, errors.New("文件路径为空")
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("无法获取文件信息: %w", err)
	}
	if info.IsDir() {
		return nil, errors.New("该路径是一个目录")
	}
	return &FileInfo{Name: info.Name(), Size: info.Size(), ModTime: info.ModTime().Format(time.RFC3339)}, nil
}

// decodeUTF16 decodes a UTF-16 byte sequence (without BOM) into a string.
func decodeUTF16(content []byte, littleEndian bool) string {
	u16 := make([]uint16, 0, len(content)/2)
	for i := 0; i+1 < len(content); i += 2 {
		if littleEndian {
			u16 = append(u16, uint16(content[i])|uint16(content[i+1])<<8)
		} else {
			u16 = append(u16, uint16(content[i])<<8|uint16(content[i+1]))
		}
	}
	return string(utf16.Decode(u16))
}
