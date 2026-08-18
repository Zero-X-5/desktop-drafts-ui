const modeTitle = document.querySelector('#modeTitle');
const modeDescription = document.querySelector('#modeDescription');
const currentMode = document.querySelector('#currentMode');
const apiStatus = document.querySelector('#apiStatus');
const cssProfile = document.querySelector('#cssProfile');
const tintAlpha = document.querySelector('#tintAlpha');
const closeButton = document.querySelector('#closeButton');
const modeButtons = [...document.querySelectorAll('[data-mode]')];

let appWindow;
let config;
let applying = false;

function setActiveButton(mode) {
  for (const button of modeButtons) {
    button.classList.toggle('active', button.dataset.mode === mode);
  }
}

function setStatus(mode, state, message) {
  const spec = config?.modes?.[mode];
  document.documentElement.dataset.mode = mode;
  document.documentElement.dataset.profile = spec?.cssProfile ?? 'pure';
  currentMode.textContent = spec?.label ?? mode;
  apiStatus.textContent = state;
  apiStatus.dataset.state = state === 'OK' ? 'ok' : state === 'ERROR' ? 'error' : 'pending';
  cssProfile.textContent = spec?.cssProfile ?? '—';
  tintAlpha.textContent = Array.isArray(spec?.color) ? String(spec.color[3]) : '—';
  modeTitle.textContent = spec?.label ?? mode;
  modeDescription.textContent = message;
}

async function applyMode(mode) {
  if (applying || !appWindow || !config?.modes?.[mode]) return;

  applying = true;
  const spec = config.modes[mode];
  setActiveButton(mode);
  setStatus(mode, 'APPLYING', '正在切换窗口效果…');

  try {
    if (spec.effect === null) {
      await appWindow.clearEffects();
    } else {
      const effects = { effects: [spec.effect] };
      if (Array.isArray(spec.color)) effects.color = spec.color;
      await appWindow.setEffects(effects);
    }

    setStatus(mode, 'OK', spec.description);
  } catch (error) {
    console.error(`failed to apply ${mode}`, error);
    setStatus(
      mode,
      'ERROR',
      `${spec.description} 当前系统调用失败：${String(error)}`,
    );
  } finally {
    applying = false;
  }
}

async function bootstrap() {
  try {
    const response = await fetch('./glass-test-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`config HTTP ${response.status}`);
    config = await response.json();

    const tauriWindow = window.__TAURI__?.window;
    if (!tauriWindow) {
      throw new Error('window.__TAURI__.window 不可用');
    }

    appWindow = tauriWindow.getCurrentWindow();

    for (const button of modeButtons) {
      button.addEventListener('click', () => applyMode(button.dataset.mode));
    }

    closeButton.addEventListener('click', () => appWindow.close());

    window.addEventListener('keydown', (event) => {
      const mode = config.shortcuts?.[event.key];
      if (mode) applyMode(mode);
    });

    await applyMode(config.initialMode);
  } catch (error) {
    console.error('glass test bootstrap failed', error);
    currentMode.textContent = '不可用';
    apiStatus.textContent = 'ERROR';
    apiStatus.dataset.state = 'error';
    cssProfile.textContent = '—';
    tintAlpha.textContent = '—';
    modeDescription.textContent = `初始化失败：${String(error)}`;
  }
}

bootstrap();
