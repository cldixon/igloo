package cmd

import (
	"fmt"

	"github.com/cl-dixon/igloo/cli/client"
	"github.com/cl-dixon/igloo/cli/config"
	"github.com/cl-dixon/igloo/cli/ui"
	"github.com/spf13/cobra"
)

var connectCmd = &cobra.Command{
	Use:   "connect <url>",
	Short: "Connect to an igloo instance",
	Args:  cobra.ExactArgs(1),
	RunE:  runConnect,
}

func init() {
	rootCmd.AddCommand(connectCmd)
}

func runConnect(cmd *cobra.Command, args []string) error {
	rawURL := args[0]
	apiURL := config.NormalizeURL(rawURL)

	// Test connectivity
	c := client.New(apiURL)
	_, err := c.Health()
	if err != nil {
		fmt.Println(ui.Warning.Render("⚠ Could not reach instance (saving anyway): ") + ui.Muted.Render(err.Error()))
	}

	cfg := config.Config{APIURL: apiURL}
	if err := config.Save(cfg); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	fmt.Println(ui.Success.Render("Connected to ") + ui.Accent.Render(apiURL))
	fmt.Println(ui.Muted.Render("Config saved to " + config.ConfigPath()))
	return nil
}
