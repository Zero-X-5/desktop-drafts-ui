#pragma once

#include "MainWindow.g.h"
#include "LiquidGlassRenderer.h"

#include <microsoft.ui.xaml.window.h>
#include <commctrl.h>

namespace winrt::LiquidGlassWinUI::implementation
{
    struct MainWindow : MainWindowT<MainWindow>
    {
        MainWindow();
        ~MainWindow();

        void GlassButton_PointerPressed(
            winrt::Windows::Foundation::IInspectable const&,
            winrt::Microsoft::UI::Xaml::Input::PointerRoutedEventArgs const&);

        void GlassButton_PointerReleased(
            winrt::Windows::Foundation::IInspectable const&,
            winrt::Microsoft::UI::Xaml::Input::PointerRoutedEventArgs const&);

        void GlassButton_PointerCanceled(
            winrt::Windows::Foundation::IInspectable const&,
            winrt::Microsoft::UI::Xaml::Input::PointerRoutedEventArgs const&);

        void GlassButton_Click(
            winrt::Windows::Foundation::IInspectable const&,
            winrt::Microsoft::UI::Xaml::RoutedEventArgs const&);

    private:
        static LRESULT CALLBACK WindowSubclassProc(
            HWND hwnd,
            UINT message,
            WPARAM wParam,
            LPARAM lParam,
            UINT_PTR subclassId,
            DWORD_PTR refData);

        void OnLoaded(
            winrt::Windows::Foundation::IInspectable const&,
            winrt::Microsoft::UI::Xaml::RoutedEventArgs const&);

        void OnLayoutUpdated(
            winrt::Windows::Foundation::IInspectable const&,
            winrt::Windows::Foundation::IInspectable const&);

        void UpdateGlassScreenRect();
        void ToggleDebug();
        void ToggleScreenshotMode();
        void RefreshDebugText();

        HWND m_hwnd{};
        Shijian::LiquidGlass::LiquidGlassRenderer m_renderer;

        winrt::Microsoft::UI::Dispatching::DispatcherQueueTimer m_statsTimer{ nullptr };
        bool m_debugVisible{};
        bool m_screenshotMode{};
        RECT m_lastGlassRect{};
        float m_lastScale{};
    };
}

namespace winrt::LiquidGlassWinUI::factory_implementation
{
    struct MainWindow : MainWindowT<MainWindow, implementation::MainWindow>
    {
    };
}
