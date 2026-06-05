'use client';

import React from 'react';

interface CardMediaProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  onError?: (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement, Event>) => void;
  style?: React.CSSProperties;
}

export function isVideoUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.endsWith('.webm') ||
    url.includes('.webm') ||
    url.includes('pixeldrain.com/api/file/') ||
    url.includes('files.catbox.moe/') ||
    url.includes('ufs.sh') ||
    url.includes('utfs.io')
  );
}

export function CardMedia({ src, alt, className, loading, onError, style }: CardMediaProps) {
  if (isVideoUrl(src)) {
    return (
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className={className}
        style={style}
        onError={onError as any}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={onError as any}
      style={style}
    />
  );
}
