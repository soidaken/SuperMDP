package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

// mustGBK encodes s as GBK bytes, failing the test on error.
func mustGBK(t *testing.T, s string) []byte {
	t.Helper()
	b, _, err := transform.String(simplifiedchinese.GBK.NewEncoder(), s)
	if err != nil {
		t.Fatalf("encode GBK: %v", err)
	}
	return []byte(b)
}

// writeTemp writes data to a temp file and returns its path.
func writeTemp(t *testing.T, data []byte) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "sample.md")
	if err := os.WriteFile(p, data, 0o644); err != nil {
		t.Fatalf("write temp file: %v", err)
	}
	return p
}

func TestReadFileUTF8WithBOM(t *testing.T) {
	app := &App{}
	content := []byte("\xEF\xBB\xBF# 标题\n\n正文内容")
	p := writeTemp(t, content)
	res, err := app.ReadFile(p)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	want := "# 标题\n\n正文内容"
	if res.Content != want {
		t.Errorf("Content = %q, want %q", res.Content, want)
	}
	if res.Encoding != "utf-8" {
		t.Errorf("Encoding = %q, want utf-8", res.Encoding)
	}
}

func TestReadFilePlainUTF8(t *testing.T) {
	app := &App{}
	p := writeTemp(t, []byte("# Hello\n"))
	res, err := app.ReadFile(p)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if res.Content != "# Hello\n" || res.Encoding != "utf-8" {
		t.Errorf("got (%q, %q)", res.Content, res.Encoding)
	}
}

func TestReadFileGBK(t *testing.T) {
	app := &App{}
	// 你好世界 in GBK — deliberately invalid UTF-8.
	p := writeTemp(t, mustGBK(t, "你好世界"))
	res, err := app.ReadFile(p)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if res.Content != "你好世界" {
		t.Errorf("Content = %q, want 你好世界", res.Content)
	}
	if res.Encoding != "gbk" {
		t.Errorf("Encoding = %q, want gbk", res.Encoding)
	}
}

func TestReadFileUTF16LE(t *testing.T) {
	app := &App{}
	u16 := []byte{0xFF, 0xFE}                 // UTF-16LE BOM
	u16 = append(u16, 0x60, 0x4F, 0x7D, 0x59) // "你好" LE
	p := writeTemp(t, u16)
	res, err := app.ReadFile(p)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if res.Content != "你好" {
		t.Errorf("Content = %q, want 你好", res.Content)
	}
	if res.Encoding != "utf-16le" {
		t.Errorf("Encoding = %q, want utf-16le", res.Encoding)
	}
}

func TestReadFileOverLimit(t *testing.T) {
	app := &App{}
	p := filepath.Join(t.TempDir(), "big.md")
	// Sparse file of maxFileSize+1 bytes: fast and cheap to create.
	if err := os.WriteFile(p, nil, 0o644); err != nil {
		t.Fatalf("create: %v", err)
	}
	f, err := os.OpenFile(p, os.O_WRONLY, 0o644)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := f.Truncate(maxFileSize + 1); err != nil {
		f.Close()
		t.Fatalf("truncate: %v", err)
	}
	f.Close()

	_, err = app.ReadFile(p)
	if err == nil {
		t.Fatal("expected error for file over 64 MiB, got nil")
	}
	if !strings.Contains(err.Error(), "64 MB") {
		t.Errorf("error = %q, want friendly 64 MB message", err.Error())
	}
}

func TestReadFileDirectory(t *testing.T) {
	app := &App{}
	_, err := app.ReadFile(t.TempDir())
	if err == nil {
		t.Fatal("expected error when reading a directory, got nil")
	}
}

func TestReadFileMissing(t *testing.T) {
	app := &App{}
	p := filepath.Join(t.TempDir(), "nope.md")
	if _, err := app.ReadFile(p); err == nil {
		t.Fatal("expected error for missing file, got nil")
	}
}

func TestGetFileInfo(t *testing.T) {
	app := &App{}
	p := writeTemp(t, []byte("hello"))
	info, err := app.GetFileInfo(p)
	if err != nil {
		t.Fatalf("GetFileInfo: %v", err)
	}
	if info.Name != "sample.md" {
		t.Errorf("Name = %q, want sample.md", info.Name)
	}
	if info.Size != 5 {
		t.Errorf("Size = %d, want 5", info.Size)
	}
	if info.ModTime == "" {
		t.Error("ModTime is empty")
	}
	if _, err := time.Parse(time.RFC3339, info.ModTime); err != nil {
		t.Errorf("ModTime %q is not RFC3339: %v", info.ModTime, err)
	}
}
