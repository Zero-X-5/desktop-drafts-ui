#include "pch.h"
#include "MainWindow.xaml.h"

#if __has_include("MainWindow.g.cpp")
#include "MainWindow.g.cpp"
#endif

#include <cmath>

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Xaml::Input;

namespace winrt::LiquidGlassWinUI::implementation
{
    MainWindow::MainWindow()
    {
        InitializeComponent();

        auto windowNative = this->as<::IWindowNative>();
        check_hresult(windowNative->get_WindowHandle(&m_hwnd));

        RootGrid().Loaded({ this, &MainWindow::OnLoaded });
        RootGrid().LayoutUpdated({ this, &MainWindow::OnLayoutUpdated });

        SetWindowSubclass(
            m_hwnd,
            &MainWindow::WindowSubclassProc,
            0x4C475631, // "LGV1"
            reinterpret_cast<DWORD_PTR>(this));
    }

    MainWindow::~MainWindow()
    {
        if (m_statsTimer)
        {
            m_statsTimer.Stop();
        }

        m_renderer.Detach();

        if (m_hwnd)
        {
            RemoveWindowSubclass(
                m_hwnd,
                &MainWindow::WindowSubclassProc,
                0x4C475631);
        }
    }

    void MainWindow::OnLoaded(
        IInspectable const&,
        RoutedEventArgs const&)
    {
        m_renderer.Attach(
            GlassSurfaceHost(),
            m_hwnd);

        UpdateGlassScreenRect();

        auto dispatcher = RootGrid().DispatcherQueue();

        m_statsTimer = dispatcher.CreateTimer();
        m_statsTimer.Interval(std::chrono::milliseconds(250));
        m_statsTimer.IsRepeating(true);

        m_statsTimer.Tick(
            [this](auto const&, auto const&)
            {
                if (m_debugVisible)
                {
                    RefreshDebugText();
                }
            });

        m_statsTimer.Start();
    }

    void MainWindow::OnLayoutUpdated(
        IInspectable const&,
        IInspectable const&)
    {
        UpdateGlassScreenRect();
    }

    void MainWindow::UpdateGlassScreenRect()
    {
        if (!m_hwnd || !GlassSurfaceHost())
        {
            return;
        }

        auto root =
            Content().try_as<UIElement>();

        if (!root)
        {
            return;
        }

        auto transform =
            GlassSurfaceHost().TransformToVisual(root);

        auto topLeftDip =
            transform.TransformPoint({ 0, 0 });

        float scale =
            static_cast<float>(GetDpiForWindow(m_hwnd)) / 96.0f;

        POINT topLeftClient
        {
            static_cast<LONG>(
                std::lround(topLeftDip.X * scale)),
            static_cast<LONG>(
                std::lround(topLeftDip.Y * scale)),
        };

        ClientToScreen(m_hwnd, &topLeftClient);

        LONG widthPx =
            std::max<LONG>(
                1,
                static_cast<LONG>(
                    std::lround(
                        GlassSurfaceHost().ActualWidth() * scale)));

        LONG heightPx =
            std::max<LONG>(
                1,
                static_cast<LONG>(
                    std::lround(
                        GlassSurfaceHost().ActualHeight() * scale)));

        RECT rect
        {
            topLeftClient.x,
            topLeftClient.y,
            topLeftClient.x + widthPx,
            topLeftClient.y + heightPx,
        };

        if (EqualRect(&rect, &m_lastGlassRect) &&
            std::abs(scale - m_lastScale) < .0001f)
        {
            return;
        }

        m_lastGlassRect = rect;
        m_lastScale = scale;

        m_renderer.SetHostScreenRect(
            rect,
            scale);
    }

    void MainWindow::GlassButton_PointerPressed(
        IInspectable const&,
        PointerRoutedEventArgs const&)
    {
        m_renderer.SetPressed(true);

        // Keep the XAML content synchronized with the native optical shape.
        GlassButtonScale().ScaleX(.96);
        GlassButtonScale().ScaleY(.96);
    }

    void MainWindow::GlassButton_PointerReleased(
        IInspectable const&,
        PointerRoutedEventArgs const&)
    {
        m_renderer.SetPressed(false);
        GlassButtonScale().ScaleX(1.0);
        GlassButtonScale().ScaleY(1.0);
    }

