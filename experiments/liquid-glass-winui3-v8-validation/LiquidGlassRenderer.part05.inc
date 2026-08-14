
                    if (latest)
                    {
                        latest.Close();
                    }

                    latest = frame;
                }

                if (!latest)
                {
                    return;
                }

                auto contentSize = latest.ContentSize();

                if (contentSize.Width <= 0 || contentSize.Height <= 0)
                {
                    latest.Close();
                    return;
                }

                if (static_cast<UINT>(contentSize.Width) != captureWidth ||
                    static_cast<UINT>(contentSize.Height) != captureHeight)
                {
                    auto monitor = captureMonitor;
                    latest.Close();
                    StartCapture(monitor);
                    return;
                }

                auto surface = latest.Surface();

                auto access =
                    surface.as<
                        ::Windows::Graphics::DirectX::Direct3D11::
                        IDirect3DDxgiInterfaceAccess>();

                winrt::com_ptr<ID3D11Texture2D> texture;

                winrt::check_hresult(
                    access->GetInterface(
                        __uuidof(ID3D11Texture2D),
                        texture.put_void()));

                // Same GPU device, so this is a GPU-side copy.
                d3dContext->CopyResource(
                    captureCopy.Get(),
                    texture.get());

                latest.Close();

                hasCaptureFrame = true;
                capturedFrames.fetch_add(1);
                if (dequeuedFrames > 1)
                {
                    droppedCaptureFrames.fetch_add(dequeuedFrames - 1);
                }
                ++captureFramesWindow;

                auto now = std::chrono::steady_clock::now();
                lastCaptureFrameTickNs.store(
                    std::chrono::duration_cast<std::chrono::nanoseconds>(
                        now.time_since_epoch()).count());
                double elapsed =
                    std::chrono::duration<double>(
                        now - captureStatsStart).count();

                if (elapsed >= .5)
                {
                    captureFps.store(captureFramesWindow / elapsed);
                    captureFramesWindow = 0;
                    captureStatsStart = now;
                }
            }
            catch (winrt::hresult_error const&)
            {
                auto monitor = captureMonitor;
                StartCapture(monitor);
            }
        }

        LensAnalysis Analyze(float lightAz) const
        {
            LensAnalysis result{};
            std::array<float, kBins> counts{};

            float sumX{};
            float sumY{};
            float sumMag{};

            constexpr int step = 2;

            for (int y = 0; y < kMapHeightCss; y += step)
            {
                for (int x = 0; x < kMapWidthCss; x += step)
                {
                    float nx =
                        (static_cast<float>(x) / kMapWidthCss) * 2.0f - 1.0f;

                    float ny =
                        (static_cast<float>(y) / kMapHeightCss) * 2.0f - 1.0f;

                    float d =
                        std::pow(std::abs(nx), 3.5f) +
                        std::pow(std::abs(ny), 3.5f);

                    if (d > 1.0f)
                    {
                        continue;
                    }

                    float curve =
                        std::sin(std::pow(d, .8f) * kPi);

                    int r = std::clamp(
                        static_cast<int>(std::lround(
                            128.0f + (-nx * curve) * 127.0f)),
                        0,
                        255);

                    int g = std::clamp(
                        static_cast<int>(std::lround(
                            128.0f + (-ny * curve) * 127.0f)),
                        0,
                        255);

                    float bx = (r - 128) / 127.0f;
                    float by = (g - 128) / 127.0f;
                    float mag = std::hypot(bx, by);

                    if (mag < .02f)
                    {
                        continue;
                    }

                    float angle = std::atan2(by, bx);
                    float facing =
                        std::max(0.0f, std::cos(angle - lightAz));

                    float bright =
                        mag * (.35f + .65f * facing);

                    sumX += std::cos(angle) * bright;
                    sumY += std::sin(angle) * bright;
                    sumMag += bright;

                    int bin =
                        static_cast<int>(std::floor(
                            ((angle + kPi) / (2 * kPi)) * kBins)) % kBins;

                    if (bin < 0)
                    {
                        bin += kBins;
                    }

                    result.profile[bin] += bright;
                    counts[bin] += 1.0f;
                }
            }

            float maxProfile{};

            for (int i = 0; i < kBins; ++i)
            {
                if (counts[i] > 0)
                {
                    result.profile[i] /= counts[i];
                }

                maxProfile =
                    std::max(maxProfile, result.profile[i]);
            }

            if (maxProfile > 0)
            {
                for (auto& value : result.profile)
                {
                    value /= maxProfile;
                }
            }

            result.domAngle = std::atan2(sumY, sumX);

            float samples =
                std::max(
                    1.0f,
                    static_cast<float>(
                        kMapWidthCss * kMapHeightCss) /
                    (step * step));

            result.magnitude =
                std::min(1.0f, (sumMag / samples) * 6.0f);

            return result;
        }

        void UpdateLighting()
        {
            // Match the reference: scene light is fixed at monitor top-center.
            float surfaceCenterX =
                (hostScreenRect.left + hostScreenRect.right) * .5f;

            float surfaceCenterY =
                (hostScreenRect.top + hostScreenRect.bottom) * .5f;

            float lightX =
                captureOriginX + captureWidth * .5f;

            float lightY =
                static_cast<float>(captureOriginY);

            float azimuth =
                std::atan2(
                    lightY - surfaceCenterY,
                    lightX - surfaceCenterX);

            int key =
                std::clamp(
                    static_cast<int>(std::lround(azimuth * 100.0f)),
                    -314,
                    314);

            int index = key + 314;

            if (!lightingCacheValid[index])
            {
                lightingCache[index] =
                    Analyze(key / 100.0f);

                lightingCacheValid[index] = true;
            }

            if (key == lastLightKey)
            {
                return;
            }

            lastLightKey = key;

            auto const& analysis = lightingCache[index];

            float intensity =
                .4f + analysis.magnitude * .6f;

            cosVal =
                -std::cos(analysis.domAngle) * intensity;

            sinVal =
                -std::sin(analysis.domAngle) * intensity;

            rimIntensity = analysis.magnitude;
            rimFromRad = analysis.domAngle + kPi * .5f;
            rimProfile = analysis.profile;
        }

        void RenderOptics()
        {
            auto cpuStart = std::chrono::steady_clock::now();

            UpdateLighting();

            D3D11_VIEWPORT viewport{};
            viewport.Width = static_cast<float>(outputWidth);
            viewport.Height = static_cast<float>(outputHeight);
            viewport.MinDepth = 0;
            viewport.MaxDepth = 1;

            d3dContext->RSSetViewports(1, &viewport);
