
        ComPtr<ID3DBlob> CompileShader(
            char const* source,
            char const* target)
        {
            ComPtr<ID3DBlob> shader;
            ComPtr<ID3DBlob> errors;

            auto hr = D3DCompile(
                source,
                std::strlen(source),
                "ShijianLiquidGlass",
                nullptr,
                nullptr,
                "main",
                target,
                D3DCOMPILE_ENABLE_STRICTNESS |
                D3DCOMPILE_OPTIMIZATION_LEVEL3,
                0,
                &shader,
                &errors);

            if (FAILED(hr))
            {
                std::string detail =
                    errors
                    ? std::string(
                        static_cast<char*>(errors->GetBufferPointer()),
                        errors->GetBufferSize())
                    : "Unknown HLSL compiler error";

                OutputDebugStringA(detail.c_str());
                winrt::check_hresult(hr);
            }

            return shader;
        }
    }

    struct LiquidGlassRenderer::Impl
    {
        HWND window{};
        MUX::UIElement compositionHost{ nullptr };

        HANDLE stateEvent{};
        HANDLE captureEvent{};
        std::thread renderThread;

        std::atomic<bool> stop{ false };
        std::atomic<bool> pressed{ false };
        std::atomic<bool> screenshotMode{ false };
        std::atomic<bool> captureFrozen{ false };
        std::atomic<bool> captureRestartRequested{ false };

        // Serializes WGC frame consumption with F2 display-affinity transitions.
        // This makes "freeze before WDA_NONE" a real barrier instead of only an
        // atomic flag ordering convention.
        std::timed_mutex captureGate;

        // Bounds are a single coherent snapshot. LayoutUpdated may publish them
        // rapidly while the render thread is moving across monitors/DPI values.
        std::mutex boundsMutex;
        RECT desiredHostScreenRect{ 0,0,1,1 };
        float desiredRasterizationScale{ 1.0f };
        std::atomic<uint64_t> boundsRevision{};
        uint64_t appliedBoundsRevision{};

        RECT hostScreenRect{ 0,0,1,1 };
        float rasterizationScale{ 1.0f };
        HMONITOR captureMonitor{};
        LONG captureOriginX{};
        LONG captureOriginY{};
        UINT captureWidth{};
        UINT captureHeight{};

        // D3D/D2D.
        ComPtr<ID3D11Device> d3dDevice;
        ComPtr<ID3D11DeviceContext> d3dContext;
        ComPtr<ID2D1Factory1> d2dFactory;
        ComPtr<ID2D1Device> d2dDevice;
        ComPtr<ID2D1DeviceContext> d2dContext;

        ComPtr<ID3D11VertexShader> vertexShader;
        ComPtr<ID3D11PixelShader> sceneShader;
        ComPtr<ID3D11PixelShader> blurShader;
        ComPtr<ID3D11PixelShader> compositeShader;
        ComPtr<ID3D11SamplerState> sampler;
        ComPtr<ID3D11Buffer> sceneParamsBuffer;
        ComPtr<ID3D11Buffer> blurParamsBuffer;
        ComPtr<ID3D11Buffer> compositeParamsBuffer;

        ComPtr<ID3D11ShaderResourceView> displacementSrv;

        ComPtr<ID3D11Texture2D> sceneTexture;
        ComPtr<ID3D11RenderTargetView> sceneRtv;
        ComPtr<ID3D11ShaderResourceView> sceneSrv;

        ComPtr<ID3D11Texture2D> blurA;
        ComPtr<ID3D11RenderTargetView> blurARtv;
        ComPtr<ID3D11ShaderResourceView> blurASrv;

        ComPtr<ID3D11Texture2D> blurB;
        ComPtr<ID3D11RenderTargetView> blurBRtv;
        ComPtr<ID3D11ShaderResourceView> blurBSrv;

        ComPtr<ID3D11Texture2D> finalTexture;
        ComPtr<ID3D11RenderTargetView> finalRtv;
        ComPtr<IDXGISurface> finalDxgiSurface;
        ComPtr<ID2D1Bitmap1> finalBitmap;

        UINT outputWidth{ 1 };
        UINT outputHeight{ 1 };

        // Microsoft.UI.Composition bridge.
        MUC::Compositor compositor{ nullptr };
        MUC::CompositionGraphicsDevice compositionGraphicsDevice{ nullptr };
        MUC::CompositionDrawingSurface drawingSurface{ nullptr };
        MUC::CompositionSurfaceBrush surfaceBrush{ nullptr };
        MUC::SpriteVisual spriteVisual{ nullptr };
        winrt::com_ptr<abi_comp::ICompositionDrawingSurfaceInterop> drawingSurfaceInterop;

        // WGC.
        WGD11::IDirect3DDevice captureDevice{ nullptr };
        WGC::GraphicsCaptureItem captureItem{ nullptr };
        WGC::Direct3D11CaptureFramePool framePool{ nullptr };
        WGC::GraphicsCaptureSession captureSession{ nullptr };
        winrt::event_token frameArrivedToken{};
        winrt::event_token captureItemClosedToken{};

        ComPtr<ID3D11Texture2D> captureCopy;
        ComPtr<ID3D11ShaderResourceView> captureSrv;
        bool hasCaptureFrame{};

        // Reference lighting analysis cache.
        std::array<LensAnalysis, 629> lightingCache{};
        std::array<bool, 629> lightingCacheValid{};
        int lastLightKey{ INT32_MIN };
        float cosVal{};
        float sinVal{};
        float rimIntensity{ .6f };
        float rimFromRad{};
        std::array<float, kBins> rimProfile{};

        // Stats.
        std::atomic<double> renderFps{};
        std::atomic<double> captureFps{};
        std::atomic<double> cpuMs{};
        std::atomic<uint64_t> capturedFrames{};
        std::atomic<uint64_t> droppedCaptureFrames{};
        std::atomic<uint64_t> monitorRebinds{};
        std::atomic<int64_t> lastCaptureFrameTickNs{};
        std::atomic<uint64_t> affinityFailures{};
        std::atomic<uint64_t> screenshotBarrierTimeouts{};
        std::atomic<uint64_t> deviceRemovedEvents{};
        std::atomic<uint64_t> captureClosedEvents{};
        std::atomic<uint64_t> captureRecoveryAttempts{};
        std::atomic<uint64_t> captureRecoveryFailures{};
        std::atomic<uint32_t> publishedHostMonitorCount{};
        std::atomic<LONG> lastRenderHresult{};
        std::atomic<LONG> lastCaptureRecoveryHresult{};
        std::atomic<bool> renderThreadAlive{ false };
        std::atomic<uint32_t> publishedCaptureWidth{};
        std::atomic<uint32_t> publishedCaptureHeight{};
        uint64_t renderFramesWindow{};
        uint64_t captureFramesWindow{};
        std::chrono::steady_clock::time_point renderStatsStart{
            std::chrono::steady_clock::now() };
        std::chrono::steady_clock::time_point captureStatsStart{
            std::chrono::steady_clock::now() };

        void SignalState()
        {
            if (stateEvent)
            {
                SetEvent(stateEvent);
            }
        }

        void RequestCaptureRestart()
        {
            captureRestartRequested.store(true);
            SignalState();
        }

        void CreateDevices()
        {
            UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;

            D3D_FEATURE_LEVEL levels[]
            {
                D3D_FEATURE_LEVEL_11_1,
                D3D_FEATURE_LEVEL_11_0,
                D3D_FEATURE_LEVEL_10_1,
            };

            D3D_FEATURE_LEVEL actual{};

            winrt::check_hresult(D3D11CreateDevice(
                nullptr,
                D3D_DRIVER_TYPE_HARDWARE,
                nullptr,
                flags,
                levels,
                ARRAYSIZE(levels),
                D3D11_SDK_VERSION,
                &d3dDevice,
                &actual,
                &d3dContext));

            winrt::check_hresult(D2D1CreateFactory(
                D2D1_FACTORY_TYPE_MULTI_THREADED,
                __uuidof(ID2D1Factory1),
                nullptr,
                reinterpret_cast<void**>(d2dFactory.GetAddressOf())));

            ComPtr<IDXGIDevice> dxgiDevice;
            winrt::check_hresult(d3dDevice.As(&dxgiDevice));

            winrt::check_hresult(
                d2dFactory->CreateDevice(
                    dxgiDevice.Get(),
                    &d2dDevice));

            winrt::check_hresult(
                d2dDevice->CreateDeviceContext(
                    D2D1_DEVICE_CONTEXT_OPTIONS_NONE,
                    &d2dContext));

            // WinRT IDirect3DDevice wrapping the same D3D11 device for WGC.
            winrt::com_ptr<IInspectable> inspectable;
            winrt::check_hresult(
                CreateDirect3D11DeviceFromDXGIDevice(
                    dxgiDevice.Get(),
                    inspectable.put()));

            captureDevice =
                inspectable.as<WGD11::IDirect3DDevice>();
        }

        void CreateCompositionBridge()
        {
            // Get the compositor already associated with this XAML element.
            compositor =