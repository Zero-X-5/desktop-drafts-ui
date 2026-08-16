#pragma once

#include <windows.h>
#include <d3d11.h>
#include <d2d1_1.h>
#include <dwrite.h>
#include <wrl/client.h>

#include <microsoft.ui.composition.interop.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>

#include <winrt/base.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <winrt/Microsoft.UI.Composition.h>
#include <winrt/Microsoft.UI.Xaml.h>

#include <array>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <memory>
#include <thread>

namespace Shijian::LiquidGlass
{
    enum class GlassProfileId : uint32_t
    {
        Reference = 0,
        LongBar = 1,
    };

    struct RendererStats
    {
        double renderFps{};
        double captureFps{};
        double cpuMs{};
        uint32_t captureWidth{};
        uint32_t captureHeight{};
        uint64_t capturedFrames{};
        uint64_t droppedCaptureFrames{};
        uint64_t monitorRebinds{};
        double captureAgeMs{};
        uint64_t affinityFailures{};
        uint64_t screenshotBarrierTimeouts{};
        uint64_t deviceRemovedEvents{};
        uint64_t captureClosedEvents{};
        uint64_t captureRecoveryAttempts{};
        uint64_t captureRecoveryFailures{};
        uint32_t hostMonitorCount{};
        int32_t lastRenderHresult{};
        int32_t lastCaptureRecoveryHresult{};
        bool renderThreadAlive{};
        bool selfExcluded{};
        bool screenshotMode{};
    };

    // Product-oriented Liquid Glass renderer:
    // - WinUI/XAML owns layout/input/accessibility.
    // - Windows.Graphics.Capture owns the live monitor source.
    // - D3D11 owns the optical passes.
    // - Microsoft.UI.Composition owns final presentation in the XAML visual tree.
    //
    // Attach(), SetHostScreenRect(), and RequestCaptureRefresh() must be called
    // from the WinUI thread. The D3D11 immediate context and WGC frame
    // consumption/recovery are serialized on the internal render thread.
    class LiquidGlassRenderer final
    {
    public:
        LiquidGlassRenderer() = default;
        ~LiquidGlassRenderer();

        LiquidGlassRenderer(LiquidGlassRenderer const&) = delete;
        LiquidGlassRenderer& operator=(LiquidGlassRenderer const&) = delete;

        void Attach(
            winrt::Microsoft::UI::Xaml::UIElement const& compositionHost,
            HWND window,
            GlassProfileId profileId = GlassProfileId::Reference);

        void Detach();

        // screenRect is in physical screen pixels and includes the optical
        // shadow margin around the selected profile.
        void SetHostScreenRect(RECT const& screenRect, float rasterizationScale);

        // Force the current monitor capture session to be recreated even when
        // host geometry/DPI did not change. WM_DISPLAYCHANGE uses this to
        // recover from display-topology changes that invalidate a WGC item.
        void RequestCaptureRefresh();

        void SetPressed(bool pressed);

        // F2 workflow retained from sealed V9. The dual-sample test window does
        // not bind F2 because two independent renderers would require a shared
        // top-level affinity coordinator; the renderer API itself is unchanged.
        bool SetScreenshotMode(bool enabled);

        [[nodiscard]] RendererStats Stats() const;

    private:
        struct Impl;
        std::unique_ptr<Impl> m_impl;
    };
}
