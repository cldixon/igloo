package ui

import (
	"regexp"
	"strings"
	"testing"

	"github.com/cl-dixon/igloo/cli/client"
)

var ansiRegex = regexp.MustCompile(`\x1b\[[0-9;]*m`)

func stripANSI(s string) string {
	return ansiRegex.ReplaceAllString(s, "")
}

func TestRenderTree_Empty(t *testing.T) {
	listing := &client.DirectoryListing{
		Path:    "datasets/",
		Entries: []client.DirectoryEntry{},
	}

	got := stripANSI(RenderTree(listing))
	if !strings.Contains(got, "datasets/") {
		t.Error("expected path header")
	}
	if !strings.Contains(got, "(empty)") {
		t.Error("expected (empty) marker")
	}
}

func TestRenderTree_RootPath(t *testing.T) {
	listing := &client.DirectoryListing{
		Path:    "",
		Entries: []client.DirectoryEntry{},
	}

	got := stripANSI(RenderTree(listing))
	if !strings.Contains(got, "/") {
		t.Error("expected / for root path")
	}
}

func TestRenderTree_DirsOnly(t *testing.T) {
	listing := &client.DirectoryListing{
		Path: "data/",
		Entries: []client.DirectoryEntry{
			{Name: "census", Path: "data/census/", Type: "directory"},
			{Name: "weather", Path: "data/weather/", Type: "directory"},
		},
	}

	got := stripANSI(RenderTree(listing))
	if !strings.Contains(got, "├── census/") {
		t.Errorf("expected mid-branch for census, got:\n%s", got)
	}
	if !strings.Contains(got, "└── weather/") {
		t.Errorf("expected last-branch for weather, got:\n%s", got)
	}
}

func TestRenderTree_FilesOnly(t *testing.T) {
	size1 := int64(4500)
	size2 := int64(2100)
	mod1 := "2024-12-20T15:30:00Z"
	mod2 := "2025-01-10T08:00:00Z"

	listing := &client.DirectoryListing{
		Path: "data/",
		Entries: []client.DirectoryEntry{
			{Name: "iris.csv", Path: "data/iris.csv", Type: "file", Size: &size1, LastModified: &mod1},
			{Name: "README.md", Path: "data/README.md", Type: "file", Size: &size2, LastModified: &mod2},
		},
	}

	got := stripANSI(RenderTree(listing))
	if !strings.Contains(got, "iris.csv") {
		t.Error("expected iris.csv in output")
	}
	if !strings.Contains(got, "4.4 KB") {
		t.Errorf("expected formatted size, got:\n%s", got)
	}
	if !strings.Contains(got, "Dec 20, 2024") {
		t.Errorf("expected formatted date, got:\n%s", got)
	}
	if !strings.Contains(got, "└── README.md") {
		t.Errorf("expected last-branch for README.md, got:\n%s", got)
	}
}

func TestRenderTree_Mixed(t *testing.T) {
	size := int64(1048576)
	mod := "2025-01-15T12:00:00Z"

	listing := &client.DirectoryListing{
		Path: "root/",
		Entries: []client.DirectoryEntry{
			{Name: "subdir", Path: "root/subdir/", Type: "directory"},
			{Name: "data.parquet", Path: "root/data.parquet", Type: "file", Size: &size, LastModified: &mod},
		},
	}

	got := stripANSI(RenderTree(listing))
	if !strings.Contains(got, "├── subdir/") {
		t.Errorf("expected mid-branch for dir, got:\n%s", got)
	}
	if !strings.Contains(got, "└── data.parquet") {
		t.Errorf("expected last-branch for file, got:\n%s", got)
	}
	if !strings.Contains(got, "1.0 MB") {
		t.Errorf("expected size for file, got:\n%s", got)
	}
}
