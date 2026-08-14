package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/fsnotify/fsnotify"
)

// waitEvent waits up to 5s for an event matching the given name and op
// on the watcher's event channel.
func waitEvent(t *testing.T, w *fsnotify.Watcher, name string, wantOp fsnotify.Op) fsnotify.Event {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case ev := <-w.Events:
			if ev.Name == name && ev.Op.Has(wantOp) {
				return ev
			}
			t.Logf("ignored event: %v", ev)
		case err := <-w.Errors:
			t.Fatalf("watcher error: %v", err)
		case <-time.After(50 * time.Millisecond):
		}
	}
	t.Fatalf("timed out waiting for %s op %v", name, wantOp)
	return fsnotify.Event{}
}

// TestFsnotifyWindowsProbe validates that the fsnotify Windows backend
// delivers Write/Remove/Rename events for a file inside a watched
// directory, which the file watcher relies on.
func TestFsnotifyWindowsProbe(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "doc.md")

	if err := os.WriteFile(target, []byte("v1"), 0o644); err != nil {
		t.Fatalf("create: %v", err)
	}

	w, err := fsnotify.NewWatcher()
	if err != nil {
		t.Fatalf("NewWatcher: %v", err)
	}
	defer w.Close()
	if err := w.Add(dir); err != nil {
		t.Fatalf("Add: %v", err)
	}

	// Write (may arrive as Write and/or Create on Windows).
	if err := os.WriteFile(target, []byte("v2"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	waitEvent(t, w, target, fsnotify.Write)

	// Rename target -> moved.md.
	moved := filepath.Join(dir, "moved.md")
	if err := os.Rename(target, moved); err != nil {
		t.Fatalf("rename: %v", err)
	}
	// On Windows the rename arrives on the old name.
	waitEvent(t, w, target, fsnotify.Rename)

	// Remove moved.md.
	if err := os.Remove(moved); err != nil {
		t.Fatalf("remove: %v", err)
	}
	waitEvent(t, w, moved, fsnotify.Remove)
}

func TestEventOpMapping(t *testing.T) {
	cases := []struct {
		op   fsnotify.Op
		want string
	}{
		{fsnotify.Write, "write"},
		{fsnotify.Create, "write"},
		{fsnotify.Create | fsnotify.Write, "write"},
		{fsnotify.Remove, "remove"},
		{fsnotify.Rename, "rename"},
		{fsnotify.Chmod, ""},
		{0, ""},
	}
	for _, c := range cases {
		if got := eventOp(c.op); got != c.want {
			t.Errorf("eventOp(%v) = %q, want %q", c.op, got, c.want)
		}
	}
}

func TestSameFilePath(t *testing.T) {
	target := `C:\docs\readme.md`
	if !sameFilePath(`c:\docs\readme.md`, target) {
		t.Error("case-insensitive match failed")
	}
	if sameFilePath(`C:\docs\other.md`, target) {
		t.Error("different file must not match")
	}
	if !sameFilePath(`C:\docs\.\readme.md`, target) {
		t.Error("clean path match failed")
	}
}
