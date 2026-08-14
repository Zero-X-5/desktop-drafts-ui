            d3dContext->IASetPrimitiveTopology(
                D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
            d3dContext->VSSetShader(vertexShader.Get(), nullptr, 0);
            d3dContext->PSSetSamplers(0, 1, sampler.GetAddressOf());

            float cssScale = rasterizationScale;

            float buttonWidth =
                kButtonWidthCss * cssScale;

            float buttonHeight =
                kButtonHeightCss * cssScale;

            float pressedScale =
                pressed.load() ? .96f : 1.0f;

            float buttonCenterX =
                outputWidth * .5f;

            float buttonCenterY =
                outputHeight * .5f;

            float buttonHalfW =
                buttonWidth * pressedScale * .5f;

            float buttonHalfH =
                buttonHeight * pressedScale * .5f;

            // Pass 1: live desktop + exact reference displacement.
            SceneParams sceneParams{};

            sceneParams.surfaceScreenOrigin[0] =
                static_cast<float>(hostScreenRect.left);

            sceneParams.surfaceScreenOrigin[1] =
                static_cast<float>(hostScreenRect.top);

            sceneParams.captureOrigin[0] =
                static_cast<float>(captureOriginX);

            sceneParams.captureOrigin[1] =
                static_cast<float>(captureOriginY);

            sceneParams.captureSize[0] =
                static_cast<float>(captureWidth);

            sceneParams.captureSize[1] =
                static_cast<float>(captureHeight);

            sceneParams.buttonCenter[0] = buttonCenterX;
            sceneParams.buttonCenter[1] = buttonCenterY;
            sceneParams.buttonHalfSize[0] = buttonHalfW;
            sceneParams.buttonHalfSize[1] = buttonHalfH;
            sceneParams.cssScale = cssScale;
            sceneParams.displacementScale = kSvgDispScale;

            d3dContext->UpdateSubresource(
                sceneParamsBuffer.Get(),
                0,
                nullptr,
                &sceneParams,
                0,
                0);

            d3dContext->OMSetRenderTargets(
                1,
                sceneRtv.GetAddressOf(),
                nullptr);

            d3dContext->PSSetShader(
                sceneShader.Get(),
                nullptr,
                0);

            d3dContext->PSSetConstantBuffers(
                0,
                1,
                sceneParamsBuffer.GetAddressOf());

            ID3D11ShaderResourceView* sceneInputs[]
            {
                captureSrv.Get(),
                displacementSrv.Get(),
            };

            d3dContext->PSSetShaderResources(
                0,
                ARRAYSIZE(sceneInputs),
                sceneInputs);

            d3dContext->Draw(3, 0);

            ID3D11ShaderResourceView* null2[]{ nullptr, nullptr };
            d3dContext->PSSetShaderResources(0, 2, null2);

            // Pass 2/3: validated two-pass 25-tap Gaussian.
            BlurParams blur{};

            blur.texelSize[0] =
                1.0f / outputWidth;

            blur.texelSize[1] =
                1.0f / outputHeight;

            blur.direction[0] = 1;
            blur.direction[1] = 0;
            blur.sigma = 2.0f * cssScale;

            d3dContext->UpdateSubresource(
                blurParamsBuffer.Get(),
                0,
                nullptr,
                &blur,
                0,
                0);

            d3dContext->OMSetRenderTargets(
                1,
                blurARtv.GetAddressOf(),
                nullptr);

            d3dContext->PSSetShader(
                blurShader.Get(),
                nullptr,
                0);

            d3dContext->PSSetConstantBuffers(
                0,
                1,
                blurParamsBuffer.GetAddressOf());

            ID3D11ShaderResourceView* sceneView =
                sceneSrv.Get();

            d3dContext->PSSetShaderResources(
                0,
                1,
                &sceneView);

            d3dContext->Draw(3, 0);

            ID3D11ShaderResourceView* null1 = nullptr;
            d3dContext->PSSetShaderResources(0, 1, &null1);

            blur.direction[0] = 0;
            blur.direction[1] = 1;

            d3dContext->UpdateSubresource(
                blurParamsBuffer.Get(),
                0,
                nullptr,
                &blur,
                0,
                0);

            d3dContext->OMSetRenderTargets(
                1,
                blurBRtv.GetAddressOf(),
                nullptr);

            ID3D11ShaderResourceView* blurAView =
                blurASrv.Get();

            d3dContext->PSSetShaderResources(
                0,
                1,
                &blurAView);

            d3dContext->Draw(3, 0);
            d3dContext->PSSetShaderResources(0, 1, &null1);

            // Pass 4: transparent product surface + reference bevel/rim.
            CompositeParams composite{};

            composite.surfaceSize[0] =
                static_cast<float>(outputWidth);

            composite.surfaceSize[1] =
                static_cast<float>(outputHeight);

            composite.buttonCenter[0] = buttonCenterX;
            composite.buttonCenter[1] = buttonCenterY;
            composite.buttonHalfSize[0] = buttonHalfW;
            composite.buttonHalfSize[1] = buttonHalfH;
            composite.cosSin[0] = cosVal;
            composite.cosSin[1] = sinVal;
            composite.rimIntensity = rimIntensity;
            composite.rimFromRad = rimFromRad;
            composite.cssScale = cssScale;
            composite.pressedScale = pressedScale;

            for (int i = 0; i < kBins; ++i)
            {
                composite.rimProfile[i] = rimProfile[i];
            }

            d3dContext->UpdateSubresource(
                compositeParamsBuffer.Get(),
                0,
                nullptr,
                &composite,
                0,
                0);

            float transparent[4]{ 0,0,0,0 };
            d3dContext->ClearRenderTargetView(
                finalRtv.Get(),
                transparent);

            d3dContext->OMSetRenderTargets(
                1,
                finalRtv.GetAddressOf(),
                nullptr);

            d3dContext->PSSetShader(
                compositeShader.Get(),
                nullptr,
                0);

            d3dContext->PSSetConstantBuffers(
                0,
                1,
                compositeParamsBuffer.GetAddressOf());

            ID3D11ShaderResourceView* compositeInputs[]
            {
                sceneSrv.Get(),
                blurBSrv.Get(),
            };

            d3dContext->PSSetShaderResources(
                0,
                2,
                compositeInputs);

            d3dContext->Draw(3, 0);
            d3dContext->PSSetShaderResources(0, 2, null2);

            // Move the small D3D result into the CompositionDrawingSurface.
            PresentToCompositionSurface();

            ++renderFramesWindow;

            auto now = std::chrono::steady_clock::now();

            double frameCpuMs =
                std::chrono::duration<double, std::milli>(
                    now - cpuStart).count();

            double old = cpuMs.load();

            cpuMs.store(
                old <= 0
                ? frameCpuMs
                : old * .88 + frameCpuMs * .12);

            double elapsed =
                std::chrono::duration<double>(
                    now - renderStatsStart).count();

            if (elapsed >= .5)
            {
                renderFps.store(
                    renderFramesWindow / elapsed);

                renderFramesWindow = 0;
                renderStatsStart = now;
            }
        }

        void PresentToCompositionSurface()
        {
            winrt::com_ptr<ID2D1DeviceContext> drawContext;
            POINT updateOffset{};

            auto hr =
                drawingSurfaceInterop->BeginDraw(
