#include "pch.h"
#include "LiquidGlassRenderer.h"

#include <windowsx.h>
#include <dxgi1_3.h>
#include <d3dcompiler.h>
#include <d2d1helper.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "d3dcompiler.lib")
#pragma comment(lib, "d2d1.lib")
#pragma comment(lib, "dwrite.lib")
#pragma comment(lib, "windowsapp.lib")
#pragma comment(lib, "runtimeobject.lib")

using Microsoft::WRL::ComPtr;

namespace WGC = winrt::Windows::Graphics::Capture;
namespace WGD = winrt::Windows::Graphics::DirectX;
namespace WGD11 = winrt::Windows::Graphics::DirectX::Direct3D11;
namespace MUC = winrt::Microsoft::UI::Composition;
namespace MUX = winrt::Microsoft::UI::Xaml;
namespace MUXH = winrt::Microsoft::UI::Xaml::Hosting;

namespace abi_comp
{
    using namespace ABI::Microsoft::UI::Composition;
}

namespace Shijian::LiquidGlass
{
    namespace
    {
        constexpr int kBins = 24;
        constexpr int kMapWidthCss = 186;
        constexpr int kMapHeightCss = 60;

        constexpr float kButtonWidthCss = 186.0f;
        constexpr float kButtonHeightCss = 60.0f;
        constexpr float kHostWidthCss = 274.0f;
        constexpr float kHostHeightCss = 148.0f;
        constexpr float kSvgDispScale = 35.0f;
        constexpr float kPi = 3.14159265358979323846f;
        constexpr DWORD kWdaExcludeFromCapture = 0x00000011;

        BOOL CALLBACK CountMonitorProc(
            HMONITOR, HDC, LPRECT, LPARAM userData)
        {
            auto count = reinterpret_cast<UINT*>(userData);
            ++(*count);
            return TRUE;
        }

        UINT CountIntersectingMonitors(RECT const& rect)
        {
            RECT clip = rect;
            UINT count{};
            EnumDisplayMonitors(
                nullptr,
                &clip,
                CountMonitorProc,
                reinterpret_cast<LPARAM>(&count));
            return count;
        }

        struct SceneParams
        {
            float surfaceScreenOrigin[2];
            float captureOrigin[2];

            float captureSize[2];
            float buttonCenter[2];

            float buttonHalfSize[2];
            float cssScale;
            float displacementScale;
        };
        static_assert(sizeof(SceneParams) % 16 == 0);

        struct BlurParams
        {
            float texelSize[2];
            float direction[2];

            float sigma;
            float padding[3];
        };
        static_assert(sizeof(BlurParams) % 16 == 0);

        struct CompositeParams
        {
            float surfaceSize[2];
            float buttonCenter[2];

            float buttonHalfSize[2];
            float cosSin[2];

            float rimIntensity;
            float rimFromRad;
            float cssScale;
            float pressedScale;

            float rimProfile[24];
        };
        static_assert(sizeof(CompositeParams) % 16 == 0);

        struct LensAnalysis
        {
            std::array<float, kBins> profile{};
            float domAngle{};
            float magnitude{};
        };

        constexpr char kVertexShader[] = R"(
struct VSOut { float4 position : SV_Position; };

VSOut main(uint id : SV_VertexID)
{
    float2 p =
        id == 0 ? float2(-1,-1) :
        id == 1 ? float2(-1, 3) :
                  float2( 3,-1);

    VSOut o;
    o.position = float4(p, 0, 1);
    return o;
}
)";

        constexpr char kSceneShader[] = R"(
Texture2D liveDesktopTex : register(t0);
Texture2D dispTex        : register(t1);
SamplerState linearClamp : register(s0);

cbuffer Params : register(b0)
{
    float2 surfaceScreenOrigin;
    float2 captureOrigin;

    float2 captureSize;
    float2 buttonCenter;

    float2 buttonHalfSize;
    float cssScale;
    float displacementScale;
};

float2 CaptureUv(float2 localP)
{
    float2 screenP = surfaceScreenOrigin + localP;
    return (screenP - captureOrigin) / captureSize;
}

float4 main(float4 sv : SV_Position) : SV_Target
{
    float2 localP = sv.xy;
    float2 topLeft = buttonCenter - buttonHalfSize;
    float2 size = buttonHalfSize * 2.0;
    float2 localUv = (localP - topLeft) / max(size, float2(1,1));

    float2 displacement = float2(0,0);

    if (localUv.x >= 0 && localUv.x <= 1 &&
        localUv.y >= 0 && localUv.y <= 1)
    {
        // Exact Windows/SVG reference mapping:
        // displacement = scale * (8-bit channel - 0.5).
        float2 channel = dispTex.Sample(linearClamp, localUv).rg;
        displacement =
            (channel - float2(.5,.5)) *
            displacementScale * cssScale;
    }

    // The sampler itself is CLAMP_TO_EDGE. Explicitly clamp the capture UV so
    // displacement/window movement near a monitor edge reuses the nearest real
    // desktop pixel instead of injecting a dark sentinel frame into the lens.
    float2 uv = saturate(CaptureUv(localP + displacement));
    return float4(liveDesktopTex.Sample(linearClamp, uv).rgb, 1);
}
)";

        constexpr char kBlurShader[] = R"(
