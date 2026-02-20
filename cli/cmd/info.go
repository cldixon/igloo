package cmd

import (
	"fmt"
	"strings"

	"github.com/cl-dixon/igloo/cli/ui"
	"github.com/spf13/cobra"
)

var infoCmd = &cobra.Command{
	Use:   "info <path>",
	Short: "Show file metadata",
	Args:  cobra.ExactArgs(1),
	RunE:  runInfo,
}

func init() {
	rootCmd.AddCommand(infoCmd)
}

func runInfo(cmd *cobra.Command, args []string) error {
	c, err := APIClient()
	if err != nil {
		return err
	}

	meta, err := c.Metadata(args[0])
	if err != nil {
		return fmt.Errorf("failed to get metadata: %w", err)
	}

	labelWidth := 12
	rows := []struct {
		label string
		value string
	}{
		{"NAME", meta.Name},
		{"PATH", meta.Path},
		{"SIZE", ui.FormatBytes(meta.Size)},
		{"MODIFIED", ui.FormatDateTime(meta.LastModified)},
		{"TYPE", meta.ContentType},
	}
	if meta.ETag != nil {
		rows = append(rows, struct {
			label string
			value string
		}{"ETAG", *meta.ETag})
	}

	var lines []string
	for _, r := range rows {
		label := ui.Header.Render(fmt.Sprintf("%-*s", labelWidth, r.label))
		value := ui.Primary.Render(r.value)
		lines = append(lines, label+value)
	}

	content := strings.Join(lines, "\n")
	fmt.Println(ui.Panel.Render(content))
	return nil
}
