# Development & Release Process

## Continuous Integration

This project uses GitHub Actions for CI/CD.

### Workflows

1.  **Release**: Triggered when a new tag starting with `v` is pushed (e.g., `v1.0.0`).
    -   Runs tests.
    -   Builds all executables using `build.ts`.
    -   Creates a GitHub Release.
    -   Uploads the executables as release assets.

## How to Release

To create a new release:

1.  Update the version in `package.json`.
2.  Commit the change.
3.  Tag the commit:
    ```bash
    git tag v1.0.0
    ```
4.  Push the tag:
    ```bash
    git push origin v1.0.0
    ```

The GitHub Action will automatically build and publish the release.
