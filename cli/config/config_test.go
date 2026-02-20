package config

import (
	"os"
	"testing"
)

func TestNormalizeURL(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"https://example.com", "https://example.com"},
		{"https://example.com/", "https://example.com"},
		{"https://example.com///", "https://example.com"},
		{"http://example.com", "http://example.com"},
		{"http://example.com/", "http://example.com"},
		{"example.com", "https://example.com"},
		{"example.com/", "https://example.com"},
		{"  https://example.com  ", "https://example.com"},
		{"", ""},
	}
	for _, tt := range tests {
		got := NormalizeURL(tt.input)
		if got != tt.want {
			t.Errorf("NormalizeURL(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestSaveAndLoad(t *testing.T) {
	dir := t.TempDir()
	SetConfigDir(dir)
	defer SetConfigDir("")

	cfg := Config{APIURL: "https://example.com"}
	if err := Save(cfg); err != nil {
		t.Fatalf("Save() error: %v", err)
	}

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if loaded.APIURL != cfg.APIURL {
		t.Errorf("Load().APIURL = %q, want %q", loaded.APIURL, cfg.APIURL)
	}
}

func TestLoadMissingFile(t *testing.T) {
	dir := t.TempDir()
	SetConfigDir(dir)
	defer SetConfigDir("")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if cfg.APIURL != "" {
		t.Errorf("Load().APIURL = %q, want empty", cfg.APIURL)
	}
}

func TestResolveAPIURL_Flag(t *testing.T) {
	dir := t.TempDir()
	SetConfigDir(dir)
	defer SetConfigDir("")

	// Save a config value that should be overridden
	Save(Config{APIURL: "https://from-config.com"})
	t.Setenv("IGLOO_API_URL", "https://from-env.com")

	got, err := ResolveAPIURL("https://from-flag.com")
	if err != nil {
		t.Fatalf("ResolveAPIURL() error: %v", err)
	}
	if got != "https://from-flag.com" {
		t.Errorf("got %q, want flag value", got)
	}
}

func TestResolveAPIURL_Env(t *testing.T) {
	dir := t.TempDir()
	SetConfigDir(dir)
	defer SetConfigDir("")

	Save(Config{APIURL: "https://from-config.com"})
	t.Setenv("IGLOO_API_URL", "https://from-env.com")

	got, err := ResolveAPIURL("")
	if err != nil {
		t.Fatalf("ResolveAPIURL() error: %v", err)
	}
	if got != "https://from-env.com" {
		t.Errorf("got %q, want env value", got)
	}
}

func TestResolveAPIURL_Config(t *testing.T) {
	dir := t.TempDir()
	SetConfigDir(dir)
	defer SetConfigDir("")

	Save(Config{APIURL: "https://from-config.com"})
	os.Unsetenv("IGLOO_API_URL")

	got, err := ResolveAPIURL("")
	if err != nil {
		t.Fatalf("ResolveAPIURL() error: %v", err)
	}
	if got != "https://from-config.com" {
		t.Errorf("got %q, want config value", got)
	}
}

func TestResolveAPIURL_None(t *testing.T) {
	dir := t.TempDir()
	SetConfigDir(dir)
	defer SetConfigDir("")

	os.Unsetenv("IGLOO_API_URL")

	_, err := ResolveAPIURL("")
	if err == nil {
		t.Fatal("expected error when no URL configured")
	}
}