Texture2D inputTex       : register(t0);
SamplerState linearClamp : register(s0);

cbuffer Params : register(b0)
{
    float2 texelSize;
    float2 direction;

    float sigma;
    float3 padding;
};

float4 main(float4 sv : SV_Position) : SV_Target
{
    float2 uv = sv.xy * texelSize;
    float s = max(.25, sigma);

    float3 sum = float3(0,0,0);
    float weightSum = 0;

    [unroll]
    for (int i = -12; i <= 12; ++i)
    {
        float fi = (float)i;
        float w = exp(-0.5 * (fi * fi) / (s * s));
        sum += inputTex.Sample(
            linearClamp,
            uv + direction * texelSize * fi).rgb * w;
        weightSum += w;
    }

    return float4(sum / max(weightSum, .0001), 1);
}
)";

        constexpr char kCompositeShader[] = R"(
Texture2D sceneTex       : register(t0);
Texture2D frostedTex     : register(t1);
SamplerState linearClamp : register(s0);

cbuffer Params : register(b0)
{
    float2 surfaceSize;
    float2 buttonCenter;

    float2 buttonHalfSize;
    float2 cosSin;

    float rimIntensity;
    float rimFromRad;
    float cssScale;
    float pressedScale;

    float4 rimProfile4[6];
};

static const float PI = 3.14159265359;

float RimProfile(int i)
{
    int group = i / 4;
    int lane = i - group * 4;
    float4 v = rimProfile4[group];

    return lane == 0 ? v.x :
           lane == 1 ? v.y :
           lane == 2 ? v.z : v.w;
}

float RoundedRectSdf(float2 p, float2 halfSize)
{
    float r = halfSize.y;
    float2 q = abs(p) - halfSize + r;
    return length(max(q, float2(0,0))) +
        min(max(q.x, q.y), 0.0) - r;
}

float ErfApprox(float x)
{
    float signX = x < 0 ? -1.0 : 1.0;
    float a = abs(x);
    float t = 1.0 / (1.0 + 0.3275911 * a);

    float y = 1.0 -
        (((((1.061405429*t - 1.453152027)*t + 1.421413741)*t
        - 0.284496736)*t + 0.254829592)*t) * exp(-a*a);

    return signX * y;
}

float CoverageFromSdf(float sdf, float blurPx)
{
    if (blurPx <= .001)
    {
        return 1.0 - smoothstep(-.75, .75, sdf);
    }

    float sigma = max(.35, blurPx * .50);
    return .5 * (1.0 - ErfApprox(sdf / (1.41421356 * sigma)));
}

float Shape(float2 p, float2 halfSize, float blurPx)
{
    return CoverageFromSdf(RoundedRectSdf(p, halfSize), blurPx);
}

float OuterShadow(
    float2 local,
    float2 halfSize,
    float2 offsetCss,
    float blurCss,
    float spreadCss,
    float baseMask)
{
    float2 offset = offsetCss * cssScale;
    float spread = spreadCss * cssScale;
    float2 hs = max(float2(2,2), halfSize + float2(spread, spread));
    float m = Shape(local - offset, hs, blurCss * cssScale);
    return m * (1.0 - baseMask);
}

float InsetShadow(
    float2 local,
    float2 halfSize,
    float2 offsetCss,
    float blurCss,
    float spreadCss,
    float baseMask)
{
    float2 offset = offsetCss * cssScale;
    float spread = spreadCss * cssScale;

    // Correct CSS inset spread semantics from V4/V5.
    float2 clearHalf =
        max(float2(2,2), halfSize - float2(spread, spread));

    float clearCoverage =
        Shape(local - offset, clearHalf, blurCss * cssScale);

    return baseMask * (1.0 - clearCoverage);
}

float3 Over(float3 base, float3 layer, float alpha)
{
    return lerp(base, layer, saturate(alpha));
}

float3 Saturate180(float3 c)
{
    float l = dot(c, float3(.2126, .7152, .0722));
    return lerp(l.xxx, c, 1.8);
}

