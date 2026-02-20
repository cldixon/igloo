package cmd

import (
	"fmt"
	"time"

	"github.com/cl-dixon/igloo/cli/config"
	"github.com/cl-dixon/igloo/cli/ui"
	"github.com/spf13/cobra"
)

var healthCmd = &cobra.Command{
	Use:   "health",
	Short: "Check igloo API connectivity",
	Args:  cobra.NoArgs,
	RunE:  runHealth,
}

func init() {
	rootCmd.AddCommand(healthCmd)
}

func runHealth(cmd *cobra.Command, args []string) error {
	c, err := APIClient()
	if err != nil {
		return err
	}

	apiURL, _ := config.ResolveAPIURL(urlFlag)

	start := time.Now()
	resp, err := c.Health()
	latency := time.Since(start)

	if err != nil {
		fmt.Println(ui.Error.Render("✗ Health check failed"))
		fmt.Println(ui.Header.Render("  URL      ") + ui.Primary.Render(apiURL))
		fmt.Println(ui.Header.Render("  ERROR    ") + ui.Error.Render(err.Error()))
		return nil
	}

	fmt.Println(ui.Primary.Bold(true).Render("igloo health check"))
	fmt.Println()
	fmt.Println(ui.Header.Render("  STATUS   ") + ui.Success.Render(resp.Status))
	fmt.Println(ui.Header.Render("  URL      ") + ui.Primary.Render(apiURL))
	fmt.Println(ui.Header.Render("  LATENCY  ") + ui.Primary.Render(fmt.Sprintf("%dms", latency.Milliseconds())))
	return nil
}
