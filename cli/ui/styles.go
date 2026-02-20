package ui

import (
	"fmt"
	"time"

	"github.com/charmbracelet/lipgloss"
)

// Colors mirroring web/src/app.css [data-theme="dark"]
const (
	ColorBgPrimary     = "#0d1117"
	ColorBgSecondary   = "#161b22"
	ColorTextPrimary   = "#e6edf3"
	ColorTextSecondary = "#7d8590"
	ColorTextMuted     = "#484f58"
	ColorAccent        = "#58a6ff"
	ColorBorder        = "#30363d"
	ColorGreen         = "#3fb950"
	ColorRed           = "#f85149"
	ColorYellow        = "#d29922"
)

// Text styles
var (
	Primary   = lipgloss.NewStyle().Foreground(lipgloss.Color(ColorTextPrimary))
	Secondary = lipgloss.NewStyle().Foreground(lipgloss.Color(ColorTextSecondary))
	Muted     = lipgloss.NewStyle().Foreground(lipgloss.Color(ColorTextMuted))
	Accent    = lipgloss.NewStyle().Foreground(lipgloss.Color(ColorAccent))
	Success   = lipgloss.NewStyle().Foreground(lipgloss.Color(ColorGreen))
	Error     = lipgloss.NewStyle().Foreground(lipgloss.Color(ColorRed))
	Warning   = lipgloss.NewStyle().Foreground(lipgloss.Color(ColorYellow))

	// Tree listing styles
	DirName    = lipgloss.NewStyle().Foreground(lipgloss.Color(ColorAccent)).Bold(true)
	FileName   = lipgloss.NewStyle().Foreground(lipgloss.Color(ColorTextPrimary))
	TreeBranch = lipgloss.NewStyle().Foreground(lipgloss.Color(ColorBorder))
	FileMeta   = lipgloss.NewStyle().Foreground(lipgloss.Color(ColorTextSecondary))

	// Panel for info command
	Panel = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(ColorBorder)).
		Padding(1, 2)

	// Header labels (uppercase, secondary)
	Header = lipgloss.NewStyle().
		Foreground(lipgloss.Color(ColorTextSecondary)).
		Bold(true)
)

func FormatBytes(bytes int64) string {
	units := []string{"B", "KB", "MB", "GB", "TB"}
	size := float64(bytes)
	i := 0
	for size >= 1024 && i < len(units)-1 {
		size /= 1024
		i++
	}
	if i == 0 {
		return fmt.Sprintf("%d B", bytes)
	}
	return fmt.Sprintf("%.1f %s", size, units[i])
}

func FormatDate(iso string) string {
	t, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		t, err = time.Parse(time.RFC3339Nano, iso)
		if err != nil {
			return iso
		}
	}
	return t.Format("Jan 2, 2006")
}

func FormatDateTime(iso string) string {
	t, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		t, err = time.Parse(time.RFC3339Nano, iso)
		if err != nil {
			return iso
		}
	}
	return t.Format("Jan 2, 2006 15:04")
}
