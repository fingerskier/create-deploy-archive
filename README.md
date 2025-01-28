# create-deploy-archive
NodeJS script to create a deployable zip archive from it's containing directory


# Usage

```
npx create-deploy-archive
```

## Whitelist

You must provide a `.zipinclude` file in the root of the project. This file contains a list of files and directories to include in the archive.

```
*.js
*.pem
config.json
```
