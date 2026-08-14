package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// watchEventCoalesceWindow is how long fsnotify events are coalesced
// (debounced) before a single "file:changed" event is emitted.
const watchEventCoalesceWindow = 300 * time.Millisecond

// fileChangedEvent is the event name emitted to the frontend.
const fileChangedEvent = "file:changed"

// watcherState tracks one running watch loop. The loop goroutine owns
// the fsnotify.Watcher it runs for and is its only closer; stopping a
// loop means cancelling its context and waiting for its done channel.
type watcherState struct {
	stop context.CancelFunc
	done chan struct{}
}

// WatchFile starts (or restarts) watching the directory containing path.
// Every Write/Remove/Rename touching path is coalesced over a 300ms
// window and emitted to the frontend as a "file:changed" event carrying
// {"path": <absolute path>, "op": "write"|"remove"|"rename"}. Any
// previously running watcher is stopped first, so switching files is
// just another call to WatchFile.
func (a *App) WatchFile(path string) error {
	if strings.TrimSpace(path) == "" {
		return fmt.Errorf("文件路径为空")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("无法解析文件路径: %w", err)
	}
	if _, err := os.Stat(abs); err != nil {
		return fmt.Errorf("无法访问文件: %w", err)
	}
	dir := filepath.Dir(abs)

	w, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("创建文件监视器失败: %w", err)
	}
	if err := w.Add(dir); err != nil {
		w.Close()
		return fmt.Errorf("无法监视目录 %q: %w", dir, err)
	}

	// Stop any previous watcher before starting the new one.
	a.stopWatcher()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})

	a.watchMu.Lock()
	if a.watch == nil {
		a.watch = &watcherState{}
	}
	a.watch.stop = cancel
	a.watch.done = done
	a.watchMu.Unlock()

	go a.watchLoop(ctx, w, abs, done)
	return nil
}

// StopWatch stops the current file watcher, if any.
func (a *App) StopWatch() {
	a.stopWatcher()
}

// stopWatcher cancels the running watch loop (if any) and waits for it
// to fully stop, so no stale events fire after switching files.
func (a *App) stopWatcher() {
	a.watchMu.Lock()
	ws := a.watch
	if ws == nil || ws.stop == nil {
		a.watchMu.Unlock()
		return
	}
	stop, done := ws.stop, ws.done
	ws.stop, ws.done = nil, nil
	a.watchMu.Unlock()

	stop()
	<-done // the loop never takes watchMu, so this cannot deadlock
}

// watchLoop consumes fsnotify events for target until ctx is cancelled
// or the watcher is closed, coalescing events over a 300ms window.
func (a *App) watchLoop(ctx context.Context, w *fsnotify.Watcher, target string, done chan<- struct{}) {
	defer close(done)
	defer w.Close()

	var mu sync.Mutex
	var pending bool
	var pendingOp string

	emit := func() {
		if ctx.Err() != nil {
			return // stale timer from a stopped watch
		}
		mu.Lock()
		if !pending {
			mu.Unlock()
			return
		}
		pending = false
		op := pendingOp
		pendingOp = ""
		mu.Unlock()
		runtime.EventsEmit(a.ctx, fileChangedEvent, map[string]string{
			"path": target,
			"op":   op,
		})
	}

	var timer *time.Timer
	for {
		select {
		case <-ctx.Done():
			if timer != nil {
				timer.Stop()
			}
			return
		case ev, ok := <-w.Events:
			if !ok {
				return
			}
			if !sameFilePath(ev.Name, target) {
				continue
			}
			op := eventOp(ev.Op)
			if op == "" {
				continue
			}
			// Last op wins within the coalescing window: a remove
			// followed by a quick recreate (atomic save) reads back as
			// "write", while a real delete stays "remove".
			mu.Lock()
			pending = true
			pendingOp = op
			mu.Unlock()
			if timer == nil {
				timer = time.AfterFunc(watchEventCoalesceWindow, emit)
			} else {
				timer.Reset(watchEventCoalesceWindow)
			}
		case err, ok := <-w.Errors:
			if !ok {
				return
			}
			runtime.LogDebug(a.ctx, "file watcher: "+err.Error())
		}
	}
}

// sameFilePath reports whether an fsnotify event name refers to the
// watched file. Comparison is case-insensitive, which matters on
// Windows (NTFS is case-insensitive).
func sameFilePath(eventName, target string) bool {
	return strings.EqualFold(filepath.Clean(eventName), filepath.Clean(target))
}

// eventOp maps an fsnotify op to the frontend-facing op string.
// Create is folded into "write" because on Windows editors commonly
// save via temp-file rename, which fsnotify reports as Create+Write.
func eventOp(op fsnotify.Op) string {
	switch {
	case op.Has(fsnotify.Remove):
		return "remove"
	case op.Has(fsnotify.Rename):
		return "rename"
	case op.Has(fsnotify.Write):
		return "write"
	case op.Has(fsnotify.Create):
		return "write"
	default:
		return ""
	}
}
