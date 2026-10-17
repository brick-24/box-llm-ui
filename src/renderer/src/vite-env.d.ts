/// <reference types="vite/client" />

import { ElectronAPI } from '../../preload/index';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
