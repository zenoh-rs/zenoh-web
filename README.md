# Eclipse zenoh's Website

The website for the Eclipse zenoh project. Lives at [http://zenoh.io](https://zenoh.io).

## Getting Started

### Using Dev Container (Recommended)

The easiest way to develop the Zenoh web documentation is using VS Code Dev Containers, which provides a consistent development environment without installing Hugo locally.

**Prerequisites:**

- [Docker](https://www.docker.com/get-started) installed and running
- [Visual Studio Code](https://code.visualstudio.com/)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) for VS Code

**Steps:**

1. Open this repository in VS Code
2. When prompted, click "Reopen in Container" (or press F1 and select "Dev Containers: Reopen in Container")
3. VS Code will build the Docker container and set up the development environment
4. Once ready, run the development server:

   ```bash
   hugo server
   ```

5. Visit [http://localhost:1313](http://localhost:1313)

### Local Hugo Installation

The website should build with the latest version of Hugo, the last tested is [Hugo 0.145.0](http://gohugo.io). 
On MacOS you can install Hugo as described below, in any case refer to [Hugo Documentation](http://gohugo.io) 
for installation instructioins

```sh
brew update && brew install hugo
```

Then, get the website running locally:

```sh
git clone https://github.com/atolab/zenoh-web
cd zenoh-web
hugo server
```

Then visit [http://localhost:1313](http://localhost:1313).

### Using Docker Directly

If you prefer to use Docker without VS Code:

```bash
# Build the Docker image
docker build -f docker/Dockerfile --build-arg user=$(id -un) --build-arg uid=$(id -u) -t zenoh_web .

# Run the development server
docker run --rm -v $(pwd):/src -p 1313:1313 zenoh_web
```

## Development

### Spell Check

This project uses [codespell](https://github.com/codespell-project/codespell) to automatically check for common spelling errors in documentation.
The spell check is initiated and verified on every pull request via [GitHub Actions workflow](.github/workflows/codespell.yml).

- [codespell.cfg](codespell.cfg) - Main configuration that defines dictionaries, ignore patterns, and skip directories
- [codespell_whitelist.txt](codespell_whitelist.txt) - Words to ignore (e.g., technical terms, Zenoh release names like "aithusa", "bahamut")
- [codespell_dictionary.txt](codespell_dictionary.txt) - Custom corrections for common typos (e.g., `colcn->colcon`, `rosabg->rosbag`)

## License

This project is licensed under the [Eclipse Public License 2.0](LICENSE)
or the [Apache License 2.0](LICENSE).

## Credits

This website design is inspired from the [tokio-rs website](https://github.com/tokio-rs/website)
which is licensed under [MIT License](LICENSE-tokio-rs).
