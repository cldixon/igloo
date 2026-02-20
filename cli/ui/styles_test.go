package ui

import "testing"

func TestFormatBytes(t *testing.T) {
	tests := []struct {
		input int64
		want  string
	}{
		{0, "0 B"},
		{512, "512 B"},
		{1023, "1023 B"},
		{1024, "1.0 KB"},
		{1536, "1.5 KB"},
		{1048576, "1.0 MB"},
		{1572864, "1.5 MB"},
		{1073741824, "1.0 GB"},
		{1099511627776, "1.0 TB"},
	}
	for _, tt := range tests {
		got := FormatBytes(tt.input)
		if got != tt.want {
			t.Errorf("FormatBytes(%d) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestFormatDate(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"2024-12-20T15:30:00Z", "Dec 20, 2024"},
		{"2025-01-15T08:00:00.000Z", "Jan 15, 2025"},
		{"not-a-date", "not-a-date"},
	}
	for _, tt := range tests {
		got := FormatDate(tt.input)
		if got != tt.want {
			t.Errorf("FormatDate(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestFormatDateTime(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"2024-12-20T15:30:00Z", "Dec 20, 2024 15:30"},
		{"2025-01-15T08:05:00.000Z", "Jan 15, 2025 08:05"},
		{"bad-input", "bad-input"},
	}
	for _, tt := range tests {
		got := FormatDateTime(tt.input)
		if got != tt.want {
			t.Errorf("FormatDateTime(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
