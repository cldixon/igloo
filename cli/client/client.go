package client

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type DirectoryEntry struct {
	Name         string  `json:"name"`
	Path         string  `json:"path"`
	Type         string  `json:"type"`
	Size         *int64  `json:"size,omitempty"`
	LastModified *string `json:"lastModified,omitempty"`
	Extension    *string `json:"extension,omitempty"`
}

type DirectoryListing struct {
	Path    string           `json:"path"`
	Entries []DirectoryEntry `json:"entries"`
	Readme  *string          `json:"readme,omitempty"`
}

type FileMetadata struct {
	Name         string  `json:"name"`
	Path         string  `json:"path"`
	Size         int64   `json:"size"`
	LastModified string  `json:"lastModified"`
	ContentType  string  `json:"contentType"`
	ETag         *string `json:"etag,omitempty"`
}

type HealthResponse struct {
	Status string `json:"status"`
}

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) doJSON(endpoint string, params url.Values, target interface{}) error {
	u := c.BaseURL + endpoint
	if len(params) > 0 {
		u += "?" + params.Encode()
	}
	resp, err := c.HTTPClient.Get(u)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("not found")
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}
	return json.NewDecoder(resp.Body).Decode(target)
}

func (c *Client) List(path string) (*DirectoryListing, error) {
	params := url.Values{}
	if path != "" {
		params.Set("path", path)
	}
	var listing DirectoryListing
	if err := c.doJSON("/api/list", params, &listing); err != nil {
		return nil, err
	}
	return &listing, nil
}

func (c *Client) Download(path string, dest io.Writer) error {
	params := url.Values{"path": {path}}
	u := c.BaseURL + "/api/download?" + params.Encode()

	resp, err := c.HTTPClient.Get(u)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("not found: %s", path)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	_, err = io.Copy(dest, resp.Body)
	return err
}

func (c *Client) Metadata(path string) (*FileMetadata, error) {
	params := url.Values{"path": {path}}
	var meta FileMetadata
	if err := c.doJSON("/api/metadata", params, &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

func (c *Client) Health() (*HealthResponse, error) {
	var health HealthResponse
	if err := c.doJSON("/health", nil, &health); err != nil {
		return nil, err
	}
	return &health, nil
}
