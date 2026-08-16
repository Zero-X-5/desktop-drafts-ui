
        struct GlassProfile
        {
            int mapWidthCss{ kMapWidthCss };
            int mapHeightCss{ kMapHeightCss };
            float lensWidthCss{ kButtonWidthCss };
            float lensHeightCss{ kButtonHeightCss };
            float opticalScale{ 1.0f };
        };

        bool ProfileFileExists(std::wstring const& path)
        {
            DWORD attributes = GetFileAttributesW(path.c_str());
            return attributes != INVALID_FILE_ATTRIBUTES &&
                (attributes & FILE_ATTRIBUTE_DIRECTORY) == 0;
        }

        std::wstring ProfileDirectoryOf(std::wstring const& path)
        {
            auto pos = path.find_last_of(L"\\/");
            return pos == std::wstring::npos
                ? std::wstring{}
                : path.substr(0, pos);
        }

        std::wstring ResolveGlassProfileConfigPath()
        {
            std::vector<std::wstring> candidates;

            wchar_t modulePath[MAX_PATH]{};
            DWORD moduleLength = GetModuleFileNameW(
                nullptr,
                modulePath,
                ARRAYSIZE(modulePath));

            if (moduleLength > 0 && moduleLength < ARRAYSIZE(modulePath))
            {
                auto moduleDir = ProfileDirectoryOf(modulePath);
                if (!moduleDir.empty())
                {
                    candidates.push_back(
                        moduleDir + L"\\glass-test-window.ini");
                    candidates.push_back(
                        moduleDir + L"\\..\\glass-test-window.ini");
                }
            }

            wchar_t currentDirectory[MAX_PATH]{};
            DWORD cwdLength = GetCurrentDirectoryW(
                ARRAYSIZE(currentDirectory),
                currentDirectory);

            if (cwdLength > 0 && cwdLength < ARRAYSIZE(currentDirectory))
            {
                std::wstring cwd{ currentDirectory };
                candidates.push_back(cwd + L"\\glass-test-window.ini");
                candidates.push_back(
                    cwd +
                    L"\\experiments\\liquid-glass-winui3-v8-validation\\glass-test-window.ini");
            }

            for (auto const& candidate : candidates)
            {
                if (ProfileFileExists(candidate))
                {
                    return candidate;
                }
            }

            return candidates.empty()
                ? std::wstring{ L"glass-test-window.ini" }
                : candidates.front();
        }

        GlassProfile LoadGlassProfile(GlassProfileId profileId)
        {
            GlassProfile profile{};
            wchar_t const* section = L"reference";

            if (profileId == GlassProfileId::LongBar)
            {
                section = L"long_bar";
                profile.mapWidthCss = 248;
                profile.mapHeightCss = 36;
                profile.lensWidthCss = 248.0f;
                profile.lensHeightCss = 36.0f;
                profile.opticalScale = .60f;
            }

            auto path = ResolveGlassProfileConfigPath();

            profile.mapWidthCss = std::clamp(
                GetPrivateProfileIntW(
                    section,
                    L"map_width",
                    profile.mapWidthCss,
                    path.c_str()),
                1,
                2048);

            profile.mapHeightCss = std::clamp(
                GetPrivateProfileIntW(
                    section,
                    L"map_height",
                    profile.mapHeightCss,
                    path.c_str()),
                1,
                2048);

            profile.lensWidthCss = static_cast<float>(std::clamp(
                GetPrivateProfileIntW(
                    section,
                    L"lens_width",
                    static_cast<int>(std::lround(profile.lensWidthCss)),
                    path.c_str()),
                1,
                2048));

            profile.lensHeightCss = static_cast<float>(std::clamp(
                GetPrivateProfileIntW(
                    section,
                    L"lens_height",
                    static_cast<int>(std::lround(profile.lensHeightCss)),
                    path.c_str()),
                1,
                2048));

            int opticalScalePercent = std::clamp(
                GetPrivateProfileIntW(
                    section,
                    L"optical_scale_percent",
                    static_cast<int>(std::lround(profile.opticalScale * 100.0f)),
                    path.c_str()),
                10,
                400);

            profile.opticalScale = opticalScalePercent / 100.0f;
            return profile;
        }
