"use client";

declare global {
  interface Window {
    mapkit?: any;
  }
}

let loading: Promise<any> | null = null;

export async function loadMapKit(): Promise<any> {
  if (typeof window === "undefined") throw new Error("mapkit only in browser");
  if ((window as any).mapkit?.loaded) return (window as any).mapkit;

  if (!loading) {
    loading = new Promise(async (resolve, reject) => {
      try {
        // Inject script
        const el = document.createElement("script");
        el.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
        el.async = true;
        el.onload = async () => {
          try {
            const mk = (window as any).mapkit;
            // Auth callback: fetch token from our API
            mk.init({
              authorizationCallback: (done: (token: string) => void) => {
                fetch("/api/mapkit/token")
                  .then(r => r.text())
                  .then(token => done(token))
                  .catch(reject);
              },
            });
            (mk as any).loaded = true;
            resolve(mk);
          } catch (e) {
            reject(e);
          }
        };
        el.onerror = (e) => reject(e);
        document.head.appendChild(el);
      } catch (e) {
        reject(e);
      }
    });
  }
  return loading;
}
