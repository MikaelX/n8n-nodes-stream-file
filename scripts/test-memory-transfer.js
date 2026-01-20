#!/usr/bin/env node

/**
 * Real-world memory monitoring test for file transfer
 * Tests actual transfer with real URLs and monitors memory usage
 */

const { Readable } = require('stream');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Memory monitoring helper
function getMemoryMB() {
	const usage = process.memoryUsage();
	return {
		heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
		heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
		external: Math.round(usage.external / 1024 / 1024),
		rss: Math.round(usage.rss / 1024 / 1024),
		total: Math.round((usage.heapUsed + usage.external) / 1024 / 1024),
	};
}

// Download function using Node.js streams
function downloadStream(url, headers = {}) {
	return new Promise((resolve, reject) => {
		const urlObj = new URL(url);
		const client = urlObj.protocol === 'https:' ? https : http;
		
		const options = {
			hostname: urlObj.hostname,
			port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
			path: urlObj.pathname + urlObj.search,
			method: 'GET',
			headers: {
				'Accept': '*/*',
				...headers,
			},
		};

		const req = client.request(options, (res) => {
			if (res.statusCode < 200 || res.statusCode >= 300) {
				reject(new Error(`Download failed: ${res.statusCode}`));
				return;
			}
			resolve({
				stream: res,
				statusCode: res.statusCode,
				headers: res.headers,
			});
		});

		req.on('error', reject);
		req.end();
	});
}

// Upload function using Node.js streams
function uploadStream(url, stream, headers = {}, method = 'POST') {
	return new Promise((resolve, reject) => {
		const urlObj = new URL(url);
		const client = urlObj.protocol === 'https:' ? https : http;
		
		// Extract bearer token from URL if present
		const bearer = urlObj.searchParams.get('bearer');
		const finalHeaders = {
			'Content-Type': 'application/octet-stream',
			...headers,
		};
		
		if (bearer && !finalHeaders['Authorization'] && !finalHeaders['authorization']) {
			finalHeaders['Authorization'] = `Bearer ${bearer}`;
		}

		const options = {
			hostname: urlObj.hostname,
			port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
			path: urlObj.pathname + urlObj.search,
			method: method,
			headers: finalHeaders,
		};

		const req = client.request(options, (res) => {
			let body = '';
			res.on('data', (chunk) => {
				body += chunk.toString();
			});
			res.on('end', () => {
				resolve({
					statusCode: res.statusCode,
					headers: res.headers,
					body: body,
				});
			});
		});

		req.on('error', reject);
		
		// Pipe stream to request
		stream.pipe(req);
	});
}