    void MainWindow::GlassButton_PointerCanceled(
        IInspectable const&,
        PointerRoutedEventArgs const&)
    {
        m_renderer.SetPressed(false);
        GlassButtonScale().ScaleX(1.0);
        GlassButtonScale().ScaleY(1.0);
    }

    void MainWindow::GlassButton_Click(
        IInspectable const&,
        RoutedEventArgs const&)
    {
        // Product action goes here.
    }

    void MainWindow::ToggleDebug()
    {
        m_debugVisible = !m_debugVisible;

        DebugPanel().Visibility(
            m_debugVisible
            ? Visibility::Visible
            : Visibility::Collapsed);

        if (m_debugVisible)
        {
            RefreshDebugText();
        }
    }

    void MainWindow::ToggleScreenshotMode()
    {
        bool requested = !m_screenshotMode;
        if (m_renderer.SetScreenshotMode(requested))
        {
            m_screenshotMode = requested;
        }

        if (m_debugVisible)
        {
            RefreshDebugText();
        }
    }

    void MainWindow::RefreshDebugText()
    {
        auto s = m_renderer.Stats();

        wchar_t text[896]{};

        swprintf_s(
            text,
            ARRAYSIZE(text),
            L"Liquid Glass WinUI V9 recovery\n"
            L"render %.1f fps   WGC %.1f fps   CPU %.2f ms   thread=%s\n"
            L"capture %ux%u   frames %llu   dropped %llu   age %.0f ms\n"
            L"rebinds %llu   closed %llu   recovery %llu/%llu   rec-hr=0x%08X\n"
            L"affinity-fail %llu   barrier-timeout %llu   monitors %u\n"
            L"device-removed %llu   hr=0x%08X\n"
            L"self-excluded=%s   screenshot-mode=%s",
            s.renderFps,
            s.captureFps,
            s.cpuMs,
            s.renderThreadAlive ? L"ALIVE" : L"DEAD",
            s.captureWidth,
            s.captureHeight,
            static_cast<unsigned long long>(s.capturedFrames),
            static_cast<unsigned long long>(s.droppedCaptureFrames),
            s.captureAgeMs,
            static_cast<unsigned long long>(s.monitorRebinds),
            static_cast<unsigned long long>(s.captureClosedEvents),
            static_cast<unsigned long long>(s.captureRecoveryAttempts),
            static_cast<unsigned long long>(s.captureRecoveryFailures),
            static_cast<unsigned int>(s.lastCaptureRecoveryHresult),
            static_cast<unsigned long long>(s.affinityFailures),
            static_cast<unsigned long long>(s.screenshotBarrierTimeouts),
            s.hostMonitorCount,
            static_cast<unsigned long long>(s.deviceRemovedEvents),
            static_cast<unsigned int>(s.lastRenderHresult),
            s.selfExcluded ? L"YES" : L"NO",
            s.screenshotMode ? L"ON (frozen)" : L"OFF");

        DebugText().Text(text);
    }

    LRESULT CALLBACK MainWindow::WindowSubclassProc(
        HWND hwnd,
        UINT message,
        WPARAM wParam,
        LPARAM lParam,
        UINT_PTR subclassId,
        DWORD_PTR refData)
    {
        auto self =
            reinterpret_cast<MainWindow*>(refData);

        if (self)
        {
            switch (message)
            {
            case WM_WINDOWPOSCHANGED:
            case WM_DPICHANGED:
                self->UpdateGlassScreenRect();
                break;

            case WM_DISPLAYCHANGE:
                // Display topology/mode changes can invalidate a WGC item even
                // when the glass RECT and DPI are unchanged. Force a capture
                // refresh independently of the geometry de-duplication path.
                self->m_renderer.RequestCaptureRefresh();
                self->UpdateGlassScreenRect();
                break;

            case WM_KEYDOWN:
                if (wParam == VK_F1)
                {
                    self->ToggleDebug();
                    return 0;
                }

                if (wParam == VK_F2)
                {
                    // Ignore keyboard autorepeat; one physical F2 press must
                    // produce exactly one affinity/freeze transition.
                    if ((lParam & (1LL << 30)) == 0)
                    {
                        self->ToggleScreenshotMode();
                    }
                    return 0;
                }
                break;

            case WM_NCDESTROY:
                RemoveWindowSubclass(
                    hwnd,
                    &MainWindow::WindowSubclassProc,
                    subclassId);
                break;
            }
        }

        return DefSubclassProc(
            hwnd,
            message,
            wParam,
            lParam);
    }
}