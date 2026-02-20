# Igloo Development Notes

This repository will develop a prototype application called "igloo".

An "igloo" will be a web deployed, personal data repository, intended for machine learning, data engineering and analytics use cases. Individuals will be able to easily deploy their own data repos to the web, enabling the following:

- A web UI interface for data access, download, management, querying, visualization and more 
- A standard REST API for programmatically accessing the data 
- An Iceberg Catalog API for querying datasets stored as parquet and CSV via SQL
- A CLI for managing the igloo instance and data (later)
- The ability to share datasets, grant access to users, etc.
- Built-in with the AT Protocol ecosystem, to allow publicizing and sharing of dataset with others 

## Initial MVP

To start, we will create an MVP for myself only. Here is the idea:

- Store the data in Cloudflare R2 storage
- Develop a REST API to interface with the R2 storage layer 
- Build a web UI app via Svelte which provides a visual interface for seeing the available datasets 
- Deploy both the API and the web UI via Railway


## Design and Usage 

For the initial web app UI, we want to model after the classic Tomcat and NGINX server pages (when there was no `index.html`), which were popular for a time in the Machine Learning community for sharing datasets. Think the UC Irvine data repo. But, we want to give the look a modern facelift, using cooler fonts, icons, styling and interactivity.