float SampleConic(float2 p)
{
    float angle = atan2(p.x, -p.y);
    float u = frac((angle - rimFromRad) / (2.0 * PI));
    float f = u * 24.0;

    int i0 = (int)floor(f) % 24;
    int i1 = (i0 + 1) % 24;

    return lerp(RimProfile(i0), RimProfile(i1), frac(f));
}

float4 main(float4 sv : SV_Position) : SV_Target
{
    float2 p = sv.xy;
    float2 uv = p / surfaceSize;

    float3 scene = sceneTex.Sample(linearClamp, uv).rgb;
    float3 frost = frostedTex.Sample(linearClamp, uv).rgb;

    float2 local = p - buttonCenter;
    float sdf = RoundedRectSdf(local, buttonHalfSize);
    float mask = CoverageFromSdf(sdf, 0);

    float shadow1 = OuterShadow(
        local, buttonHalfSize,
        float2(cosSin.x*4.0, cosSin.y*4.0),
        10.0, 0.0, mask) * .15;

    float shadow2 = OuterShadow(
        local, buttonHalfSize,
        float2(cosSin.x*9.0, cosSin.y*9.0),
        18.0, 0.0, mask) * .10;

    float outerShadow = saturate(
        shadow1 + shadow2 * (1.0 - shadow1));

    float3 glass = Saturate180(frost) * 1.05;

    // Original white 25% surface.
    glass = Over(glass, float3(1,1,1), .25);

    float2 radialCenter =
        -float2(cosSin.x, cosSin.y) * buttonHalfSize;

    float radialRadius =
        max(buttonHalfSize.x, buttonHalfSize.y) * 1.20;

    float radialD =
        length(local - radialCenter) / max(1.0, radialRadius);

    float radialAlpha =
        .20 * (1.0 - smoothstep(0.0, .60, radialD));

    glass = Over(glass, float3(1,1,1), radialAlpha);

    // Original directional inset stack.
    float a0 = InsetShadow(
        local, buttonHalfSize, float2(0,0),
        0.0, 1.0, mask) * (rimIntensity * .20);

    float a1 = InsetShadow(
        local, buttonHalfSize,
        float2(cosSin.x*1.8, cosSin.y*3.0),
        0.0, -2.0, mask) * (rimIntensity * .90);

    float a2 = InsetShadow(
        local, buttonHalfSize,
        float2(cosSin.x*-2.0, cosSin.y*-2.0),
        0.0, -2.0, mask) * (rimIntensity * .80);

    float a3 = InsetShadow(
        local, buttonHalfSize,
        float2(cosSin.x*-3.0, cosSin.y*-8.0),
        1.0, -6.0, mask) * (rimIntensity * .60);

    float b0 = InsetShadow(
        local, buttonHalfSize,
        float2(cosSin.x*-.3, cosSin.y*-1.0),
        4.0, 0.0, mask) * .12;

    float b1 = InsetShadow(
        local, buttonHalfSize,
        float2(cosSin.x*-1.5, cosSin.y*2.5),
        0.0, -2.0, mask) * .20;

    float b2 = InsetShadow(
        local, buttonHalfSize,
        float2(0, cosSin.y*3.0),
        4.0, -2.0, mask) * .20;

    float b3 = InsetShadow(
        local, buttonHalfSize,
        float2(cosSin.x*2.0, cosSin.y*-6.5),
        1.0, -4.0, mask) * .10;

    glass = Over(glass, float3(1,1,1), a0);
    glass = Over(glass, float3(1,1,1), a1);
    glass = Over(glass, float3(1,1,1), a2);
    glass = Over(glass, float3(1,1,1), a3);

    glass = Over(glass, float3(0,0,0), b0);
    glass = Over(glass, float3(0,0,0), b1);
    glass = Over(glass, float3(0,0,0), b2);
    glass = Over(glass, float3(0,0,0), b3);

    float innerDepth = max(0.0, -sdf);
    float onePx = cssScale;

    float ring =
        mask *
        (1.0 - smoothstep(onePx*.15, onePx*1.15, innerDepth));

    float profile = SampleConic(local);
    float stopAlpha = .07 + profile * .63;
    float rimOpacity = .62 + rimIntensity * .24;

    glass = Over(
        glass,
        float3(1,1,1),
        ring * stopAlpha * rimOpacity);

    // Product surface is transparent outside the optical glass.
    // Inside the glass we intentionally output an opaque reconstruction
    // of the captured pixels (the "desktop portal"). Outer shadow is black.
    float alpha = saturate(mask + outerShadow * (1.0 - mask));
    float3 premultipliedRgb = glass * mask;

    return float4(premultipliedRgb, alpha);
}
)";