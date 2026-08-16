                MUXH::ElementCompositionPreview::GetElementVisual(
                    compositionHost).Compositor();

            auto compositorInterop =
                compositor.as<abi_comp::ICompositorInterop>();

            // Back the CompositionGraphicsDevice with the same D2D device.
            // This lets BeginDraw return ID2D1DeviceContext directly.
            winrt::com_ptr<abi_comp::ICompositionGraphicsDevice>
                graphicsDeviceAbi;

            winrt::check_hresult(
                compositorInterop->CreateGraphicsDevice(
                    d2dDevice.Get(),
                    graphicsDeviceAbi.put()));

            compositionGraphicsDevice =
                graphicsDeviceAbi.as<MUC::CompositionGraphicsDevice>();

            drawingSurface =
                compositionGraphicsDevice.CreateDrawingSurface(
                    { 1.0f, 1.0f },
                    WGD::DirectXPixelFormat::B8G8R8A8UIntNormalized,
                    WGD::DirectXAlphaMode::Premultiplied);

            drawingSurfaceInterop =
                drawingSurface.as<
                    abi_comp::ICompositionDrawingSurfaceInterop>();

            surfaceBrush = compositor.CreateSurfaceBrush(drawingSurface);
            surfaceBrush.Stretch(MUC::CompositionStretch::Fill);

            spriteVisual = compositor.CreateSpriteVisual();
            spriteVisual.Brush(surfaceBrush);
            spriteVisual.RelativeSizeAdjustment({ 1.0f, 1.0f });

            // The visual itself stays XAML-sized; the backing surface is resized
            // in physical pixels by the render thread.
            MUXH::ElementCompositionPreview::SetElementChildVisual(
                compositionHost,
                spriteVisual);
        }

        template <typename T>
        void CreateConstantBuffer(ComPtr<ID3D11Buffer>& buffer)
        {
            D3D11_BUFFER_DESC desc{};
            desc.ByteWidth = sizeof(T);
            desc.Usage = D3D11_USAGE_DEFAULT;
            desc.BindFlags = D3D11_BIND_CONSTANT_BUFFER;

            winrt::check_hresult(
                d3dDevice->CreateBuffer(
                    &desc,
                    nullptr,
                    &buffer));
        }

        void CreateShaders()
        {
            auto vs = CompileShader(kVertexShader, "vs_5_0");
            auto scene = CompileShader(kSceneShader, "ps_5_0");
            auto blur = CompileShader(kBlurShader, "ps_5_0");
            auto composite = CompileShader(kCompositeShader, "ps_5_0");

            winrt::check_hresult(
                d3dDevice->CreateVertexShader(
                    vs->GetBufferPointer(),
                    vs->GetBufferSize(),
                    nullptr,
                    &vertexShader));

            winrt::check_hresult(
                d3dDevice->CreatePixelShader(
                    scene->GetBufferPointer(),
                    scene->GetBufferSize(),
                    nullptr,
                    &sceneShader));

            winrt::check_hresult(
                d3dDevice->CreatePixelShader(
                    blur->GetBufferPointer(),
                    blur->GetBufferSize(),
                    nullptr,
                    &blurShader));

            winrt::check_hresult(
                d3dDevice->CreatePixelShader(
                    composite->GetBufferPointer(),
                    composite->GetBufferSize(),
                    nullptr,
                    &compositeShader));

            CreateConstantBuffer<SceneParams>(sceneParamsBuffer);
            CreateConstantBuffer<BlurParams>(blurParamsBuffer);
            CreateConstantBuffer<CompositeParams>(compositeParamsBuffer);

            D3D11_SAMPLER_DESC desc{};
            desc.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
            desc.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;
            desc.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
            desc.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
            desc.MaxLOD = D3D11_FLOAT32_MAX;

            winrt::check_hresult(
                d3dDevice->CreateSamplerState(
                    &desc,
                    &sampler));
        }

        void CreateDisplacementMap()
        {
            int mapWidthCss = std::max(1, profile.mapWidthCss);
            int mapHeightCss = std::max(1, profile.mapHeightCss);

            std::vector<uint8_t> rgba(
                static_cast<size_t>(
                    mapWidthCss * mapHeightCss * 4));

            for (int y = 0; y < mapHeightCss; ++y)
            {
                for (int x = 0; x < mapWidthCss; ++x)
                {
                    float nx =
                        (static_cast<float>(x) / mapWidthCss) * 2.0f - 1.0f;

                    float ny =
                        (static_cast<float>(y) / mapHeightCss) * 2.0f - 1.0f;

                    float d =
                        std::pow(std::abs(nx), 3.5f) +
                        std::pow(std::abs(ny), 3.5f);

                    int r = 128;
                    int g = 128;

                    if (d <= 1.0f)
                    {
                        float curve =
                            std::sin(std::pow(d, .8f) * kPi);

                        r = std::clamp(
                            static_cast<int>(std::lround(
                                128.0f + (-nx * curve) * 127.0f)),
                            0,
                            255);

                        g = std::clamp(
                            static_cast<int>(std::lround(
                                128.0f + (-ny * curve) * 127.0f)),
                            0,
                            255);
                    }

                    size_t i =
                        static_cast<size_t>(
                            (y * mapWidthCss + x) * 4);

                    rgba[i + 0] = static_cast<uint8_t>(r);
                    rgba[i + 1] = static_cast<uint8_t>(g);
                    rgba[i + 2] = 128;
                    rgba[i + 3] = 255;
                }
            }

            D3D11_TEXTURE2D_DESC desc{};
            desc.Width = static_cast<UINT>(mapWidthCss);
            desc.Height = static_cast<UINT>(mapHeightCss);
            desc.MipLevels = 1;
            desc.ArraySize = 1;
            desc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
            desc.SampleDesc.Count = 1;
            desc.Usage = D3D11_USAGE_IMMUTABLE;
            desc.BindFlags = D3D11_BIND_SHADER_RESOURCE;

            D3D11_SUBRESOURCE_DATA init{};
            init.pSysMem = rgba.data();
            init.SysMemPitch = mapWidthCss * 4;

            ComPtr<ID3D11Texture2D> texture;

            winrt::check_hresult(
                d3dDevice->CreateTexture2D(
                    &desc,
                    &init,
                    &texture));

            winrt::check_hresult(
                d3dDevice->CreateShaderResourceView(
                    texture.Get(),
                    nullptr,
                    &displacementSrv));
        }

        void CreateTargetTexture(
            UINT width,
            UINT height,
            ComPtr<ID3D11Texture2D>& texture,
            ComPtr<ID3D11RenderTargetView>& rtv,
            ComPtr<ID3D11ShaderResourceView>& srv)
        {
            D3D11_TEXTURE2D_DESC desc{};
            desc.Width = width;
            desc.Height = height;
            desc.MipLevels = 1;
            desc.ArraySize = 1;
            desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
            desc.SampleDesc.Count = 1;
            desc.Usage = D3D11_USAGE_DEFAULT;
            desc.BindFlags =
                D3D11_BIND_RENDER_TARGET |
                D3D11_BIND_SHADER_RESOURCE;

            winrt::check_hresult(
                d3dDevice->CreateTexture2D(
                    &desc,
                    nullptr,
                    &texture));

            winrt::check_hresult(
                d3dDevice->CreateRenderTargetView(
                    texture.Get(),
                    nullptr,
                    &rtv));

            winrt::check_hresult(
                d3dDevice->CreateShaderResourceView(
                    texture.Get(),
                    nullptr,
                    &srv));