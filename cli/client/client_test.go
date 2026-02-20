package client

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealth(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(HealthResponse{Status: "ok"})
	}))
	defer srv.Close()

	c := New(srv.URL)
	resp, err := c.Health()
	if err != nil {
		t.Fatalf("Health() error: %v", err)
	}
	if resp.Status != "ok" {
		t.Errorf("Status = %q, want %q", resp.Status, "ok")
	}
}

func TestList(t *testing.T) {
	size := int64(4500)
	modified := "2024-12-20T15:30:00.000Z"
	ext := "csv"
	readme := "# Hello"

	listing := DirectoryListing{
		Path: "datasets/",
		Entries: []DirectoryEntry{
			{Name: "census", Path: "datasets/census/", Type: "directory"},
			{Name: "iris.csv", Path: "datasets/iris.csv", Type: "file", Size: &size, LastModified: &modified, Extension: &ext},
		},
		Readme: &readme,
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/list" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("path"); got != "datasets/" {
			t.Errorf("path param = %q, want %q", got, "datasets/")
		}
		json.NewEncoder(w).Encode(listing)
	}))
	defer srv.Close()

	c := New(srv.URL)
	got, err := c.List("datasets/")
	if err != nil {
		t.Fatalf("List() error: %v", err)
	}
	if got.Path != "datasets/" {
		t.Errorf("Path = %q, want %q", got.Path, "datasets/")
	}
	if len(got.Entries) != 2 {
		t.Fatalf("len(Entries) = %d, want 2", len(got.Entries))
	}
	if got.Entries[0].Type != "directory" {
		t.Errorf("Entries[0].Type = %q, want %q", got.Entries[0].Type, "directory")
	}
	if got.Entries[1].Type != "file" {
		t.Errorf("Entries[1].Type = %q, want %q", got.Entries[1].Type, "file")
	}
	if *got.Entries[1].Size != 4500 {
		t.Errorf("Entries[1].Size = %d, want 4500", *got.Entries[1].Size)
	}
	if got.Readme == nil || *got.Readme != "# Hello" {
		t.Errorf("Readme = %v, want %q", got.Readme, "# Hello")
	}
}

func TestListEmptyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.RawQuery != "" {
			t.Errorf("expected no query params, got %q", r.URL.RawQuery)
		}
		json.NewEncoder(w).Encode(DirectoryListing{Path: "", Entries: []DirectoryEntry{}})
	}))
	defer srv.Close()

	c := New(srv.URL)
	got, err := c.List("")
	if err != nil {
		t.Fatalf("List() error: %v", err)
	}
	if len(got.Entries) != 0 {
		t.Errorf("len(Entries) = %d, want 0", len(got.Entries))
	}
}

func TestMetadata(t *testing.T) {
	etag := "\"abc123\""
	meta := FileMetadata{
		Name:         "iris.csv",
		Path:         "datasets/iris.csv",
		Size:         4500,
		LastModified: "2024-12-20T15:30:00.000Z",
		ContentType:  "text/csv",
		ETag:         &etag,
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/metadata" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(meta)
	}))
	defer srv.Close()

	c := New(srv.URL)
	got, err := c.Metadata("datasets/iris.csv")
	if err != nil {
		t.Fatalf("Metadata() error: %v", err)
	}
	if got.Name != "iris.csv" {
		t.Errorf("Name = %q, want %q", got.Name, "iris.csv")
	}
	if got.Size != 4500 {
		t.Errorf("Size = %d, want 4500", got.Size)
	}
	if got.ETag == nil || *got.ETag != "\"abc123\"" {
		t.Errorf("ETag = %v, want %q", got.ETag, "\"abc123\"")
	}
}

func TestDownload(t *testing.T) {
	body := "file content here"

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/download" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(body))
	}))
	defer srv.Close()

	c := New(srv.URL)
	var buf bytes.Buffer
	if err := c.Download("test.txt", &buf); err != nil {
		t.Fatalf("Download() error: %v", err)
	}
	if buf.String() != body {
		t.Errorf("body = %q, want %q", buf.String(), body)
	}
}

func TestNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "File not found"})
	}))
	defer srv.Close()

	c := New(srv.URL)

	_, err := c.Health()
	if err == nil {
		t.Fatal("expected error for 404")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("error = %q, want it to contain 'not found'", err.Error())
	}
}

func TestServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal error"))
	}))
	defer srv.Close()

	c := New(srv.URL)

	_, err := c.List("")
	if err == nil {
		t.Fatal("expected error for 500")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("error = %q, want it to contain '500'", err.Error())
	}
}