async function testTransfer(downloadUrl, uploadUrl, fileSize) {
	console.log('\n=== Starting Real-World Memory Transfer Test ===\n');
	console.log(`Download URL: ${downloadUrl.substring(0, 80)}...`);
	console.log(`Upload URL: ${uploadUrl.substring(0, 80)}...`);
	console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB (${fileSize} bytes)\n`);

	// Baseline memory
	const baselineMemory = getMemoryMB();
	console.log(`Baseline memory: ${baselineMemory.total} MB (heap: ${baselineMemory.heapUsed} MB, external: ${baselineMemory.external} MB)`);

	// Start memory monitoring
	const memorySamples = [baselineMemory];
	const memoryMonitor = setInterval(() => {
		memorySamples.push(getMemoryMB());
	}, 100); // Sample every 100ms

	const startTime = Date.now();

	try {
		// Step 1: Download
		console.log('\n[1/2] Starting download...');
		const downloadStartMemory = getMemoryMB();
		const downloadResult = await downloadStream(downloadUrl);
		const downloadMemory = getMemoryMB();
		
		console.log(`Download started - Memory: ${downloadMemory.total} MB (increase: ${downloadMemory.total - downloadStartMemory.total} MB)`);
		console.log(`Content-Type: ${downloadResult.headers['content-type']}`);
		console.log(`Content-Length: ${downloadResult.headers['content-length'] || 'unknown'}`);

		// Step 2: Upload (stream directly)
		console.log('\n[2/2] Starting upload (streaming)...');
		const uploadStartMemory = getMemoryMB();
		
		// Monitor stream progress
		let bytesDownloaded = 0;
		let bytesUploaded = 0;
		
		downloadResult.stream.on('data', (chunk) => {
			bytesDownloaded += chunk.length;
		});

		const uploadPromise = uploadStream(uploadUrl, downloadResult.stream, {}, 'POST');
		
		// Wait for upload to complete
		const uploadResult = await uploadPromise;
		const uploadEndMemory = getMemoryMB();
		
		const endTime = Date.now();
		const duration = ((endTime - startTime) / 1000).toFixed(2);

		// Stop monitoring
		clearInterval(memoryMonitor);

		// Wait a bit for cleanup
		await new Promise((resolve) => setTimeout(resolve, 1000));
		const finalMemory = getMemoryMB();

		// Calculate statistics
		const maxMemory = memorySamples.reduce((max, m) => Math.max(max, m.total), 0);
		const minMemory = memorySamples.reduce((min, m) => Math.min(min, m.total), Infinity);
		const avgMemory = memorySamples.reduce((sum, m) => sum + m.total, 0) / memorySamples.length;
		const memoryPeak = maxMemory - baselineMemory.total;
		const memoryIncrease = finalMemory.total - baselineMemory.total;

		// Results
		console.log('\n=== Transfer Complete ===');
		console.log(`Duration: ${duration} seconds`);
		console.log(`Upload status: ${uploadResult.statusCode}`);
		console.log(`Bytes downloaded: ${bytesDownloaded.toLocaleString()}`);
		
		console.log('\n=== Memory Usage Statistics ===');
		console.log(`Baseline memory: ${baselineMemory.total} MB`);
		console.log(`Peak memory during transfer: ${maxMemory} MB`);
		console.log(`Average memory during transfer: ${avgMemory.toFixed(2)} MB`);
		console.log(`Memory peak increase: ${memoryPeak.toFixed(2)} MB`);
		console.log(`Final memory: ${finalMemory.total} MB`);
		console.log(`Memory increase (final): ${memoryIncrease.toFixed(2)} MB`);
		console.log(`Memory samples collected: ${memorySamples.length}`);
		
		const fileSizeMB = fileSize / 1024 / 1024;
		const memoryEfficiency = ((1 - memoryPeak / fileSizeMB) * 100).toFixed(2);
		console.log(`Memory efficiency: ${memoryEfficiency}% (lower peak is better)`);
		console.log('==============================\n');

		// Analysis
		const memoryThresholdMB = Math.min(fileSizeMB * 0.1, 100); // 10% or 100MB max
		
		if (memoryPeak < memoryThresholdMB) {
			console.log('✅ PASS: Memory usage is efficient (peak < 10% of file size)');
		} else {
			console.log(`⚠️  WARNING: Memory peak (${memoryPeak.toFixed(2)} MB) is higher than expected`);
		}

		if (uploadResult.statusCode >= 200 && uploadResult.statusCode < 300) {
			console.log('✅ PASS: Upload successful');
		} else {
			console.log(`❌ FAIL: Upload failed with status ${uploadResult.statusCode}`);
			console.log(`Response: ${uploadResult.body.substring(0, 200)}`);
		}

		return {
			success: uploadResult.statusCode >= 200 && uploadResult.statusCode < 300,
			memoryPeak,
			memoryIncrease,
			duration: parseFloat(duration),
			statusCode: uploadResult.statusCode,
		};

	} catch (error) {
		clearInterval(memoryMonitor);
		console.error('\n❌ ERROR:', error.message);
		throw error;
	}
}

// Main execution
if (require.main === module) {
	const downloadUrl = process.argv[2] || 'https://storage.googleapis.com/st-cmp-uat-faf0-essity-uat-storage/luma-container/Essity/storage/D708B0FB714FE98548961F52AE9D512608D3A1EF9AAE1CD4AF371D2AB4DF2FB9D0C88E6DA649ECA98BF00BC0D9EBFAE362FD77F5982A22B807F89CFEB504C422?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=essity%40st-cmp-uat-faf0.iam.gserviceaccount.com%2F20260120%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260120T005454Z&X-Goog-Expires=2700&X-Goog-SignedHeaders=host&response-content-disposition=attachment%3Bfilename%2A%3DUTF-8%27%27Essity%255F2026%255FAlways%2520On%255FBBD%255FBanner%255FEN%255F1920x1080%255FT1EA1%255Fa068c69e01d087bf%252Emp4&response-content-type=video%2Fmp4&X-Goog-Signature=13c2dca1f152d00d6a68a5b23ff1d08d6288391a29d073d1b4ec502cc3fd8ceb4bdfa921e8cbe87be0c7a091deaa93e3e33387963adfd0a8e0329306ebbacf0f174394c0b64126b1db3fe80eeb3f05c28dcaea06fe3c3daecc1d6c478ae76e5c3685878a1466c7cbf61ee3f8a4f31b61535a1709256878a932d9c5ff4d08ad4f69f5e8eb7d2a635dcd82e8f176f55fa89277c957e763b44591d284d609900b005379b46babe93b4c449d869de80d303b05b31062c947c655a446bb1a03bfdd660ac3f2d942da4534cba444bb35825dbb3ba05873db8497f46984066ac383e47da57f38f6adc9862691f2a849dc20e8e34a6f8fccd0d874d2342b523d812c2d4f';
	const uploadUrl = process.argv[3] || 'https://globalmediabankuat.essity.com/storageserver/upload/gmbStorage/buckets/DAM_BUCKET/files/ed7b7420-710d-4320-9adf-dcf99ce1823b?bearer=eyJhbGciOiJIUzI1NiJ9.eyJidWNrZXROYW1lIjoiREFNX0JVQ0tFVCIsInRlbmFudE5hbWUiOiJnbWJTdG9yYWdlIiwiZXhwIjoxNzY5MTI5Njk3LCJwZXJtaXNzaW9ucyI6WyJ1cGxvYWQiXSwiZmlsZUlkIjoiZWQ3Yjc0MjAtNzEwZC00MzIwLTlhZGYtZGNmOTljZTE4MjNiIn0.PlGo5WkmJFrFpkYU2rClQr9me9IgjhpdntuTl2ssO3U';
	const fileSize = parseInt(process.argv[4]) || 787140412;

	testTransfer(downloadUrl, uploadUrl, fileSize)
		.then((result) => {
			console.log('\n=== Test Summary ===');
			console.log(`Success: ${result.success ? '✅' : '❌'}`);
			console.log(`Memory peak: ${result.memoryPeak.toFixed(2)} MB`);
			console.log(`Duration: ${result.duration.toFixed(2)}s`);
			process.exit(result.success ? 0 : 1);
		})
		.catch((error) => {
			console.error('\nTest failed:', error);
			process.exit(1);
		});
}

module.exports = { testTransfer, getMemoryMB };
