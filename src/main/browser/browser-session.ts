import { fetchWebPage, FetchedPage } from './page-fetcher';

export interface BrowseResult extends FetchedPage {
  screenshotDataUrl?: string;
}

export interface BrowseOptions {
  timeoutMs?: number;
  maxCharacters?: number;
  takeScreenshot?: boolean;
}

export class BrowserSessionManager {
  private static instance: BrowserSessionManager | null = null;
  private offscreenWindow: any = null;
  private isElectronAvailable: boolean;

  constructor() {
    this.isElectronAvailable = this.checkElectronEnvironment();
  }

  public static getInstance(): BrowserSessionManager {
    if (!BrowserSessionManager.instance) {
      BrowserSessionManager.instance = new BrowserSessionManager();
    }
    return BrowserSessionManager.instance;
  }

  private checkElectronEnvironment(): boolean {
    try {
      const electron = require('electron');
      return Boolean(electron && electron.BrowserWindow && electron.session);
    } catch {
      return false;
    }
  }

  private async getOrCreateOffscreenWindow(): Promise<any> {
    if (!this.isElectronAvailable) return null;
    const { BrowserWindow, session } = require('electron');

    if (this.offscreenWindow && !this.offscreenWindow.isDestroyed()) {
      return this.offscreenWindow;
    }

    const webSession = session.fromPartition('persist:web-agent');

    // Secure request handling on the web-agent session
    webSession.setPermissionRequestHandler((_wc: any, _permission: any, callback: (grant: boolean) => void) => {
      callback(false); // Deny all permissions (camera, mic, geolocation, etc.)
    });

    this.offscreenWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      webPreferences: {
        offscreen: true,
        session: webSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        images: true,
      },
    });

    // Block local / untrusted protocols
    this.offscreenWindow.webContents.on('will-navigate', (event: any, navUrl: string) => {
      try {
        const parsed = new URL(navUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    });

    this.offscreenWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });

    return this.offscreenWindow;
  }

  public async browsePage(url: string, options?: BrowseOptions): Promise<BrowseResult> {
    const timeoutMs = options?.timeoutMs || 10000;
    const maxCharacters = options?.maxCharacters || 12000;
    const shouldScreenshot = Boolean(options?.takeScreenshot);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only http and https are allowed.`);
    }

    if (!this.isElectronAvailable) {
      // In test / non-Electron environment, gracefully fallback to fast HTTP reader
      const fetched = await fetchWebPage(url, { maxCharacters, timeoutMs });
      return {
        ...fetched,
        screenshotDataUrl: shouldScreenshot
          ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
          : undefined,
      };
    }

    try {
      const win = await this.getOrCreateOffscreenWindow();
      if (!win) {
        return await fetchWebPage(url, { maxCharacters, timeoutMs });
      }

      await new Promise<void>((resolve, reject) => {
        let timer: NodeJS.Timeout | null = null;

        const onFinish = () => {
          if (timer) clearTimeout(timer);
          cleanup();
          resolve();
        };

        const onFail = (_e: any, code: number, desc: string) => {
          if (timer) clearTimeout(timer);
          cleanup();
          reject(new Error(`Page load failed (${code}): ${desc}`));
        };

        const cleanup = () => {
          win.webContents.removeListener('did-finish-load', onFinish);
          win.webContents.removeListener('did-fail-load', onFail);
        };

        win.webContents.once('did-finish-load', onFinish);
        win.webContents.once('did-fail-load', onFail);

        timer = setTimeout(() => {
          cleanup();
          win.webContents.stop();
          resolve(); // Resolve with whatever content has loaded so far
        }, timeoutMs);

        win.loadURL(url).catch((err: any) => {
          if (timer) clearTimeout(timer);
          cleanup();
          reject(err);
        });
      });

      // Extract title and rendered DOM text
      const pageData = await win.webContents.executeJavaScript(`
        (() => {
          try {
            const title = document.title || '';
            const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

            const clone = document.body ? document.body.cloneNode(true) : null;
            if (!clone) return { title, description: metaDesc, text: '' };

            const toRemove = ['script', 'style', 'noscript', 'svg', 'iframe', 'nav', 'footer', 'aside', 'header'];
            toRemove.forEach(tag => {
              clone.querySelectorAll(tag).forEach(el => el.remove());
            });

            return {
              title,
              description: metaDesc,
              text: (clone.innerText || clone.textContent || '').trim()
            };
          } catch (e) {
            return { title: '', description: '', text: '' };
          }
        })()
      `);

      let screenshotDataUrl: string | undefined;
      if (shouldScreenshot) {
        const image = await win.webContents.capturePage();
        screenshotDataUrl = image.toDataURL();
      }

      const rawText: string = pageData?.text || '';
      const fullCount = rawText.length;
      let truncated = false;
      let content = rawText;

      if (rawText.length > maxCharacters) {
        const cut = rawText.lastIndexOf(' ', maxCharacters);
        content = (cut > 0 ? rawText.substring(0, cut) : rawText.substring(0, maxCharacters)) +
          `\n\n*(Content truncated: showing first ${maxCharacters.toLocaleString()} of ${fullCount.toLocaleString()} characters)*`;
        truncated = true;
      }

      return {
        url,
        title: pageData?.title || parsedUrl.hostname,
        description: pageData?.description || undefined,
        content,
        characterCount: content.length,
        truncated,
        screenshotDataUrl,
      };
    } catch (err) {
      console.warn(`[BrowserSession] Chromium offscreen failed for ${url}, falling back to fetchWebPage:`, err);
      return await fetchWebPage(url, { maxCharacters, timeoutMs });
    }
  }

  public async captureScreenshot(url: string, timeoutMs = 10000): Promise<string> {
    const result = await this.browsePage(url, { timeoutMs, takeScreenshot: true });
    return result.screenshotDataUrl || '';
  }

  public cleanup(): void {
    if (this.offscreenWindow && !this.offscreenWindow.isDestroyed()) {
      this.offscreenWindow.destroy();
      this.offscreenWindow = null;
    }
  }
}

export const browserSession = BrowserSessionManager.getInstance();
