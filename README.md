# n8n-nodes-stream-file-transfer

[![npm version](https://img.shields.io/npm/v/n8n-nodes-stream-file-transfer.svg)](https://www.npmjs.com/package/n8n-nodes-stream-file-transfer)
[![npm downloads](https://img.shields.io/npm/dm/n8n-nodes-stream-file-transfer.svg)](https://www.npmjs.com/package/n8n-nodes-stream-file-transfer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![GitHub](https://img.shields.io/github/stars/MikaelX/n8n-nodes-stream-file-transfer?style=social)](https://github.com/MikaelX/n8n-nodes-stream-file-transfer)

An n8n community node designed to **dramatically reduce memory usage** when transferring large files. Instead of loading entire files into memory (which can cause n8n to run out of memory with large files), this node streams files directly from a download URL to an upload URL using Node.js streams.

## Why This Node?

**Problem**: Standard n8n HTTP nodes load entire files into memory before uploading, which can cause:
- Memory exhaustion with large files (GB+)
- n8n crashes or timeouts
- Inability to transfer files larger than available RAM

**Solution**: This node uses streaming to transfer files with **constant memory usage** regardless of file size. Whether transferring a 10MB file or a 10GB file, memory usage remains minimal.

## Features

- **Memory Efficient**: Streams files directly without loading entire files into memory - **constant memory usage regardless of file size**
- **Large File Support**: Handles files of any size (GB+) without memory issues
- **Reduces n8n Memory Footprint**: Perfect for memory-constrained n8n instances
- **Flexible Authentication**: Supports bearer tokens in URL query strings or custom headers
- **Configurable**: Supports both POST and PUT methods, custom headers, and error handling
- **Automatic Content-Type Handling**: Prevents JSON parsing of binary responses
- **Buffer Support**: Automatically converts Buffer responses to streams when needed
- **TypeScript**: Full type safety and modern JavaScript features

## Installation

### Install from npm (Recommended)

```bash
npm install n8n-nodes-stream-file-transfer
# or
yarn add n8n-nodes-stream-file-transfer
```

After installation, restart your n8n instance. The node will be automatically available.

### Install from Local Path

```bash
# Build the node first
cd /path/to/n8n-nodes-stream-file-transfer
yarn build

# Install from local path
npm install /path/to/n8n-nodes-stream-file-transfer
# or
yarn add /path/to/n8n-nodes-stream-file-transfer

# Restart n8n
```

### Development Mode

For local development and testing:

```bash
# Clone the repository
git clone https://github.com/MikaelX/n8n-nodes-stream-file-transfer.git
cd n8n-nodes-stream-file-transfer

# Install dependencies
yarn install

# Build
yarn build

# Development mode (watch for changes)
yarn build:watch
```

## Quick Start

1. **Install the package** (see Installation above)
2. **Add the Node:**
   - Create a new workflow in n8n
   - Add the **Stream File Transfer** node
   - Configure the download and upload URLs
   - Execute the workflow

## UI Reference

The node configuration interface in n8n provides an intuitive way to configure file transfers:

![Stream File Transfer Node Configuration](docs/images/node-configuration.png)

**Configuration Panel Overview:**
- **Parameters Tab**: Configure download/upload URLs, headers, HTTP method, and error handling
- **Settings Tab**: Additional node-level settings
- **Execute Step**: Test the node configuration
- **Docs**: Access node documentation

**Key Parameters:**
- **Download URL**: Source file URL (supports n8n expressions like `{{ $json.download_url }}`)
- **Upload URL**: Destination URL (supports expressions and bearer tokens in query string)
- **Content Length**: Optional file size in bytes (auto-detected if not provided)
- **HTTP Method**: Choose between POST (default) or PUT
- **Download/Upload Headers**: JSON objects for custom headers
- **Throw Error on Non-2xx**: Toggle error handling behavior

## Usage

### Basic Transfer

1. Add the "Stream File Transfer" node to your workflow
2. Configure the parameters (see [UI Reference](#ui-reference) above for visual guide):
   - **Download URL**: The URL to download the file from (e.g., Google Cloud Storage signed URL)
   - **Upload URL**: The URL to upload the file to (e.g., your API endpoint)
3. Execute the workflow

**Tip**: You can use n8n expressions in the URL fields, for example:
- `{{ $json.download_url }}` - Use download URL from previous node
- `{{ $json.upload_url }}` - Use upload URL from previous node
- `{{ $json.filesize }}` - Use file size from previous node

The node will automatically:
- Stream the file from the download URL
- Transfer it directly to the upload URL
- Handle authentication headers
- Detect content length from response headers

### Advanced Configuration

#### Content Length
- **Optional**: File size in bytes
- If not provided, will be auto-detected from download response headers
- Can be manually specified for better control

#### HTTP Method
- **POST** (default): Standard HTTP POST request
- **PUT**: HTTP PUT request for RESTful APIs

#### Download Headers
JSON object with custom headers for the download request. Example:
```json
{
  "Authorization": "Bearer token123",
  "Custom-Header": "value"
}
```

#### Upload Headers
JSON object with custom headers for the upload request. Example:
```json
{
  "X-Custom-Header": "value",
  "Content-Type": "application/pdf"
}
```

**Note**: `Content-Type` defaults to `application/octet-stream` but can be overridden.

#### Throw Error on Non-2xx Status Codes
- **Enabled** (default): Node will throw an error and fail execution on 3xx, 4xx, or 5xx status codes
- **Disabled**: Node will return error information in the output instead of throwing

### Bearer Token Support

The node automatically extracts bearer tokens from upload URLs and adds them to the `Authorization` header.

**Example URL with bearer token:**
```
https://api.example.com/upload?bearer=eyJhbGciOiJIUzI1NiJ9...
```

The token will be:
- Extracted from the `bearer` query parameter
- Added to the `Authorization` header as `Bearer <token>`
- Kept in the URL query string (for APIs that require it there)

**Alternative**: Provide the bearer token directly in Upload Headers:
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9..."
}
```

## How It Works

The node uses Node.js streams to efficiently transfer files **without loading them into memory**:

1. **Download Request**: Uses native Node.js `http`/`https` modules to make a GET request to the download URL with `Accept: */*` header to prevent automatic JSON parsing
2. **Stream Processing**: Receives the response as a true Node.js stream (native HTTP always returns streams, never buffers)
3. **Upload Request**: Pipes the download stream directly to the upload URL using n8n's `helpers.request()` which correctly handles stream bodies
4. **Memory Efficient**: Files are never fully loaded into memory - only small chunks (typically 64KB) are buffered at a time

**Memory Usage Comparison:**
- **Standard n8n HTTP nodes**: Load entire file into memory (e.g., 5GB file = 5GB+ RAM usage)
- **This node**: Constant memory usage (~100KB-1MB) regardless of file size

### Technical Details

- Uses native Node.js `http`/`https` modules for downloads to ensure true streaming (not n8n's `helpers.request()`)
- Native HTTP always returns streams, guaranteeing no buffering even for large files
- Upload uses n8n's `helpers.request()` which correctly handles stream bodies
- Sets `Accept: */*` header on download requests to prevent automatic JSON parsing
- Provides detailed error messages when transfers fail

## Output

The node returns a JSON object with the following fields:

- `success`: Boolean indicating transfer success
- `downloadStatus`: HTTP status code from download response (e.g., 200)
- `uploadStatus`: HTTP status code from upload response (e.g., 200, 201)
- `uploadResponse`: Response data from upload endpoint (if available)

**Example Output:**
```json
{
  "success": true,
  "downloadStatus": 200,
  "uploadStatus": 200,
  "uploadResponse": {
    "id": "file-123",
    "status": "uploaded"
  }
}
```

## Examples

### Example 1: Basic File Transfer

```json
{
  "downloadUrl": "https://storage.googleapis.com/bucket/file.pdf",
  "uploadUrl": "https://api.example.com/files/upload",
  "method": "POST"
}
```

### Example 2: Transfer with Bearer Token in URL

```json
{
  "downloadUrl": "https://storage.googleapis.com/bucket/file.pdf",
  "uploadUrl": "https://api.example.com/files/upload?bearer=eyJhbGciOiJIUzI1NiJ9...",
  "method": "POST"
}
```

### Example 3: Transfer with Custom Headers

```json
{
  "downloadUrl": "https://storage.googleapis.com/bucket/file.pdf",
  "uploadUrl": "https://api.example.com/files/upload",
  "method": "PUT",
  "downloadHeaders": "{\"Authorization\": \"Bearer download-token\"}",
  "uploadHeaders": "{\"X-Custom-Header\": \"value\"}",
  "contentLength": 1048576
}
```

### Example 4: Error Handling (Non-Throwing)

```json
{
  "downloadUrl": "https://storage.googleapis.com/bucket/file.pdf",
  "uploadUrl": "https://api.example.com/files/upload",
  "throwOnError": false
}
```

When `throwOnError` is false, errors are returned in the output instead of throwing:
```json
{
  "success": false,
  "error": "Upload failed with HTTP 401...",
  "uploadStatus": 401,
  "downloadStatus": 200
}
```

## Common Use Cases

### Large File Transfers (Primary Use Case)
Transfer large files (GB+) without memory issues. This is the main purpose of this node - to prevent n8n from running out of memory when handling large files.

**Example**: Transfer a 5GB video file from Google Cloud Storage to your API without loading it into memory.

### Google Cloud Storage to API
Transfer files from Google Cloud Storage signed URLs to your API endpoint while keeping memory usage low.

### S3 to Another Service
Stream files from AWS S3 to another cloud storage or API without memory spikes.

### Memory-Constrained n8n Instances
Perfect for n8n instances running in environments with limited RAM (containers, small VMs, etc.).

### Automated File Processing
Part of a workflow that processes files between different services without memory overhead.

## Troubleshooting

### "Download response is not a streamable format"

This error occurs when the download URL returns JSON/text instead of binary data. The node automatically sets `Accept: */*` to prevent this, but some servers may still return JSON.

**Solutions:**
- Verify the download URL returns binary data
- Check if the URL requires specific headers
- Ensure the URL is a direct file download link (not a redirect to a JSON response)

### "Upload failed with HTTP 401"

Authentication error. Check:
- Bearer token in URL or headers is valid
- Token hasn't expired
- Upload endpoint accepts the authentication method

### "Download failed with HTTP 404"

The download URL is not accessible. Verify:
- URL is correct and accessible
- File exists at the specified location
- Required authentication headers are provided

## Project Structure

```
n8n-nodes-stream-file-transfer/
├── src/
│   └── nodes/
│       └── StreamFileTransfer/
│           ├── StreamFileTransfer.node.ts    # Main node implementation
│           ├── StreamFileTransfer.node.json  # Node metadata
│           ├── GenericFunctions.ts                # Shared utility functions
│           ├── transfer.svg                       # Node icon (azure blue dual globe)
│           └── actions/                           # Operation implementations
│               ├── index.ts                      # Operation registry
│               └── transferFile.operation.ts      # File transfer operation
├── dist/                                          # Compiled output
├── scripts/
│   └── fix-node-exports.js                       # Build script (includes SVG copy)
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Prerequisites

- Node.js (v20 or higher)
- Yarn (v1.22.0 or higher)

### Setup

```bash
# Clone the repository
git clone https://github.com/MikaelX/n8n-nodes-stream-file-transfer.git
cd n8n-nodes-stream-file-transfer

# Install dependencies
yarn install
```

### Development Commands

```bash
# Build for production
yarn build

# Build in watch mode
yarn build:watch

# Run linter
yarn lint
yarn lint:fix

# Type check
yarn typecheck

# Run tests
yarn test
yarn test:watch
yarn test:coverage

# Create release
yarn release
```

### Testing

The project includes comprehensive tests:

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Generate coverage report
yarn test:coverage
```

## License

MIT License - see LICENSE file for details.

## Support

For issues, feature requests, or questions:
- Open an issue on [GitHub](https://github.com/MikaelX/n8n-nodes-stream-file-transfer/issues)
- Check the [n8n Community Forum](https://community.n8n.io/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
