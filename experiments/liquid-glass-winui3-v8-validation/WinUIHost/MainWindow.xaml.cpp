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
    namespace
    {
        constexpr float kWindowWidthDip = 430.0f;
        constexpr float kWindowHeightDip = 520.0f;
    }

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
            0x4C475457, // "LGTW"
            reinterpret_cast<DWORD_PTR>(this));
    }

    MainWindow::~MainWindow()
    {
        m_longBarRenderer.Detach();
        m_renderer.Detach();

        if (m_hwnd)
        {
            RemoveWindowSubclass(
                m_hwnd,
                &MainWindow::WindowSubclassProc,
                0x4C475457);
        }
    }

    void MainWindow::ConfigureTestWindow()
    {
        if (!m_hwnd)
        {
            return;
        }

        // Keep the normal Windows caption/title bar. It is intentionally the
        // only drag surface in this test window; no custom transparent chrome.
        float scale =
            static_cast<float>(GetDpiForWindow(m_hwnd)) / 96.0f;

        int width = std::max(
            1,
            static_cast<int>(std::lround(kWindowWidthDip * scale)));
        int height = std::max(
            1,
            static_cast<int>(std::lround(kWindowHeightDip * scale)));

        SetWindowPos(
            m_hwnd,
            nullptr,
            0,
            0,
            width,
            height,
            SWP_NOMOVE |
            SWP_NOZORDER |
            SWP_NOACTIVATE);
    }

    void MainWindow::OnLoaded(
        IInspectable const&,
        RoutedEventArgs const&)
    {
        ConfigureTestWindow();

        m_renderer.Attach(
            GlassSurfaceHost(),
            m_hwnd,
            Shijian::LiquidGlass::GlassProfileId::Reference);

        m_longBarRenderer.Attach(
            LongBarSurfaceHost(),
            m_hwnd,
            Shijian::LiquidGlass::GlassProfileId::LongBar);

        UpdateGlassScreenRect();
    }

    void MainWindow::OnLayoutUpdated(
        IInspectable const&,
        IInspectable const&)
    {
        UpdateGlassScreenRect();
    }

    void MainWindow::UpdateGlassScreenRect()
    {
        if (!m_hwnd || !GlassSurfaceHost() || !LongBarSurfaceHost())
        {
            return;
        }

        auto root = Content().try_as<UIElement>();
        if (!root)
        {
            return;
        }

        float scale =
            static_cast<float>(GetDpiForWindow(m_hwnd)) / 96.0f;

        auto screenRectFor =
            [&](FrameworkElement const& host)
            {
                auto transform = host.TransformToVisual(root);
                auto topLeftDip = transform.TransformPoint({ 0, 0 });

                POINT topLeftClient
                {
                    static_cast<LONG>(std::lround(topLeftDip.X * scale)),
                    static_cast<LONG>(std::lround(topLeftDip.Y * scale)),
                };

                ClientToScreen(m_hwnd, &topLeftClient);

                LONG widthPx = std::max<LONG>(
                    1,
                    static_cast<LONG>(std::lround(
                        host.ActualWidth() * scale)));

                LONG heightPx = std::max<LONG>(
                    1,
                    static_cast<LONG>(std::lround(
                        host.ActualHeight() * scale)));

                return RECT
                {
                    topLeftClient.x,
                    topLeftClient.y,
                    topLeftClient.x + widthPx,
                    topLeftClient.y + heightPx,
                };
            };

        RECT referenceRect = screenRectFor(GlassSurfaceHost());
        RECT longBarRect = screenRectFor(LongBarSurfaceHost());
        bool scaleChanged = std::abs(scale - m_lastScale) >= .0001f;

        if (scaleChanged || !EqualRect(&referenceRect, &m_lastGlassRect))
        {
            m_lastGlassRect = referenceRect;
            m_renderer.SetHostScreenRect(referenceRect, scale);
        }

        if (scaleChanged || !EqualRect(&longBarRect, &m_lastLongBarRect))
        {
            m_lastLongBarRect = longBarRect;
            m_longBarRenderer.SetHostScreenRect(longBarRect, scale);
        }

        m_lastScale = scale;
    }

    void MainWindow::GlassButton_PointerPressed(
        IInspectable const&,
        PointerRoutedEventArgs const&)
    {
        m_renderer.SetPressed(true);
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
        // Visual reference only.
    }

    LRESULT CALLBACK MainWindow::WindowSubclassProc(
        HWND hwnd,
        UINT message,
        WPARAM wParam,
        LPARAM lParam,
        UINT_PTR subclassId,
        DWORD_PTR refData)
    {
        auto self = reinterpret_cast<MainWindow*>(refData);

        if (self)
        {
            switch (message)
            {
            case WM_WINDOWPOSCHANGED:
                self->UpdateGlassScreenRect();
                break;

            case WM_DPICHANGED:
                self->ConfigureTestWindow();
                self->UpdateGlassScreenRect();
                break;

            case WM_DISPLAYCHANGE:
                self->m_renderer.RequestCaptureRefresh();
                self->m_longBarRenderer.RequestCaptureRefresh();
                self->UpdateGlassScreenRect();
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
