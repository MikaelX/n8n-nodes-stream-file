# Local Development Installation

This guide explains how to set up the Site to Site File Transfer node for local development with n8n.

## Quick Setup

Run the setup script from the n8n repository:

```bash
cd /path/to/n8n
./scripts/setup-site2site-link.sh
```

Or manually:

```bash
cd /path/to/n8n-nodes-site-to-site-file-transfer
yarn build
mkdir -p ~/.n8n/custom
rm -rf ~/.n8n/custom/n8n-nodes-site-to-site-file-transfer
ln -sfn "$(pwd)/dist" ~/.n8n/custom/n8n-nodes-site-to-site-file-transfer
```

## Development Workflow

### Option 1: Watch Mode (Recommended)

1. **Build and link the node:**
   ```bash
   cd /path/to/n8n-nodes-site-to-site-file-transfer
   yarn build
   ./scripts/setup-link.sh  # or use the n8n script
   ```

2. **Start watch mode:**
   ```bash
   yarn build:watch
   ```

3. **Start n8n with hot reload:**
   ```bash
   cd /path/to/n8n/packages/cli
   N8N_DEV_RELOAD=true pnpm dev
   ```

Now any changes you make will automatically rebuild and n8n will reload the node.

### Option 2: Manual Rebuild

1. **Build and link:**
   ```bash
   cd /path/to/n8n-nodes-site-to-site-file-transfer
   yarn build
   ./scripts/setup-link.sh
   ```

2. **Start n8n:**
   ```bash
   cd /path/to/n8n/packages/cli
   pnpm dev
   ```

3. **When you make changes:**
   - Rebuild: `yarn build`
   - Restart n8n or wait for auto-reload (if `N8N_DEV_RELOAD=true`)

## How It Works

n8n automatically loads community nodes from `~/.n8n/custom/` directory. The symlink approach:

- Points directly to your `dist/` folder
- Automatically picks up changes when you rebuild
- Works with n8n's hot reload feature
- No need to reinstall or restart n8n (with hot reload enabled)

## Environment Variables

- `N8N_DEV_RELOAD=true` - Enables hot reload in n8n (recommended for development)
- `N8N_CUSTOM_EXTENSIONS` - Alternative custom extension path (semicolon-separated)

## Verifying Installation

1. Start n8n
2. Create a new workflow
3. Click "Add Node"
4. Search for "Site to Site File Transfer"
5. The node should appear in the results

## Troubleshooting

### Node Not Appearing

- Check that the symlink exists: `ls -la ~/.n8n/custom/n8n-nodes-site-to-site-file-transfer`
- Verify the dist folder has the node: `ls -la ~/.n8n/custom/n8n-nodes-site-to-site-file-transfer/nodes/`
- Check n8n logs for errors
- Ensure `N8N_DEV_RELOAD=true` is set if using hot reload

### Changes Not Reflecting

- Rebuild the node: `yarn build`
- Check that the symlink points to the correct dist folder
- Restart n8n if hot reload isn't working
- Check n8n console for reload messages

### Build Errors

- Run typecheck: `yarn typecheck`
- Run lint: `yarn lint`
- Check for TypeScript errors
