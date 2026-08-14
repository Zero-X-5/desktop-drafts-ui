                    nullptr,
                    __uuidof(ID2D1DeviceContext),
                    drawContext.put_void(),
                    &updateOffset);

            if (hr == DXGI_ERROR_DEVICE_REMOVED)
            {
                deviceRemovedEvents.fetch_add(1);
                HRESULT reason = d3dDevice ? d3dDevice->GetDeviceRemovedReason() : hr;
                lastRenderHresult.store(static_cast<LONG>(reason));
                winrt::throw_hresult(FAILED(reason) ? reason : hr);
            }

            winrt::check_hresult(hr);

            drawContext->SetUnitMode(D2D1_UNIT_MODE_PIXELS);

            drawContext->SetTransform(
                D2D1::Matrix3x2F::Translation(
                    static_cast<float>(updateOffset.x),
                    static_cast<float>(updateOffset.y)));

            // Composition interop requires every pixel in the update to be
            // initialized. Clear first, then copy the premultiplied result.
            drawContext->Clear(D2D1::ColorF(0, 0.0f));

            D2D1_RECT_F destination
            {
                0,
                0,
                static_cast<float>(outputWidth),
                static_cast<float>(outputHeight),
            };

            drawContext->DrawBitmap(
                finalBitmap.Get(),
                &destination,
                1.0f,
                D2D1_INTERPOLATION_MODE_LINEAR,
                nullptr);

            winrt::check_hresult(
                drawingSurfaceInterop->EndDraw());
        }

        void RecoverCaptureIfNeeded()
        {
            if (!captureRestartRequested.load())
            {
                return;
            }

            // Recovery mutates the WGC session, so it participates in the same
            // gate as DrainCaptureFrames/F2. This preserves V8's strict rule:
            // no capture-session work can cross the freeze -> WDA_NONE barrier.
            std::scoped_lock recoveryLock(captureGate);

            if (captureFrozen.load())
            {
                // Keep the request pending. F2 OFF signals the render thread and
                // recovery will run only after exclusion has been restored.
                return;
            }

            if (!captureRestartRequested.exchange(false))
            {
                return;
            }

            constexpr int kMaxRecoveryAttempts = 3;
            HRESULT lastFailure = E_FAIL;

            for (int attempt = 0; attempt < kMaxRecoveryAttempts; ++attempt)
            {
                captureRecoveryAttempts.fetch_add(1);

                RECT rect = hostScreenRect;
                HMONITOR monitor =
                    MonitorFromRect(
                        &rect,
                        MONITOR_DEFAULTTONEAREST);

                if (!monitor)
                {
                    lastFailure = HRESULT_FROM_WIN32(ERROR_NOT_FOUND);
                    captureRecoveryFailures.fetch_add(1);
                }
                else
                {
                    try
                    {
                        StartCapture(monitor);
                        lastCaptureRecoveryHresult.store(S_OK);
                        return;
                    }
                    catch (winrt::hresult_error const& error)
                    {
                        lastFailure = error.code();

                        // Capture-session failures are recoverable, but a real
                        // D3D device removal remains a V8/V9 Phase-2 boundary:
                        // surface it as DEAD instead of hiding it in retries.
                        HRESULT deviceReason =
                            d3dDevice
                            ? d3dDevice->GetDeviceRemovedReason()
                            : S_OK;

                        if (FAILED(deviceReason))
                        {
                            deviceRemovedEvents.fetch_add(1);
                            lastRenderHresult.store(
                                static_cast<LONG>(deviceReason));
                            winrt::throw_hresult(deviceReason);
                        }

                        captureRecoveryFailures.fetch_add(1);
                    }
                    catch (...)
                    {
                        lastFailure = E_FAIL;
                        captureRecoveryFailures.fetch_add(1);
                    }
                }

                if (attempt + 1 < kMaxRecoveryAttempts)
                {
                    std::this_thread::sleep_for(
                        std::chrono::milliseconds(50 * (attempt + 1)));
                }
            }

            lastCaptureRecoveryHresult.store(
                static_cast<LONG>(lastFailure));
        }

        void ApplyBoundsIfNeeded()
        {
            uint64_t revision = boundsRevision.load();

            if (revision == appliedBoundsRevision)
            {
                return;
            }

            RECT desiredRect{};
            float desiredScale{};
            {
                std::scoped_lock boundsLock(boundsMutex);
                desiredRect = desiredHostScreenRect;
                desiredScale = desiredRasterizationScale;
            }

            appliedBoundsRevision = revision;
            hostScreenRect = desiredRect;
            rasterizationScale = desiredScale;

            UINT width =
                std::max<LONG>(
                    1,
                    hostScreenRect.right - hostScreenRect.left);

            UINT height =
                std::max<LONG>(
                    1,
                    hostScreenRect.bottom - hostScreenRect.top);

            if (width != outputWidth ||
                height != outputHeight)
            {
                RecreateOutputTextures(width, height);
            }

            RECT rect = hostScreenRect;
            publishedHostMonitorCount.store(CountIntersectingMonitors(rect));

            HMONITOR monitor =
                MonitorFromRect(
                    &rect,
                    MONITOR_DEFAULTTONEAREST);

            if (monitor != captureMonitor)
            {
                captureRestartRequested.store(true);
            }
        }

        void RenderThreadMain()
        {
            winrt::init_apartment(
                winrt::apartment_type::multi_threaded);
            renderThreadAlive.store(true);
            lastRenderHresult.store(S_OK);
            lastCaptureRecoveryHresult.store(S_OK);

            try
            {
                while (!stop.load())
                {
                    ApplyBoundsIfNeeded();
                    RecoverCaptureIfNeeded();

                    HANDLE handles[]
                    {
                        stateEvent,
                        captureEvent,
                    };

                    DWORD wait =
                        WaitForMultipleObjects(
                            ARRAYSIZE(handles),
                            handles,
                            FALSE,
                            INFINITE);

                    if (stop.load())
                    {
                        break;
                    }

                    if (wait == WAIT_OBJECT_0 + 1)
                    {
                        DrainCaptureFrames();
                    }

                    ApplyBoundsIfNeeded();
                    RecoverCaptureIfNeeded();

                    if (!captureFrozen.load())
                    {
                        DrainCaptureFrames();
                        RecoverCaptureIfNeeded();
                    }

                    if (!hasCaptureFrame)
                    {
                        continue;
                    }

                    RenderOptics();
                }
            }
            catch (winrt::hresult_error const& error)
            {
                lastRenderHresult.store(static_cast<LONG>(error.code()));
                OutputDebugStringW(error.message().c_str());
            }
            catch (...)
            {
                lastRenderHresult.store(E_FAIL);
                OutputDebugStringW(L"LiquidGlassRenderer: unknown render-thread failure\n");
            }

            renderThreadAlive.store(false);
            StopCapture();
            winrt::uninit_apartment();
        }

        void StartThread()
        {
            stateEvent =
                CreateEventW(
                    nullptr,
                    FALSE,
                    FALSE,
                    nullptr);

            captureEvent =
                CreateEventW(
                    nullptr,
                    FALSE,
                    FALSE,
                    nullptr);

            if (!stateEvent || !captureEvent)
            {
                throw winrt::hresult_error(
                    HRESULT_FROM_WIN32(GetLastError()));
            }

            renderThread =
                std::thread(
                    [this]
                    {
                        RenderThreadMain();
                    });
        }

        void StopThread()
        {
            stop.store(true);

            if (stateEvent)
            {
                SetEvent(stateEvent);
            }

            if (captureEvent)
            {
                SetEvent(captureEvent);
            }

            if (renderThread.joinable())
            {
                renderThread.join();
            }

            if (captureEvent)
            {
                CloseHandle(captureEvent);
                captureEvent = nullptr;
            }

            if (stateEvent)
            {
                CloseHandle(stateEvent);
                stateEvent = nullptr;
            }
        }
    };

    LiquidGlassRenderer::~LiquidGlassRenderer()
    {
        Detach();
    }

    void LiquidGlassRenderer::Attach(
        MUX::UIElement const& compositionHost,
        HWND window)
    {
        Detach();

        auto impl = std::make_unique<Impl>();
        impl->window = window;
        impl->compositionHost = compositionHost;

        impl->CreateDevices();
        impl->CreateCompositionBridge();
        impl->CreateShaders();
        impl->CreateDisplacementMap();
        impl->RecreateOutputTextures(1, 1);

        // Normal/product mode: exclude the top-level app from WGC/screenshot
        // capture so the live monitor source does not recursively contain us.
        if (!SetWindowDisplayAffinity(
                window,
                kWdaExcludeFromCapture))
        {
            impl->affinityFailures.fetch_add(1);
            // Fail closed: do not start ingesting recursive self-capture when
            // exclusion cannot be established. F1 makes the failure visible.
            impl->captureFrozen.store(true);
        }

        impl->StartThread();

        m_impl = std::move(impl);
    }

    void LiquidGlassRenderer::Detach()
    {
        if (!m_impl)
        {
            return;
        }

        m_impl->StopThread();

        if (m_impl->compositionHost)
        {
            MUXH::ElementCompositionPreview::SetElementChildVisual(
                m_impl->compositionHost,
                nullptr);
        }

        m_impl.reset();
    }

    void LiquidGlassRenderer::SetHostScreenRect(
        RECT const& screenRect,
        float rasterizationScale)
    {
        if (!m_impl)
        {
            return;
        }

        {
            std::scoped_lock boundsLock(m_impl->boundsMutex);