package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/cl-dixon/igloo/cli/ui"
	"github.com/spf13/cobra"
)

var outputDir string

var getCmd = &cobra.Command{
	Use:   "get <path>",
	Short: "Download a file",
	Args:  cobra.ExactArgs(1),
	RunE:  runGet,
}

func init() {
	getCmd.Flags().StringVarP(&outputDir, "output", "o", ".", "output directory")
	rootCmd.AddCommand(getCmd)
}

func runGet(cmd *cobra.Command, args []string) error {
	c, err := APIClient()
	if err != nil {
		return err
	}

	remotePath := args[0]
	parts := strings.Split(remotePath, "/")
	filename := parts[len(parts)-1]
	if filename == "" {
		return fmt.Errorf("cannot download a directory — provide a file path")
	}

	localPath := filepath.Join(outputDir, filename)

	file, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	if err := c.Download(remotePath, file); err != nil {
		os.Remove(localPath)
		return fmt.Errorf("download failed: %w", err)
	}

	stat, err := os.Stat(localPath)
	if err != nil {
		return nil
	}

	fmt.Println(ui.Success.Render("Downloaded ") +
		ui.Primary.Render(filename) +
		ui.Secondary.Render(" ("+ui.FormatBytes(stat.Size())+")") +
		ui.Muted.Render(" → "+localPath))
	return nil
}
