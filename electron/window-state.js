import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const statePath = path.join(app.getPath('userData'), 'window-state.json');

export function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return { x: null, y: 16, width: 680, height: 460, expanded: false, topmost: true };
  }
}

export function saveWindowState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}
