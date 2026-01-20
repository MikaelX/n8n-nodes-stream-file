import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	IRequestOptions,
	IDataObject,
} from 'n8n-workflow';
import { extractBearerToken, parseHeaders } from '../GenericFunctions';

export const description: INodeProperties[] = [
	{
		displayName: 'Download URL',
		name: 'downloadUrl',
		type: 'string',
		default: '',
		required: true,
		description: 'URL to download the file from',
		placeholder: 'https://example.com/file.zip',
	},
	{
		displayName: 'Upload URL',
		name: 'uploadUrl',
		type: 'string',
		default: '',
		required: true,
		description: 'URL to upload the file to',
		placeholder: 'https://upload.example.com/upload',
	},
	{
		displayName: 'Content Length',
		name: 'contentLength',
		type: 'number',
		default: '',
		required: false,
		description: 'File size in bytes (optional, will be detected from download response if not provided)',
	},
	{
		displayName: 'HTTP Method',
		name: 'method',
		type: 'options',
		options: [
			{
				name: 'POST',
				value: 'POST',
			},
			{
				name: 'PUT',
				value: 'PUT',
			},
		],
		default: 'POST',
		description: 'HTTP method to use for upload',
	},
	{
		displayName: 'Download Headers',
		name: 'downloadHeaders',
		type: 'json',
		default: '{}',
		required: false,
		description: 'Additional headers for the download request (JSON object)',
	},
	{
		displayName: 'Upload Headers',
		name: 'uploadHeaders',
		type: 'json',
		default: '{}',
		required: false,
		description: 'Additional headers for the upload request (JSON object). Bearer tokens in upload URL query string are automatically extracted.',
	},
	{
		displayName: 'Throw Error on Non-2xx Status Codes',
		name: 'throwOnError',
		type: 'boolean',
		default: true,
		description: 'Whether to throw an error and fail execution when the API returns a 3xx, 4xx, or 5xx status code',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const downloadUrl = this.getNodeParameter('downloadUrl', itemIndex) as string;
	const uploadUrl = this.getNodeParameter('uploadUrl', itemIndex) as string;
	const contentLength = this.getNodeParameter('contentLength', itemIndex, '') as
		| string
		| number;
	const method = (this.getNodeParameter('method', itemIndex, 'POST') as string) as 'POST' | 'PUT';
	const downloadHeadersParam = this.getNodeParameter('downloadHeaders', itemIndex, '{}') as
		| string
		| IDataObject;
	const uploadHeadersParam = this.getNodeParameter('uploadHeaders', itemIndex, '{}') as
		| string
		| IDataObject;
	const throwOnError = this.getNodeParameter('throwOnError', itemIndex, true) as boolean;

	if (!downloadUrl || downloadUrl.trim() === '') {
		throw new Error('Download URL is required and cannot be empty');
	}

	if (!uploadUrl || uploadUrl.trim() === '') {
		throw new Error('Upload URL is required and cannot be empty');
	}

	// Parse headers
	const downloadHeaders = parseHeaders(downloadHeadersParam);
	const uploadHeaders = parseHeaders(uploadHeadersParam);

	// Ensure Accept header is set to prevent automatic JSON parsing
	// This forces the response to be treated as binary/stream
	const finalDownloadHeaders: Record<string, string> = {
		Accept: '*/*',
		...downloadHeaders,
	};

	// Extract bearer token from upload URL if present
	const { token } = extractBearerToken(uploadUrl);

	// Prepare upload headers
	const finalUploadHeaders: Record<string, string> = {
		'Content-Type': 'application/octet-stream',
		...uploadHeaders,
	};

	// Add bearer token to Authorization header if extracted from URL and not already present
	if (token && !finalUploadHeaders['Authorization'] && !finalUploadHeaders['authorization']) {
		finalUploadHeaders['Authorization'] = `Bearer ${token}`;
	}

	// Add Content-Length if provided
	if (contentLength) {
		const length = typeof contentLength === 'number' ? contentLength : parseInt(contentLength, 10);
		if (!isNaN(length) && length > 0) {
			finalUploadHeaders['Content-Length'] = String(length);
		}
	}

	try {
		// Start download request - use request helper for streaming
		const downloadOptions: IRequestOptions = {
			method: 'GET',
			url: downloadUrl,
			headers: finalDownloadHeaders,
			encoding: null, // Get binary/stream response
			resolveWithFullResponse: true,
		};

		const downloadResponse = await this.helpers.request(downloadOptions);

		// Check download response status
		const downloadStatusCode = downloadResponse.statusCode;
		if (downloadStatusCode !== undefined) {
			if (downloadStatusCode < 200 || downloadStatusCode >= 300) {
				const errorMessage = `Download failed with HTTP ${downloadStatusCode} from ${downloadUrl}. Please verify the download URL is accessible and returns a successful response.`;
				if (throwOnError) {
					throw new Error(errorMessage);
				}
				return {
					json: {
						error: errorMessage,
						downloadStatus: downloadStatusCode,
						downloadUrl,
					} as IDataObject,
					pairedItem: {
						item: itemIndex,
					},
				};
			}
		}

		// Get actual content length from response if not provided
		const responseHeaders = downloadResponse.headers || {};
		const actualContentLength = contentLength || responseHeaders['content-length'];

		if (actualContentLength && !finalUploadHeaders['Content-Length']) {
			const length =
				typeof actualContentLength === 'number'
					? actualContentLength
					: parseInt(actualContentLength, 10);
			if (!isNaN(length) && length > 0) {
				finalUploadHeaders['Content-Length'] = String(length);
			}
		}

		// Get the stream from download response
		// The request helper returns response.body as a stream when encoding is null
		const downloadStream = downloadResponse.body;
		
		// Strict check: only accept streams - no buffering fallbacks
		// If response was buffered (Buffer) or parsed (object), fail immediately
		if (Buffer.isBuffer(downloadStream)) {
			throw new Error(
				`Download response from ${downloadUrl} was buffered instead of streamed. ` +
				`The response body is a Buffer (${downloadStream.length} bytes), which means the entire file was loaded into memory. ` +
				`This defeats the purpose of streaming. Please ensure the download URL returns a stream. ` +
				`Check that 'Accept: */*' header is set and encoding is null.`
			);
		}
		
		// Check if it's a valid stream with pipe method
		if (!downloadStream || typeof (downloadStream as any).pipe !== 'function') {
			const bodyType = typeof downloadStream;
			const bodyConstructor = downloadStream?.constructor?.name || 'unknown';
			const bodyPreview = downloadStream && typeof downloadStream === 'object' 
				? JSON.stringify(downloadStream).substring(0, 200) 
				: String(downloadStream).substring(0, 200);
			
			throw new Error(
				`Download response from ${downloadUrl} is not a streamable format. ` +
				`The response body type is: ${bodyType}, constructor: ${bodyConstructor}. ` +
				(bodyPreview ? `Response preview: ${bodyPreview}${bodyPreview.length >= 200 ? '...' : ''}. ` : '') +
				`This usually means the server returned JSON/text instead of binary data, or the response was parsed/buffered. ` +
				`Please ensure the download URL returns a binary stream. ` +
				`You may need to add headers like 'Accept: */*' to prevent automatic parsing.`
			);
		}

		// Pipe download stream directly to upload - no intermediate buffering
		// The stream will be consumed chunk-by-chunk as it's uploaded
		// Use helpers.request() instead of httpRequest() to ensure streaming (httpRequest may buffer)
		const uploadOptions: IRequestOptions = {
			method,
			url: uploadUrl,
			headers: finalUploadHeaders,
			body: downloadStream, // Pipe download stream directly - streams without buffering entire file
			resolveWithFullResponse: true,
		};

		const uploadResponse = await this.helpers.request(uploadOptions);

		// Check upload response status
		const uploadStatusCode = uploadResponse.statusCode;
		
		if (uploadStatusCode !== undefined) {
			if (uploadStatusCode < 200 || uploadStatusCode >= 300) {
				const errorMessage = `Upload failed with HTTP ${uploadStatusCode} to ${uploadUrl}. ` +
					`Please verify the upload URL is correct, authentication is valid, and the endpoint accepts ${method} requests.`;
				if (throwOnError) {
					throw new Error(errorMessage);
				}
				return {
					json: {
						error: errorMessage,
						uploadStatus: uploadStatusCode,
						downloadStatus: downloadStatusCode,
						uploadUrl,
						downloadUrl,
					} as IDataObject,
					pairedItem: {
						item: itemIndex,
					},
				};
			}
		}

		// Success
		const result: IDataObject = {
			success: true,
			downloadStatus: downloadStatusCode || 200,
			uploadStatus: uploadStatusCode || 200,
		};

		// Include response data if available
		// helpers.request() with resolveWithFullResponse returns { statusCode, headers, body }
		if (uploadResponse.body !== undefined) {
			// Try to parse JSON if possible, otherwise return as-is
			try {
				if (typeof uploadResponse.body === 'string') {
					result.uploadResponse = JSON.parse(uploadResponse.body);
				} else {
					result.uploadResponse = uploadResponse.body as IDataObject;
				}
			} catch {
				result.uploadResponse = uploadResponse.body as IDataObject;
			}
		}

		return {
			json: result,
			pairedItem: {
				item: itemIndex,
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const enhancedMessage = errorMessage.includes('Download URL') || errorMessage.includes('Upload URL')
			? errorMessage
			: `File transfer failed: ${errorMessage}. Download URL: ${downloadUrl}, Upload URL: ${uploadUrl}`;
		
		if (throwOnError) {
			throw new Error(enhancedMessage);
		}
		return {
			json: {
				error: enhancedMessage,
				success: false,
				downloadUrl,
				uploadUrl,
			} as IDataObject,
			pairedItem: {
				item: itemIndex,
			},
		};
	}
}
