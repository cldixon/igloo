package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/cl-dixon/igloo/cli/client"
)

const (
	branchMid  = "├── "
	branchLast = "└── "
)

func RenderTree(listing *client.DirectoryListing) string {
	var b strings.Builder

	// Header: current path
	pathLabel := "/"
	if listing.Path != "" {
		pathLabel = listing.Path
	}
	b.WriteString(Accent.Bold(true).Render(pathLabel))
	b.WriteString("\n")

	if len(listing.Entries) == 0 {
		b.WriteString(Muted.Render("  (empty)"))
		return b.String()
	}

	// Pre-compute max name width for column alignment
	maxNameWidth := 0
	for _, e := range listing.Entries {
		name := e.Name
		if e.Type == "directory" {
			name += "/"
		}
		w := lipgloss.Width(name)
		if w > maxNameWidth {
			maxNameWidth = w
		}
	}

	sizeColWidth := 10
	last := len(listing.Entries) - 1

	for i, e := range listing.Entries {
		prefix := branchMid
		if i == last {
			prefix = branchLast
		}

		name := e.Name
		if e.Type == "directory" {
			name += "/"
		}

		// Styled components
		styledPrefix := TreeBranch.Render(prefix)
		var styledName string
		if e.Type == "directory" {
			styledName = DirName.Render(name)
		} else {
			styledName = FileName.Render(name)
		}

		// Meta columns (only for files)
		var meta string
		if e.Type == "file" {
			padding := maxNameWidth - lipgloss.Width(name)
			if padding < 0 {
				padding = 0
			}

			var sizeStr, dateStr string
			if e.Size != nil {
				sizeStr = FormatBytes(*e.Size)
			}
			if e.LastModified != nil {
				dateStr = FormatDate(*e.LastModified)
			}

			// Right-align size within its column
			sizePadding := sizeColWidth - len(sizeStr)
			if sizePadding < 0 {
				sizePadding = 0
			}

			meta = fmt.Sprintf("%s%s%s   %s",
				strings.Repeat(" ", padding+3),
				strings.Repeat(" ", sizePadding),
				FileMeta.Render(sizeStr),
				FileMeta.Render(dateStr),
			)
		}

		b.WriteString(styledPrefix + styledName + meta + "\n")
	}

	return strings.TrimRight(b.String(), "\n")
}
