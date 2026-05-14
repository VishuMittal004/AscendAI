import React, { useEffect, useRef } from 'react';

/**
 * Simple background video component.
 * Accepts a `src` prop pointing to an MP4 (or HLS .m3u8) URL.
 * Falls back gracefully if autoplay is blocked.
 */
const BackgroundVideo = ({ src, opacity = 0.65 }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Try HLS if the source looks like an .m3u8 manifest
        if (src && src.endsWith('.m3u8')) {
            import('hls.js').then(({ default: Hls }) => {
                if (Hls.isSupported()) {
                    const hls = new Hls({ startLevel: -1, capLevelToPlayerSize: true });
                    hls.loadSource(src);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        video.play().catch(() => {});
                    });
                    return () => hls.destroy();
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = src;
                    video.addEventListener('loadedmetadata', () => video.play().catch(() => {}));
                }
            }).catch(() => {});
        } else {
            // Plain MP4 — just let the <source> tag handle it
            video.play().catch(() => {});
        }
    }, [src]);

    return (
        <video
            ref={videoRef}
            className="fixed inset-0 w-full h-full object-cover pointer-events-none"
            style={{ zIndex: 0, opacity }}
            autoPlay
            loop
            muted
            playsInline
        >
            <source src={src} type="video/mp4" />
        </video>
    );
};

export default BackgroundVideo;
