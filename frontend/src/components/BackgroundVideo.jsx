import React from 'react';

/**
 * Full-screen background video — plain MP4, no external dependencies.
 * Renders fixed behind all content at z-0.
 */
const BackgroundVideo = ({ src, opacity = 0.65 }) => (
    <video
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

export default BackgroundVideo;
