import { WebContainer } from '@webcontainer/api';
import React, { useEffect, useState } from 'react';

interface PreviewFrameProps {
  files: any[];
  webContainer: WebContainer;
}

const INSTALL_TIMEOUT = 120000; // 2 minutes timeout

export function PreviewFrame({ files, webContainer }: PreviewFrameProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Initializing...");

  useEffect(() => {
    // Check if we're in HTTPS
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setError('WebContainer requires HTTPS. Please access this site using HTTPS.');
      return;
    }

    async function main() {
      try {
        setStatus("Setting up environment...");
        console.log("Starting preview setup...");

        // First, create package.json
        setStatus("Creating package.json...");
        await webContainer.mount({
          'package.json': {
            file: {
              contents: JSON.stringify({
                name: "preview-app",
                type: "module",
                scripts: {
                  dev: "vite --port 5173 --host"
                },
                dependencies: {
                  "react": "^18.2.0",
                  "react-dom": "^18.2.0"
                },
                devDependencies: {
                  "@vitejs/plugin-react": "^4.2.1",
                  "vite": "^5.0.12"
                }
              }, null, 2)
            }
          }
        });

        // Create vite.config.js
        setStatus("Creating vite config...");
        await webContainer.mount({
          'vite.config.js': {
            file: {
              contents: `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    strictPort: true,
    port: 5173
  }
});`
            }
          }
        });

        setStatus("Installing dependencies...\nThis might take a few minutes...");
        console.log("Starting npm install...");
        
        let installTimeout: NodeJS.Timeout;
        try {
          const installProcess = await webContainer.spawn('npm', ['install']);
          
          const installPromise = new Promise((resolve, reject) => {
            let output = '';
            
            installTimeout = setTimeout(() => {
              reject(new Error('Installation timed out after 2 minutes'));
            }, INSTALL_TIMEOUT);

            installProcess.output.pipeTo(new WritableStream({
              write(data) {
                output += data;
                console.log('Install output:', data);
                setStatus(prev => `${prev}\n${data}`);
              }
            }));

            installProcess.exit.then((code) => {
              clearTimeout(installTimeout);
              if (code !== 0) {
                reject(new Error(`Installation failed with code ${code}\nOutput: ${output}`));
              } else {
                resolve(code);
              }
            });
          });

          await installPromise;
        } catch (err: any) {
          clearTimeout(installTimeout!);
          throw new Error(`npm install failed: ${err?.message || 'Unknown error during installation'}`);
        }

        setStatus("Starting development server...");
        console.log("Starting dev server...");
        const devProcess = await webContainer.spawn('npm', ['run', 'dev']);
        
        let devOutput = '';
        devProcess.output.pipeTo(new WritableStream({
          write(data) {
            devOutput += data;
            console.log('Dev server output:', data);
            setStatus(prev => `${prev}\n${data}`);
          }
        }));

        // Set a timeout for the dev server to start
        const devServerTimeout = setTimeout(() => {
          setError('Development server failed to start within 1 minute');
        }, 60000);

        // Wait for server-ready event
        webContainer.on('server-ready', (port, url) => {
          clearTimeout(devServerTimeout);
          console.log('Server ready on port:', port);
          console.log('URL:', url);
          setUrl(url);
          setStatus("Server ready!");
        });
      } catch (err: any) {
        console.error('Preview error:', err);
        setError(err.message || 'An unknown error occurred');
      }
    }

    if (webContainer && files.length > 0) {
      console.log('Starting preview with files:', files);
      main();
    }

    // Cleanup function
    return () => {
      // Stop any running processes when component unmounts
      webContainer?.spawn('pkill', ['-f', 'node']);
    };
  }, [webContainer, files]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400">
        <div className="text-center max-w-2xl">
          <p className="mb-2 text-lg font-semibold">Error: {error}</p>
          <pre className="text-sm text-left max-h-60 overflow-auto p-4 bg-gray-800 rounded whitespace-pre-wrap">
            {status}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center text-gray-400">
      {!url && <div className="text-center max-w-2xl">
        <p className="mb-2 text-lg">Setting up preview environment...</p>
        <pre className="text-sm text-left max-h-60 overflow-auto p-4 bg-gray-800 rounded whitespace-pre-wrap">
          {status}
        </pre>
      </div>}
      {url && <iframe width={"100%"} height={"100%"} src={url} />}
    </div>
  );
}