#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <windowsx.h>
#include <dwmapi.h>

#include <algorithm>
#include <array>
#include <string>

#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "user32.lib")

namespace {

constexpr wchar_t kClassName[] = L"ShijianNativeGlassDemo";
// Layout values are logical pixels. They are converted to device pixels by
// ui() so the demo remains the same physical size at 100%, 150% and 200% DPI.
constexpr int kWindowWidth = 1000;
constexpr int kWindowHeight = 650;
constexpr int kMinWindowWidth = 760;
constexpr int kMinWindowHeight = 480;
constexpr int kTitleBarHeight = 84;
constexpr int kTabBarHeight = 52;
constexpr int kMaterialButtonWidth = 112;
constexpr int kMaterialButtonHeight = 38;
constexpr int kMaterialButtonGap = 10;
constexpr int kTopControlSize = 38;
constexpr int kTopControlGap = 8;

// These values are stable in the Windows SDK headers used by current Win11.
constexpr DWORD kDwmwaUseImmersiveDarkMode = 20;
constexpr DWORD kDwmwaWindowCornerPreference = 33;
constexpr DWORD kDwmwaBorderColor = 34;
constexpr DWORD kDwmwaSystemBackdropType = 38;
constexpr int kDwmCornerRound = 2;
// DWMSBT_NONE disables the system backdrop. Because only the titlebar is
// extended with DwmExtendFrameIntoClientArea, this intentionally produces
// the transparent-glass mode rather than a filled solid surface.
constexpr int kBackdropTransparent = 1;
constexpr int kBackdropMica = 2;
constexpr int kBackdropAcrylic = 3;
constexpr COLORREF kTransparentColor = 0xFFFFFFFE;
constexpr UINT kFrameRefreshMessage = WM_APP + 1;

enum class Backdrop { Mica, Acrylic, Transparent };

HWND g_window = nullptr;
Backdrop g_backdrop = Backdrop::Mica;
bool g_dark = false;
int g_hoverButton = -1;
bool g_alwaysOnTop = false;
UINT g_dpi = USER_DEFAULT_SCREEN_DPI;
bool g_resizing = false;
LRESULT g_resizeHit = HTCLIENT;
POINT g_resizeStartPoint{};
RECT g_resizeStartWindow{};
bool g_frameRefreshPosted = false;

int ui(const int logicalPixels) {
  return MulDiv(logicalPixels, static_cast<int>(g_dpi), USER_DEFAULT_SCREEN_DPI);
}

RECT clientRect() {
  RECT rect{};
  GetClientRect(g_window, &rect);
  return rect;
}

RECT materialButtonRect(const int index) {
  const RECT rect = clientRect();
  const int editorTop = ui(kTitleBarHeight + kTabBarHeight);
  const int width = ui(kMaterialButtonWidth);
  const int gap = ui(kMaterialButtonGap);
  const int top = editorTop + ui(178);
  const int x = ui(34) + index * (width + gap);
  return RECT{x, top, x + width, top + ui(kMaterialButtonHeight)};
}

RECT topControlRect(const int index) {
  const RECT rect = clientRect();
  const int right = rect.right - ui(18);
  const int size = ui(kTopControlSize);
  const int gap = ui(kTopControlGap);
  const int top = (ui(kTitleBarHeight) - size) / 2;
  const int x = right - 3 * size - 2 * gap + index * (size + gap);
  return RECT{x, top, x + size, top + size};
}

bool contains(const RECT& rect, POINT point) {
  return point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom;
}

LRESULT resizeHitTest(POINT point) {
  const RECT rect = clientRect();
  const int frame = (std::max)(
      ui(6),
      GetSystemMetricsForDpi(SM_CXSIZEFRAME, g_dpi) +
          GetSystemMetricsForDpi(SM_CXPADDEDBORDER, g_dpi));
  const bool left = point.x < frame;
  const bool right = point.x >= rect.right - frame;
  const bool top = point.y < frame;
  const bool bottom = point.y >= rect.bottom - frame;

  if (top && left) return HTTOPLEFT;
  if (top && right) return HTTOPRIGHT;
  if (bottom && left) return HTBOTTOMLEFT;
  if (bottom && right) return HTBOTTOMRIGHT;
  if (left) return HTLEFT;
  if (right) return HTRIGHT;
  if (top) return HTTOP;
  if (bottom) return HTBOTTOM;
  return HTCLIENT;
}

void beginResize(HWND hwnd, const LRESULT hit) {
  g_resizing = true;
  g_resizeHit = hit;
  GetCursorPos(&g_resizeStartPoint);
  GetWindowRect(hwnd, &g_resizeStartWindow);
  SetCapture(hwnd);
}

void updateResize(HWND hwnd) {
  if (!g_resizing) return;

  POINT point{};
  GetCursorPos(&point);
  const int dx = point.x - g_resizeStartPoint.x;
  const int dy = point.y - g_resizeStartPoint.y;
  const int minWidth = ui(kMinWindowWidth);
  const int minHeight = ui(kMinWindowHeight);
  RECT rect = g_resizeStartWindow;

  if (g_resizeHit == HTLEFT || g_resizeHit == HTTOPLEFT || g_resizeHit == HTBOTTOMLEFT) {
    rect.left = (std::min)(g_resizeStartWindow.left + dx, g_resizeStartWindow.right - minWidth);
  }
  if (g_resizeHit == HTRIGHT || g_resizeHit == HTTOPRIGHT || g_resizeHit == HTBOTTOMRIGHT) {
    rect.right = (std::max)(g_resizeStartWindow.right + dx, g_resizeStartWindow.left + minWidth);
  }
  if (g_resizeHit == HTTOP || g_resizeHit == HTTOPLEFT || g_resizeHit == HTTOPRIGHT) {
    rect.top = (std::min)(g_resizeStartWindow.top + dy, g_resizeStartWindow.bottom - minHeight);
  }
  if (g_resizeHit == HTBOTTOM || g_resizeHit == HTBOTTOMLEFT || g_resizeHit == HTBOTTOMRIGHT) {
    rect.bottom = (std::max)(g_resizeStartWindow.bottom + dy, g_resizeStartWindow.top + minHeight);
  }

  SetWindowPos(
      hwnd,
      nullptr,
      rect.left,
      rect.top,
      rect.right - rect.left,
      rect.bottom - rect.top,
      SWP_NOZORDER | SWP_NOACTIVATE);
}

void endResize() {
  if (!g_resizing) return;
  g_resizing = false;
  g_resizeHit = HTCLIENT;
  ReleaseCapture();
}

void setResizeCursor(const LRESULT hit) {
  LPCWSTR cursor = IDC_ARROW;
  if (hit == HTTOPLEFT || hit == HTBOTTOMRIGHT) cursor = IDC_SIZENWSE;
  if (hit == HTTOPRIGHT || hit == HTBOTTOMLEFT) cursor = IDC_SIZENESW;
  if (hit == HTLEFT || hit == HTRIGHT) cursor = IDC_SIZEWE;
  if (hit == HTTOP || hit == HTBOTTOM) cursor = IDC_SIZENS;
  SetCursor(LoadCursorW(nullptr, cursor));
}

void setWindowAttribute(const DWORD attribute, const void* value, const DWORD size) {
  DwmSetWindowAttribute(g_window, attribute, value, size);
}

void extendFrameIntoClientArea() {
  // Extend only the custom title bar into the DWM frame. The tab bar and
  // editor remain ordinary opaque client surfaces.
  const MARGINS margins{0, 0, ui(kTitleBarHeight), 0};
  DwmExtendFrameIntoClientArea(g_window, &margins);
}

void refreshFrame(HWND hwnd, const bool immediate) {
  UINT flags = RDW_INVALIDATE | RDW_ERASE | RDW_FRAME | RDW_ALLCHILDREN;
  if (immediate) flags |= RDW_UPDATENOW;
  RedrawWindow(hwnd, nullptr, nullptr, flags);
  if (immediate) DwmFlush();
}

void postFrameRefresh(HWND hwnd) {
  if (g_frameRefreshPosted) return;
  g_frameRefreshPosted = true;
  PostMessageW(hwnd, kFrameRefreshMessage, 0, 0);
}

void applyBackdropAttributes() {
  const int backdropType = g_backdrop == Backdrop::Mica
      ? kBackdropMica
      : g_backdrop == Backdrop::Acrylic ? kBackdropAcrylic : kBackdropTransparent;
  const BOOL darkMode = g_dark ? TRUE : FALSE;
  const int corner = kDwmCornerRound;
  const COLORREF border = kTransparentColor;

  setWindowAttribute(kDwmwaSystemBackdropType, &backdropType, sizeof(backdropType));
  setWindowAttribute(kDwmwaUseImmersiveDarkMode, &darkMode, sizeof(darkMode));
  setWindowAttribute(kDwmwaWindowCornerPreference, &corner, sizeof(corner));
  setWindowAttribute(kDwmwaBorderColor, &border, sizeof(border));
}

void rebuildDwmFrame(HWND hwnd, const bool frameChanged) {
  extendFrameIntoClientArea();
  if (frameChanged) {
    SetWindowPos(
        hwnd,
        nullptr,
        0,
        0,
        0,
        0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
  }
  refreshFrame(hwnd, true);
}

void applyBackdrop() {
  applyBackdropAttributes();
  rebuildDwmFrame(g_window, true);
}

void activateWindow(HWND hwnd) {
  const HWND foreground = GetForegroundWindow();
  const DWORD foregroundThread = foreground == nullptr
      ? 0
      : GetWindowThreadProcessId(foreground, nullptr);
  const DWORD currentThread = GetCurrentThreadId();
  const bool attached = foregroundThread != 0 && foregroundThread != currentThread &&
      AttachThreadInput(currentThread, foregroundThread, TRUE);

  ShowWindow(hwnd, SW_SHOWNORMAL);
  BringWindowToTop(hwnd);
  SetForegroundWindow(hwnd);
  SetActiveWindow(hwnd);
  SetFocus(hwnd);

  if (attached) {
    AttachThreadInput(currentThread, foregroundThread, FALSE);
  }
}

void drawText(HDC dc, const std::wstring& value, RECT rect, const int size, const bool bold, const UINT format) {
  SetBkMode(dc, TRANSPARENT);
  SetTextColor(dc, g_dark ? RGB(241, 244, 249) : RGB(28, 32, 38));
  HFONT font = CreateFontW(
      ui(size), 0, 0, 0, bold ? FW_SEMIBOLD : FW_NORMAL, FALSE, FALSE, FALSE,
      DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
      DEFAULT_PITCH | FF_DONTCARE, L"Microsoft YaHei UI");
  const HGDIOBJ oldFont = SelectObject(dc, font);
  DrawTextW(dc, value.c_str(), -1, &rect, format | DT_SINGLELINE | DT_VCENTER);
  SelectObject(dc, oldFont);
  DeleteObject(font);
}

void fillSolid(HDC dc, const RECT& rect, const COLORREF color) {
  HBRUSH brush = CreateSolidBrush(color);
  FillRect(dc, &rect, brush);
  DeleteObject(brush);
}

void drawButton(HDC dc, const RECT& rect, const std::wstring& label, const bool active, const bool hover) {
  const COLORREF fill = g_dark
      ? (hover ? RGB(62, 70, 82) : RGB(44, 50, 60))
      : (hover ? RGB(242, 246, 252) : RGB(229, 235, 243));
  const COLORREF border = g_dark ? RGB(116, 128, 145) : RGB(191, 201, 215);
  HBRUSH brush = CreateSolidBrush(fill);
  const int penWidth = active ? ui(2) : (ui(1) > 1 ? ui(1) : 1);
  HPEN pen = CreatePen(PS_SOLID, penWidth, active ? RGB(96, 130, 235) : border);
  const HGDIOBJ oldBrush = SelectObject(dc, brush);
  const HGDIOBJ oldPen = SelectObject(dc, pen);
  RoundRect(dc, rect.left, rect.top, rect.right, rect.bottom, ui(12), ui(12));
  SelectObject(dc, oldPen);
  SelectObject(dc, oldBrush);
  DeleteObject(pen);
  DeleteObject(brush);
  drawText(dc, label, rect, 14, active, DT_CENTER);
}

void drawTopControl(HDC dc, const RECT& rect, const std::wstring& label, const bool active, const bool hover) {
  if (active || hover) {
    const COLORREF fill = g_dark
        ? (active ? RGB(62, 70, 82) : RGB(49, 56, 68))
        : (active ? RGB(224, 232, 244) : RGB(242, 246, 252));
    fillSolid(dc, rect, fill);
  }
  drawText(dc, label, rect, label == L"×" ? 24 : 14, active, DT_CENTER);
}

void paint(HDC dc) {
  const RECT rect = clientRect();
  const int titleBarHeight = ui(kTitleBarHeight);
  const int tabBarTop = titleBarHeight;
  const int editorTop = ui(kTitleBarHeight + kTabBarHeight);
  const RECT titleBar{0, 0, rect.right, titleBarHeight};
  const RECT tabBar{0, tabBarTop, rect.right, editorTop};
  const RECT editor{0, editorTop, rect.right, rect.bottom};

  // The DWM-extended titlebar needs deterministic alpha-zero pixels beneath
  // the glass on every paint. Resetting it to black prevents preserved GDI
  // pixels (old tabs, title text or controls) from surviving DPI/resize frame
  // changes while still allowing DWM to render the native material.
  fillSolid(dc, titleBar, RGB(0, 0, 0));

  // The tab bar and editor remain opaque, matching the actual app layering.
  fillSolid(dc, tabBar, g_dark ? RGB(31, 37, 46) : RGB(238, 243, 249));
  fillSolid(dc, editor, g_dark ? RGB(28, 33, 41) : RGB(249, 250, 252));

  RECT tabDivider{0, editorTop - ui(1), rect.right, editorTop};
  fillSolid(dc, tabDivider, g_dark ? RGB(67, 76, 91) : RGB(210, 218, 229));

  RECT title{ui(24), 0, ui(280), titleBarHeight};
  drawText(dc, L"▣  拾笺", title, 22, true, DT_LEFT);

  const std::array<std::wstring, 4> tabs{L"win下方栏运行的图标还是...", L"GPT账号.txt", L"产品发布检查", L"Codex Auth"};
  const std::array<int, 4> tabWidths{220, 140, 160, 140};
  int tabX = ui(24);
  for (int i = 0; i < static_cast<int>(tabs.size()); ++i) {
    RECT tab{tabX, tabBarTop, tabX + ui(tabWidths[i]), editorTop};
    drawText(dc, tabs[i], tab, 16, i == 0, DT_LEFT);
    if (i == 0) {
      RECT underline{tab.left, editorTop - ui(2), tab.right, editorTop};
      fillSolid(dc, underline, g_dark ? RGB(133, 160, 239) : RGB(141, 165, 255));
    }
    tabX += ui(tabWidths[i] + 1);
  }
  RECT tabTools{rect.right - ui(220), tabBarTop, rect.right - ui(22), editorTop};
  drawText(dc, L"⌕   +   ⋯", tabTools, 22, false, DT_RIGHT);

  drawTopControl(dc, topControlRect(2), L"×", false, g_hoverButton == 5);
  drawTopControl(dc, topControlRect(1), L"设置", false, g_hoverButton == 4);
  drawTopControl(dc, topControlRect(0), L"置顶", g_alwaysOnTop, g_hoverButton == 3);

  const std::array<std::wstring, 3> labels{L"Mica", L"Acrylic", L"透明玻璃"};
  for (int i = 0; i < 3; ++i) {
    const bool active = (i == 0 && g_backdrop == Backdrop::Mica) ||
        (i == 1 && g_backdrop == Backdrop::Acrylic) ||
        (i == 2 && g_backdrop == Backdrop::Transparent);
    drawButton(dc, materialButtonRect(i), labels[i], active, g_hoverButton == i);
  }

  RECT heading{ui(34), ui(kTitleBarHeight + kTabBarHeight + 32), rect.right - ui(34), ui(kTitleBarHeight + kTabBarHeight + 90)};
  drawText(dc, L"Windows 原生系统材质", heading, 25, true, DT_LEFT);
  RECT description{ui(34), ui(kTitleBarHeight + kTabBarHeight + 98), rect.right - ui(34), ui(kTitleBarHeight + kTabBarHeight + 158)};
  const std::wstring material = g_backdrop == Backdrop::Mica
      ? L"当前：Mica · 长驻窗口材质 · 更稳定"
      : g_backdrop == Backdrop::Acrylic
          ? L"当前：Desktop Acrylic · 半透明磨砂材质"
          : L"当前：透明玻璃 · 无系统底色 · 保留绝对透明";
  drawText(dc, material, description, 16, false, DT_LEFT);

  RECT note{ui(34), ui(kTitleBarHeight + kTabBarHeight + 236), rect.right - ui(34), ui(kTitleBarHeight + kTabBarHeight + 296)};
  drawText(dc, L"上方顶栏使用 Windows DWM 绘制，编辑区保持不透明。", note, 15, false, DT_LEFT);
  RECT note2{ui(34), ui(kTitleBarHeight + kTabBarHeight + 304), rect.right - ui(34), ui(kTitleBarHeight + kTabBarHeight + 368)};
  drawText(dc, L"拖动空白顶栏区域，切换 Mica / Acrylic / 透明玻璃观察。", note2, 15, false, DT_LEFT);
}

void updateHover(POINT point) {
  const int old = g_hoverButton;
  g_hoverButton = -1;
  for (int i = 0; i < 3; ++i) {
    if (contains(materialButtonRect(i), point)) {
      g_hoverButton = i;
      break;
    }
  }
  if (g_hoverButton == -1) {
    for (int i = 0; i < 3; ++i) {
      if (contains(topControlRect(i), point)) {
        g_hoverButton = i + 3;
        break;
      }
    }
  }
  if (old != g_hoverButton) {
    refreshFrame(g_window, false);
  }
}

LRESULT CALLBACK windowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
  switch (message) {
    case WM_CREATE:
      g_window = hwnd;
      g_dpi = GetDpiForWindow(hwnd);

      // Remove the standard non-client frame before the DWM material is
      // extended. Without this frame change, Windows keeps the original
      // non-client surface above the custom titlebar, which can make the
      // titlebar appear as a blank white strip.
      {
        RECT windowRect{};
        GetWindowRect(hwnd, &windowRect);
        SetWindowPos(
            hwnd,
            nullptr,
            windowRect.left,
            windowRect.top,
            windowRect.right - windowRect.left,
            windowRect.bottom - windowRect.top,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
      }
      applyBackdrop();
      return 0;

    case WM_NCCALCSIZE:
      // Use the complete window rectangle as the client area. This is the
      // documented custom-frame path and lets our WM_PAINT handler draw the
      // title and controls inside the DWM-extended region.
      if (wParam) return 0;
      break;

    case WM_ACTIVATE:
      rebuildDwmFrame(hwnd, false);
      return 0;

    case WM_DPICHANGED: {
      g_dpi = HIWORD(wParam);
      const RECT* suggested = reinterpret_cast<const RECT*>(lParam);
      // The suggested rectangle is expressed in the new monitor DPI. Apply
      // it together with a frame change so the whole custom client frame is
      // rebuilt before DWM composites the new monitor surface.
      SetWindowPos(
          hwnd,
          nullptr,
          suggested->left,
          suggested->top,
          suggested->right - suggested->left,
          suggested->bottom - suggested->top,
          SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
      applyBackdropAttributes();
      rebuildDwmFrame(hwnd, false);
      return 0;
    }

    case WM_DWMCOMPOSITIONCHANGED:
      applyBackdrop();
      return 0;

    case WM_DISPLAYCHANGE:
      // A display topology or mode change can invalidate the redirected DWM
      // surface even when the window DPI itself does not change.
      applyBackdropAttributes();
      rebuildDwmFrame(hwnd, true);
      return 0;

    case WM_WINDOWPOSCHANGED:
      // Coalesce repaint requests generated by moving/resizing the custom
      // frame. Without this, stale redirected DWM pixels can remain visible
      // behind the next frame while several position messages are pending.
      postFrameRefresh(hwnd);
      return DefWindowProcW(hwnd, message, wParam, lParam);

    case WM_ENTERSIZEMOVE:
      refreshFrame(hwnd, false);
      return 0;

    case WM_EXITSIZEMOVE:
      refreshFrame(hwnd, true);
      return 0;

    case WM_NCHITTEST: {
      POINT point{GET_X_LPARAM(lParam), GET_Y_LPARAM(lParam)};
      ScreenToClient(hwnd, &point);
      const LRESULT resizeHit = resizeHitTest(point);
      // The window intentionally has no WS_THICKFRAME. Keep resize zones in
      // the client area and perform the resize ourselves, so DWM cannot
      // expose its outer frame as a visible white border.
      if (resizeHit != HTCLIENT) return HTCLIENT;
      if (point.y < ui(kTitleBarHeight)) {
        for (int i = 0; i < 3; ++i) {
          if (contains(topControlRect(i), point)) return HTCLIENT;
        }
        return HTCAPTION;
      }
      return HTCLIENT;
    }

    case WM_SETCURSOR: {
      POINT point{};
      GetCursorPos(&point);
      ScreenToClient(hwnd, &point);
      const LRESULT resizeHit = resizeHitTest(point);
      if (resizeHit != HTCLIENT) {
        setResizeCursor(resizeHit);
        return TRUE;
      }
      break;
    }

    case WM_LBUTTONDOWN: {
      POINT point{GET_X_LPARAM(lParam), GET_Y_LPARAM(lParam)};
      const LRESULT resizeHit = resizeHitTest(point);
      if (resizeHit != HTCLIENT) {
        beginResize(hwnd, resizeHit);
        return 0;
      }
      return 0;
    }

    case WM_MOUSEMOVE: {
      if (g_resizing) {
        updateResize(hwnd);
        return 0;
      }
      POINT point{GET_X_LPARAM(lParam), GET_Y_LPARAM(lParam)};
      updateHover(point);
      TRACKMOUSEEVENT tracking{sizeof(TRACKMOUSEEVENT), TME_LEAVE, hwnd, 0};
      TrackMouseEvent(&tracking);
      return 0;
    }

    case WM_MOUSELEAVE:
      g_hoverButton = -1;
      refreshFrame(hwnd, false);
      return 0;

    case WM_LBUTTONUP: {
      if (g_resizing) {
        endResize();
        refreshFrame(hwnd, true);
        return 0;
      }
      POINT point{GET_X_LPARAM(lParam), GET_Y_LPARAM(lParam)};
      for (int i = 0; i < 3; ++i) {
        if (!contains(materialButtonRect(i), point)) continue;
        if (i == 0) g_backdrop = Backdrop::Mica;
        if (i == 1) g_backdrop = Backdrop::Acrylic;
        if (i == 2) g_backdrop = Backdrop::Transparent;
        applyBackdrop();
        return 0;
      }
      for (int i = 0; i < 3; ++i) {
        if (!contains(topControlRect(i), point)) continue;
        if (i == 0) {
          g_alwaysOnTop = !g_alwaysOnTop;
          SetWindowPos(
              hwnd,
              g_alwaysOnTop ? HWND_TOPMOST : HWND_NOTOPMOST,
              0,
              0,
              0,
              0,
              SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        }
        if (i == 1) {
          g_dark = !g_dark;
          applyBackdrop();
        }
        if (i == 2) DestroyWindow(hwnd);
        return 0;
      }
      return 0;
    }

    case WM_CANCELMODE:
      endResize();
      refreshFrame(hwnd, true);
      return 0;

    case WM_PAINT: {
      PAINTSTRUCT paintStruct{};
      HDC dc = BeginPaint(hwnd, &paintStruct);
      paint(dc);
      EndPaint(hwnd, &paintStruct);
      return 0;
    }

    case kFrameRefreshMessage:
      g_frameRefreshPosted = false;
      refreshFrame(hwnd, true);
      return 0;

    case WM_ERASEBKGND: {
      // paint() resets the DWM titlebar to an alpha-zero black base. Erase
      // only the opaque tab/editor surfaces here so background erasure never
      // replaces the glass base with an opaque system brush.
      HDC dc = reinterpret_cast<HDC>(wParam);
      RECT clip{};
      if (GetClipBox(dc, &clip) == ERROR) return 1;
      const RECT client = clientRect();
      const RECT opaque{0, ui(kTitleBarHeight), client.right, client.bottom};
      RECT erase{};
      if (IntersectRect(&erase, &clip, &opaque)) {
        fillSolid(dc, erase, g_dark ? RGB(28, 33, 41) : RGB(249, 250, 252));
      }
      return 1;
    }

    case WM_DESTROY:
      PostQuitMessage(0);
      return 0;
  }
  return DefWindowProcW(hwnd, message, wParam, lParam);
}

} // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

  WNDCLASSEXW windowClass{sizeof(WNDCLASSEXW)};
  windowClass.hInstance = instance;
  windowClass.lpfnWndProc = windowProc;
  windowClass.lpszClassName = kClassName;
  windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  windowClass.hbrBackground = nullptr;
  if (!RegisterClassExW(&windowClass)) return 1;

  const UINT initialDpi = GetDpiForSystem();
  const int initialWidth = MulDiv(kWindowWidth, static_cast<int>(initialDpi), USER_DEFAULT_SCREEN_DPI);
  const int initialHeight = MulDiv(kWindowHeight, static_cast<int>(initialDpi), USER_DEFAULT_SCREEN_DPI);
  RECT workArea{};
  SystemParametersInfoW(SPI_GETWORKAREA, 0, &workArea, 0);
  const int initialX = workArea.left + ((workArea.right - workArea.left) - initialWidth) / 2;
  const int initialY = workArea.top + ((workArea.bottom - workArea.top) - initialHeight) / 2;

  HWND hwnd = CreateWindowExW(
      WS_EX_APPWINDOW,
      kClassName,
      L"拾笺 Native Glass Demo",
      WS_POPUP | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU,
      initialX,
      initialY,
      initialWidth,
      initialHeight,
      nullptr,
      nullptr,
      instance,
      nullptr);
  if (!hwnd) return 1;

  ShowWindow(hwnd, showCommand == SW_HIDE ? SW_SHOWNORMAL : showCommand);
  activateWindow(hwnd);
  UpdateWindow(hwnd);

  MSG message{};
  while (GetMessageW(&message, nullptr, 0, 0) > 0) {
    TranslateMessage(&message);
    DispatchMessageW(&message);
  }
  return static_cast<int>(message.wParam);
}
