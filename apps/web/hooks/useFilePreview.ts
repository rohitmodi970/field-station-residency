// ===========================================
// hooks/useFilePreview.ts
// ===========================================

import { useState, useEffect } from 'react';

export function useFilePreview(file: File | null) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      setDimensions(null);
      return;
    }

    // Only create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();

      reader.onloadend = () => {
        const result = reader.result as string;
        setPreview(result);

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          setDimensions({
            width: img.width,
            height: img.height,
          });
        };
        img.src = result;
      };

      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);

      // Clean up
      return () => URL.revokeObjectURL(url);
    }

    return () => {
      setPreview(null);
      setDimensions(null);
    };
  }, [file]);

  return { preview, dimensions };
}
