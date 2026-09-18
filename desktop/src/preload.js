'use strict';

/**
 * Bridge between the packaged web app and the desktop shell.
 * Deliberately tiny: the web UI only needs to know that it is running inside
 * the desktop build, plus where its data lives.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('medf', {
  isDesktop: true,
  platform: process.platform,
  getInfo: () => ipcRenderer.invoke('medf:info'),
});
