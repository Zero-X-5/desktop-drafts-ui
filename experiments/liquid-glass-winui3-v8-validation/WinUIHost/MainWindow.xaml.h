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

        void ConfigureTestWindow();
        void UpdateGlassScreenRect();

        HWND m_hwnd{};
        Shijian::LiquidGlass::LiquidGlassRenderer m_renderer;
        Shijian::LiquidGlass::LiquidGlassRenderer m_longBarRenderer;

        RECT m_lastGlassRect{};
        RECT m_lastLongBarRect{};
        float m_lastScale{};
    };
}

namespace winrt::LiquidGlassWinUI::factory_implementation
{
    struct MainWindow : MainWindowT<MainWindow, implementation::MainWindow>
    {
    };
}
