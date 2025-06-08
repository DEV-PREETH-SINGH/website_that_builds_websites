import { useEffect, useState } from "react";
import { WebContainer } from '@webcontainer/api';

export function useWebContainer() {
    const [webcontainer, setWebcontainer] = useState<WebContainer>();
    const [error, setError] = useState<string>();

    async function main() {
        try {
            console.log("Starting WebContainer boot...");
            const webcontainerInstance = await WebContainer.boot();
            console.log("WebContainer booted successfully");
            setWebcontainer(webcontainerInstance);
        } catch (err: any) {
            console.error("WebContainer boot error:", err);
            setError(err.message || "Failed to initialize WebContainer");
        }
    }
    
    useEffect(() => {
        main();
    }, []);

    if (error) {
        console.error("WebContainer Error:", error);
    }

    return webcontainer;
}