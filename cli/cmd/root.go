package cmd

import (
	"github.com/cl-dixon/igloo/cli/client"
	"github.com/cl-dixon/igloo/cli/config"
	"github.com/spf13/cobra"
)

var urlFlag string

var rootCmd = &cobra.Command{
	Use:   "igloo",
	Short: "CLI for igloo personal data repositories",
	Long:  "igloo is a CLI for browsing and downloading data from igloo instances.",
}

func init() {
	rootCmd.PersistentFlags().StringVar(&urlFlag, "url", "", "igloo API URL (overrides env and config)")
}

func Execute() error {
	return rootCmd.Execute()
}

func APIClient() (*client.Client, error) {
	apiURL, err := config.ResolveAPIURL(urlFlag)
	if err != nil {
		return nil, err
	}
	return client.New(apiURL), nil
}
