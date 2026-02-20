package cmd

import (
	"fmt"

	"github.com/charmbracelet/glamour"
	"github.com/cl-dixon/igloo/cli/ui"
	"github.com/spf13/cobra"
)

var lsCmd = &cobra.Command{
	Use:   "ls [path]",
	Short: "List directory contents",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runLs,
}

func init() {
	rootCmd.AddCommand(lsCmd)
}

func runLs(cmd *cobra.Command, args []string) error {
	c, err := APIClient()
	if err != nil {
		return err
	}

	path := ""
	if len(args) > 0 {
		path = args[0]
	}

	listing, err := c.List(path)
	if err != nil {
		return fmt.Errorf("failed to list: %w", err)
	}

	fmt.Println(ui.RenderTree(listing))

	if listing.Readme != nil && *listing.Readme != "" {
		fmt.Println()
		renderer, err := glamour.NewTermRenderer(
			glamour.WithAutoStyle(),
			glamour.WithWordWrap(80),
		)
		if err == nil {
			rendered, err := renderer.Render(*listing.Readme)
			if err == nil {
				fmt.Print(rendered)
			}
		}
	}

	return nil
}
