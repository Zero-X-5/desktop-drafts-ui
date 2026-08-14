            m_impl->desiredHostScreenRect = screenRect;
            m_impl->desiredRasterizationScale =
                std::max(.5f, rasterizationScale);
        }

        m_impl->boundsRevision.fetch_add(1);
        m_impl->SignalState();
    }

    void LiquidGlassRenderer::SetPressed(bool value)
    {
        if (!m_impl)
        {
            return;
        }

        m_impl->pressed.store(value);
        m_impl->SignalState();
    }

    bool LiquidGlassRenderer::SetScreenshotMode(bool enabled)
    {
        if (!m_impl)
        {
            return false;
        }

        std::unique_lock<std::timed_mutex> captureLock(
            m_impl->captureGate,
            std::defer_lock);
        if (!captureLock.try_lock_for(std::chrono::milliseconds(250)))
        {
            m_impl->screenshotBarrierTimeouts.fetch_add(1);
            m_impl->SignalState();
            return false;
        }

        if (enabled)
        {
            // The mutex is the barrier: any in-flight DrainCaptureFrames() has
            // completed before WDA_NONE can be applied, and no new drain can
            // start until captureFrozen is visible.
            m_impl->captureFrozen.store(true);

            if (!SetWindowDisplayAffinity(
                    m_impl->window,
                    WDA_NONE))
            {
                m_impl->affinityFailures.fetch_add(1);
                m_impl->captureFrozen.store(false);
                m_impl->screenshotMode.store(false);
                if (m_impl->captureEvent) SetEvent(m_impl->captureEvent);
                m_impl->SignalState();
                return false;
            }

            m_impl->screenshotMode.store(true);
            m_impl->SignalState();
            return true;
        }

        // Restore exclusion while capture is still frozen. If this fails, stay
        // frozen and in screenshot mode so recursive self-capture cannot start.
        if (!SetWindowDisplayAffinity(
                m_impl->window,
                kWdaExcludeFromCapture))
        {
            m_impl->affinityFailures.fetch_add(1);
            m_impl->captureFrozen.store(true);
            m_impl->screenshotMode.store(true);
            m_impl->SignalState();
            return false;
        }

        m_impl->screenshotMode.store(false);
        m_impl->captureFrozen.store(false);

        if (m_impl->captureEvent)
        {
            SetEvent(m_impl->captureEvent);
        }

        m_impl->SignalState();
        return true;
    }

    RendererStats LiquidGlassRenderer::Stats() const
    {
        RendererStats stats{};

        if (!m_impl)
        {
            return stats;
        }

        stats.renderFps = m_impl->renderFps.load();
        stats.captureFps = m_impl->captureFps.load();
        stats.cpuMs = m_impl->cpuMs.load();
        stats.captureWidth = m_impl->publishedCaptureWidth.load();
        stats.captureHeight = m_impl->publishedCaptureHeight.load();
        stats.capturedFrames = m_impl->capturedFrames.load();
        stats.droppedCaptureFrames = m_impl->droppedCaptureFrames.load();
        stats.monitorRebinds = m_impl->monitorRebinds.load();
        stats.affinityFailures = m_impl->affinityFailures.load();
        stats.screenshotBarrierTimeouts = m_impl->screenshotBarrierTimeouts.load();
        stats.deviceRemovedEvents = m_impl->deviceRemovedEvents.load();
        stats.hostMonitorCount = m_impl->publishedHostMonitorCount.load();
        stats.lastRenderHresult = m_impl->lastRenderHresult.load();
        stats.renderThreadAlive = m_impl->renderThreadAlive.load();
        stats.screenshotMode = m_impl->screenshotMode.load();

        auto lastCaptureTick = m_impl->lastCaptureFrameTickNs.load();
        if (lastCaptureTick > 0)
        {
            auto nowNs = std::chrono::duration_cast<std::chrono::nanoseconds>(
                std::chrono::steady_clock::now().time_since_epoch()).count();
            stats.captureAgeMs =
                std::max<int64_t>(0, nowNs - lastCaptureTick) / 1'000'000.0;
        }

        DWORD affinity{};
        stats.selfExcluded =
            GetWindowDisplayAffinity(
                m_impl->window,
                &affinity) &&
            affinity == kWdaExcludeFromCapture;

        return stats;
    }
}
