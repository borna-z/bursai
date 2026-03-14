import * as React from 'react';
import { cn } from '@/lib/utils';
import { useCachedSignedUrl } from '@/hooks/useSignedUrlCache';
import { Shirt, ImageOff } from 'lucide-react';

interface LazyImageProps {
  imagePath?: string;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
  aspectRatio?: 'square' | '4/5' | '3/4' | '16/9';
}

export function LazyImage({ 
  imagePath, 
  alt, 
  className,
  fallbackIcon,
  aspectRatio = 'square'
}: LazyImageProps) {
  const { signedUrl, placeholderUrl, isLoading, hasError, setRef } = useCachedSignedUrl(imagePath);
  const [imageLoaded, setImageLoaded] = React.useState(false);

  const aspectClasses = {
    'square': 'aspect-square',
    '4/5': 'aspect-[4/5]',
    '3/4': 'aspect-[3/4]',
    '16/9': 'aspect-video',
  };

  return (
    <div 
      ref={setRef}
      className={cn(
        "relative overflow-hidden bg-muted rounded-lg",
        aspectClasses[aspectRatio],
        className
      )}
    >
      {/* Shimmer skeleton while loading */}
      {!imageLoaded && !hasError && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/80 to-muted" />
      )}
      
      {/* Actual image */}
      {signedUrl && !hasError && (
        <img
          src={signedUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(false)}
        />
      )}
      
      {/* Error fallback */}
      {(hasError || (!imagePath && !isLoading)) && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          {fallbackIcon || <Shirt className="w-1/4 h-1/4 text-muted-foreground/30" />}
        </div>
      )}
    </div>
  );
}

interface LazyImageSimpleProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  imagePath?: string;
  fallbackIcon?: React.ReactNode;
}

export function LazyImageSimple({ 
  imagePath, 
  alt = '', 
  className,
  fallbackIcon,
  ...props
}: LazyImageSimpleProps) {
  const { signedUrl, placeholderUrl, isLoading, hasError, setRef } = useCachedSignedUrl(imagePath);
  const [imageLoaded, setImageLoaded] = React.useState(false);

  return (
    <div ref={setRef} className={cn("relative overflow-hidden bg-muted", className)}>
      {/* Shimmer skeleton while loading */}
      {!imageLoaded && !hasError && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/80 to-muted" />
      )}
      
      {signedUrl && !hasError ? (
        <img
          src={signedUrl}
          alt={alt}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(false)}
          {...props}
        />
      ) : hasError || !imagePath ? (
        <div className="absolute inset-0 flex items-center justify-center">
          {fallbackIcon || <ImageOff className="w-1/4 h-1/4 text-muted-foreground/30" />}
        </div>
      ) : null}
    </div>
  );
}
