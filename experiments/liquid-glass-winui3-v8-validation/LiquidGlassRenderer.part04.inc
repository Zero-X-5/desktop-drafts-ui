        }

        void RecreateOutputTextures(UINT width, UINT height)
        {
            outputWidth = std::max<UINT>(1, width);
            outputHeight = std::max<UINT>(1, height);

            sceneSrv.Reset();
            sceneRtv.Reset();
            sceneTexture.Reset();

            blurASrv.Reset();
            blurARtv.Reset();
            blurA.Reset();

            blurBSrv.Reset();
            blurBRtv.Reset();
            blurB.Reset();

            finalBitmap.Reset();
            finalDxgiSurface.Reset();
            finalRtv.Reset();
            finalTexture.Reset();

            CreateTargetTexture(
                outputWidth,
                outputHeight,
                sceneTexture,
                sceneRtv,
                sceneSrv);

            CreateTargetTexture(
                outputWidth,
                outputHeight,
                blurA,
                blurARtv,
                blurASrv);

            CreateTargetTexture(
                outputWidth,
                outputHeight,
                blurB,
                blurBRtv,
                blurBSrv);

            // Final texture only needs to be rendered to and read by D2D.
            D3D11_TEXTURE2D_DESC finalDesc{};
            finalDesc.Width = outputWidth;
            finalDesc.Height = outputHeight;
            finalDesc.MipLevels = 1;
            finalDesc.ArraySize = 1;
            finalDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
            finalDesc.SampleDesc.Count = 1;
            finalDesc.Usage = D3D11_USAGE_DEFAULT;
            finalDesc.BindFlags =
                D3D11_BIND_RENDER_TARGET |
                D3D11_BIND_SHADER_RESOURCE;

            winrt::check_hresult(
                d3dDevice->CreateTexture2D(
                    &finalDesc,
                    nullptr,
                    &finalTexture));

            winrt::check_hresult(
                d3dDevice->CreateRenderTargetView(
                    finalTexture.Get(),
                    nullptr,
                    &finalRtv));

            winrt::check_hresult(
                finalTexture.As(&finalDxgiSurface));

            D2D1_BITMAP_PROPERTIES1 properties{};
            properties.pixelFormat.format =
                DXGI_FORMAT_B8G8R8A8_UNORM;
            properties.pixelFormat.alphaMode =
                D2D1_ALPHA_MODE_PREMULTIPLIED;
            properties.dpiX = 96.0f;
            properties.dpiY = 96.0f;
            properties.bitmapOptions =
                D2D1_BITMAP_OPTIONS_NONE;

            winrt::check_hresult(
                d2dContext->CreateBitmapFromDxgiSurface(
                    finalDxgiSurface.Get(),
                    &properties,
                    &finalBitmap));

            SIZE surfaceSize
            {
                static_cast<LONG>(outputWidth),
                static_cast<LONG>(outputHeight)
            };

            winrt::check_hresult(
                drawingSurfaceInterop->Resize(surfaceSize));
        }

        void CreateCaptureCopy(UINT width, UINT height)
        {
            captureSrv.Reset();
            captureCopy.Reset();

            D3D11_TEXTURE2D_DESC desc{};
            desc.Width = width;
            desc.Height = height;
            desc.MipLevels = 1;
            desc.ArraySize = 1;
            desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
            desc.SampleDesc.Count = 1;
            desc.Usage = D3D11_USAGE_DEFAULT;
            desc.BindFlags = D3D11_BIND_SHADER_RESOURCE;

            winrt::check_hresult(
                d3dDevice->CreateTexture2D(
                    &desc,
                    nullptr,
                    &captureCopy));

            winrt::check_hresult(
                d3dDevice->CreateShaderResourceView(
                    captureCopy.Get(),
                    nullptr,
                    &captureSrv));
        }

        void StopCapture()
        {
            try
            {
                if (framePool)
                {
                    framePool.FrameArrived(frameArrivedToken);
                }
            }
            catch (...) {}

            try
            {
                if (captureSession)
                {
                    captureSession.Close();
                }
            }
            catch (...) {}

            try
            {
                if (framePool)
                {
                    framePool.Close();
                }
            }
            catch (...) {}

            captureSession = nullptr;
            framePool = nullptr;
            captureItem = nullptr;
            captureMonitor = nullptr;
            hasCaptureFrame = false;

            captureSrv.Reset();
            captureCopy.Reset();

            captureWidth = 0;
            captureHeight = 0;
            publishedCaptureWidth.store(0);
            publishedCaptureHeight.store(0);
        }

        void StartCapture(HMONITOR monitor)
        {
            StopCapture();

            if (!monitor)
            {
                return;
            }

            if (!WGC::GraphicsCaptureSession::IsSupported())
            {
                throw winrt::hresult_error(E_NOTIMPL);
            }

            auto interopFactory =
                winrt::get_activation_factory<
                    WGC::GraphicsCaptureItem,
                    IGraphicsCaptureItemInterop>();

            WGC::GraphicsCaptureItem item{ nullptr };

            winrt::check_hresult(
                interopFactory->CreateForMonitor(
                    monitor,
                    winrt::guid_of<WGC::GraphicsCaptureItem>(),
                    winrt::put_abi(item)));

            auto size = item.Size();

            if (size.Width <= 0 || size.Height <= 0)
            {
                throw winrt::hresult_error(E_FAIL);
            }

            captureItem = item;
            captureWidth = static_cast<UINT>(size.Width);
            captureHeight = static_cast<UINT>(size.Height);
            publishedCaptureWidth.store(captureWidth);
            publishedCaptureHeight.store(captureHeight);

            MONITORINFO info{ sizeof(info) };

            if (!GetMonitorInfoW(monitor, &info))
            {
                throw winrt::hresult_error(HRESULT_FROM_WIN32(GetLastError()));
            }

            captureOriginX = info.rcMonitor.left;
            captureOriginY = info.rcMonitor.top;

            CreateCaptureCopy(captureWidth, captureHeight);

            framePool =
                WGC::Direct3D11CaptureFramePool::CreateFreeThreaded(
                    captureDevice,
                    WGD::DirectXPixelFormat::B8G8R8A8UIntNormalized,
                    2,
                    size);

            frameArrivedToken =
                framePool.FrameArrived(
                    [this](auto const&, auto const&)
                    {
                        if (!captureFrozen.load() && captureEvent)
                        {
                            SetEvent(captureEvent);
                        }
                    });

            captureSession =
                framePool.CreateCaptureSession(captureItem);

            try
            {
                captureSession.IsCursorCaptureEnabled(false);
            }
            catch (...) {}

            captureSession.StartCapture();

            captureMonitor = monitor;
            hasCaptureFrame = false;
            monitorRebinds.fetch_add(1);
        }

        void DrainCaptureFrames()
        {
            std::scoped_lock captureLock(captureGate);

            if (!framePool || captureFrozen.load())
            {
                return;
            }

            try
            {
                WGC::Direct3D11CaptureFrame latest{ nullptr };
                uint64_t dequeuedFrames{};

                for (;;)
                {
                    auto frame = framePool.TryGetNextFrame();

                    if (!frame)
                    {
                        break;
                    }

                    ++dequeuedFrames;
