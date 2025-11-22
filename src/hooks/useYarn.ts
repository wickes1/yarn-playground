import { useState, useEffect, useCallback } from 'react';
import { ParseResult } from '../types';

// Global runtime cache (singleton pattern)
let dotnetRuntime: any = null;
let isInitializing = false;
let initPromise: Promise<any> | null = null;

// Helper function to wait for dotnet to be available
function waitForDotNet(): Promise<void> {
    return new Promise((resolve, reject) => {
        // @ts-ignore
        if (window.dotnet) {
            resolve();
            return;
        }

        // Poll for dotnet availability (loaded via index.html)
        const checkInterval = setInterval(() => {
            // @ts-ignore
            if (window.dotnet) {
                clearInterval(checkInterval);
                clearTimeout(timeout);
                resolve();
            }
        }, 50);

        // Timeout after 10 seconds
        const timeout = setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('Timeout waiting for dotnet runtime to load'));
        }, 10000);
    });
}

// Initialize the dotnet runtime (singleton)
async function initDotNetRuntime(): Promise<any> {
    // If already initialized, return cached runtime
    if (dotnetRuntime) {
        return dotnetRuntime;
    }

    // If currently initializing, wait for that to complete
    if (isInitializing && initPromise) {
        return initPromise;
    }

    // Start initialization
    isInitializing = true;
    initPromise = (async () => {
        try {
            // Wait for dotnet to be loaded (via index.html script)
            await waitForDotNet();

            // Access the global dotnet object
            // @ts-ignore
            const dotnet = window.dotnet;

            if (!dotnet) {
                throw new Error('dotnet runtime not found on window object');
            }

            // Initialize the .NET runtime
            const runtime = await dotnet
                .withDiagnosticTracing(false)
                .withApplicationArguments()
                .create();

            dotnetRuntime = runtime;
            return runtime;
        } finally {
            isInitializing = false;
        }
    })();

    return initPromise;
}

export function useYarn() {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [isParsing, setIsParsing] = useState(false);

    useEffect(() => {
        let isMounted = true;

        async function init() {
            try {
                // Use the singleton initialization function
                await initDotNetRuntime();

                // Only update state if component is still mounted
                if (isMounted) {
                    setIsReady(true);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    setError((err as Error).message);
                }
            }
        }

        init();

        // Cleanup function to prevent state updates on unmounted component
        return () => {
            isMounted = false;
        };
    }, []);

    const parse = useCallback(async (source: string) => {
        if (!dotnetRuntime) {
            console.warn('Runtime not initialized yet');
            return;
        }

        setIsParsing(true);
        setError(null);
        try {
            const exports = await dotnetRuntime.getAssemblyExports('YarnSpinnerJS');
            const jsonResult = exports.YarnJS.Program.ParseYarn(source);
            const result = JSON.parse(jsonResult);

            // Check for compilation diagnostics/errors
            if (result.Diagnostics && result.Diagnostics.length > 0) {
                console.error('Compilation Diagnostics:', result.Diagnostics);
            }

            console.log('=== PARSE RESULT ===');
            console.log('Success:', result.Success);
            console.log('InitialValues:', result.InitialValues);
            console.log('Nodes:', result.Nodes.length);

            setParseResult(result);
            return result;
        } catch (err) {
            console.error("Parse error:", err);
            setError("Failed to parse script");
        } finally {
            setIsParsing(false);
        }
    }, []);

    return { isReady, error, parseResult, parse, isParsing };
}
