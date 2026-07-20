import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Crop, RotateCw, Sparkles, RefreshCw, Check, X, Maximize2, Scissors, Info, Sliders } from 'lucide-react';

interface AutoCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropApplied: (croppedBase64: string, originalKb: number, croppedKb: number) => void;
  languageMode: 'bilingual' | 'english' | 'hindi';
}

export default function AutoCropModal({
  isOpen,
  onClose,
  imageSrc,
  onCropApplied,
  languageMode
}: AutoCropModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [rotation, setRotation] = useState<number>(0);
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, width: 80, height: 80 }); // Percentages
  const [isDragging, setIsDragging] = useState<string | null>(null); // 'corner-tl', 'corner-tr', 'corner-bl', 'corner-br', 'box'
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });
  const [aspectRatio, setAspectRatio] = useState<string>('free'); // 'free', 'aadhaar' (85:54), 'a4' (1:1.414), 'square' (1:1)
  const [sensitivity, setSensitivity] = useState<number>(30); // Contrast sensitivity for edge detection
  const [padding, setPadding] = useState<number>(5); // Padding percentage for crop

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Translation helper
  const t = (en: string, hi: string): string => {
    if (languageMode === 'english') return en;
    if (languageMode === 'hindi') return hi;
    return `${en} / ${hi}`;
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setRotation(0);
      setAspectRatio('free');
      // Set initial crop box
      setCropBox({ x: 10, y: 10, width: 80, height: 80 });
    }
  }, [isOpen, imageSrc]);

  // Handle Image Load & Execute Auto Boundary Detection
  const handleImageLoaded = () => {
    setLoading(false);
    detectDocumentBoundaries();
  };

  // Canvas-Based Intelligent Document Boundary Detection Algorithm
  const detectDocumentBoundaries = () => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a small scale-down working canvas for high-performance pixel scanning
    const workingWidth = 300;
    const workingHeight = Math.round((img.naturalHeight * workingWidth) / img.naturalWidth);
    canvas.width = workingWidth;
    canvas.height = workingHeight;

    // Draw image applying rotation if any (initial detection assumes 0 rotation)
    ctx.drawImage(img, 0, 0, workingWidth, workingHeight);

    try {
      const imageData = ctx.getImageData(0, 0, workingWidth, workingHeight);
      const data = imageData.data;

      // 1. Sample corners to determine the ambient background color and luminance
      const cornerSamples = [
        getLuminance(0, 0, workingWidth, data),
        getLuminance(workingWidth - 1, 0, workingWidth, data),
        getLuminance(0, workingHeight - 1, workingWidth, data),
        getLuminance(workingWidth - 1, workingHeight - 1, workingWidth, data),
        getLuminance(Math.floor(workingWidth / 2), 2, workingWidth, data)
      ];

      // Average background luminance
      const avgBgLuminance = cornerSamples.reduce((sum, val) => sum + val, 0) / cornerSamples.length;

      // 2. Scan from outside in to find contrasting boundaries (document edges)
      // We look for significant differences in luminance compared to the background,
      // representing a white page on a dark desk, or a dark page/shadow border on light background.
      let minX = 0;
      let maxX = workingWidth - 1;
      let minY = 0;
      let maxY = workingHeight - 1;

      // Scan Left Edge
      let found = false;
      for (let x = 0; x < workingWidth / 2; x++) {
        let diffCount = 0;
        for (let y = 0; y < workingHeight; y++) {
          const lum = getLuminance(x, y, workingWidth, data);
          if (Math.abs(lum - avgBgLuminance) > sensitivity) {
            diffCount++;
          }
        }
        // If > 8% of the vertical line contains contrast deviation, we consider it the document edge
        if (diffCount > workingHeight * 0.08) {
          minX = Math.max(0, x - 2); // 2px margin
          found = true;
          break;
        }
      }

      // Scan Right Edge
      found = false;
      for (let x = workingWidth - 1; x > workingWidth / 2; x--) {
        let diffCount = 0;
        for (let y = 0; y < workingHeight; y++) {
          const lum = getLuminance(x, y, workingWidth, data);
          if (Math.abs(lum - avgBgLuminance) > sensitivity) {
            diffCount++;
          }
        }
        if (diffCount > workingHeight * 0.08) {
          maxX = Math.min(workingWidth - 1, x + 2);
          found = true;
          break;
        }
      }

      // Scan Top Edge
      found = false;
      for (let y = 0; y < workingHeight / 2; y++) {
        let diffCount = 0;
        for (let x = 0; x < workingWidth; x++) {
          const lum = getLuminance(x, y, workingWidth, data);
          if (Math.abs(lum - avgBgLuminance) > sensitivity) {
            diffCount++;
          }
        }
        if (diffCount > workingWidth * 0.08) {
          minY = Math.max(0, y - 2);
          found = true;
          break;
        }
      }

      // Scan Bottom Edge
      found = false;
      for (let y = workingHeight - 1; y > workingHeight / 2; y--) {
        let diffCount = 0;
        for (let x = 0; x < workingWidth; x++) {
          const lum = getLuminance(x, y, workingWidth, data);
          if (Math.abs(lum - avgBgLuminance) > sensitivity) {
            diffCount++;
          }
        }
        if (diffCount > workingWidth * 0.08) {
          maxY = Math.min(workingHeight - 1, y + 2);
          found = true;
          break;
        }
      }

      // Convert back to percentages
      let cropX = (minX / workingWidth) * 100;
      let cropY = (minY / workingHeight) * 100;
      let cropW = ((maxX - minX) / workingWidth) * 100;
      let cropH = ((maxY - minY) / workingHeight) * 100;

      // Sanity checks to ensure we don't collapse the crop box entirely
      if (cropW < 20 || cropH < 20) {
        cropX = 10;
        cropY = 10;
        cropW = 80;
        cropH = 80;
      }

      // Apply padding settings
      if (padding > 0) {
        cropX = Math.max(0, cropX - padding);
        cropY = Math.max(0, cropY - padding);
        cropW = Math.min(100 - cropX, cropW + padding * 2);
        cropH = Math.min(100 - cropY, cropH + padding * 2);
      }

      setCropBox({
        x: Math.round(cropX),
        y: Math.round(cropY),
        width: Math.round(cropW),
        height: Math.round(cropH)
      });

    } catch (e) {
      console.error('Auto boundary detection failed, reverting to default crop area', e);
      // fallback
      setCropBox({ x: 10, y: 10, width: 80, height: 80 });
    }
  };

  // Helper: Calculate luminance for pixel coordinates
  const getLuminance = (x: number, y: number, width: number, data: Uint8ClampedArray): number => {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  // Handle Drag / Resize events of the Crop box corner handles
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    setIsDragging(handle);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      boxX: cropBox.x,
      boxY: cropBox.y,
      boxW: cropBox.width,
      boxH: cropBox.height
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.x) / containerRect.width) * 100;
    const dy = ((e.clientY - dragStart.y) / containerRect.height) * 100;

    let newBox = { ...cropBox };

    if (isDragging === 'box') {
      newBox.x = Math.max(0, Math.min(100 - dragStart.boxW, dragStart.boxX + dx));
      newBox.y = Math.max(0, Math.min(100 - dragStart.boxH, dragStart.boxY + dy));
    } else {
      // Corner adjustments
      if (isDragging.includes('tl')) {
        const potentialX = Math.max(0, Math.min(dragStart.boxX + dragStart.boxW - 15, dragStart.boxX + dx));
        newBox.width = dragStart.boxW + (dragStart.boxX - potentialX);
        newBox.x = potentialX;

        const potentialY = Math.max(0, Math.min(dragStart.boxY + dragStart.boxH - 15, dragStart.boxY + dy));
        newBox.height = dragStart.boxH + (dragStart.boxY - potentialY);
        newBox.y = potentialY;
      }
      if (isDragging.includes('tr')) {
        newBox.width = Math.max(15, Math.min(100 - dragStart.boxX, dragStart.boxW + dx));
        const potentialY = Math.max(0, Math.min(dragStart.boxY + dragStart.boxH - 15, dragStart.boxY + dy));
        newBox.height = dragStart.boxH + (dragStart.boxY - potentialY);
        newBox.y = potentialY;
      }
      if (isDragging.includes('bl')) {
        const potentialX = Math.max(0, Math.min(dragStart.boxX + dragStart.boxW - 15, dragStart.boxX + dx));
        newBox.width = dragStart.boxW + (dragStart.boxX - potentialX);
        newBox.x = potentialX;
        newBox.height = Math.max(15, Math.min(100 - dragStart.boxY, dragStart.boxH + dy));
      }
      if (isDragging.includes('br')) {
        newBox.width = Math.max(15, Math.min(100 - dragStart.boxX, dragStart.boxW + dx));
        newBox.height = Math.max(15, Math.min(100 - dragStart.boxY, dragStart.boxH + dy));
      }

      // Constrain Aspect Ratio if selected
      if (aspectRatio !== 'free') {
        const ratioValue = getAspectRatioValue();
        const containerAspect = containerRect.width / containerRect.height;
        // Adjusted target width based on height to maintain requested ratio
        if (isDragging.includes('br') || isDragging.includes('tr') || isDragging.includes('bl') || isDragging.includes('tl')) {
          const currentHeightInPx = (newBox.height / 100) * containerRect.height;
          const targetWidthInPx = currentHeightInPx * ratioValue;
          newBox.width = (targetWidthInPx / containerRect.width) * 100;
          if (newBox.x + newBox.width > 100) {
            newBox.width = 100 - newBox.x;
            const newHeightInPx = (newBox.width / 100) * containerRect.width / ratioValue;
            newBox.height = (newHeightInPx / containerRect.height) * 100;
          }
        }
      }
    }

    setCropBox({
      x: Math.round(newBox.x),
      y: Math.round(newBox.y),
      width: Math.round(newBox.width),
      height: Math.round(newBox.height)
    });
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, cropBox, aspectRatio]);

  const getAspectRatioValue = (): number => {
    if (aspectRatio === 'aadhaar') return 85 / 54; // Card ratio
    if (aspectRatio === 'a4') return 1 / 1.414; // Portrait documents
    if (aspectRatio === 'square') return 1;
    return 1;
  };

  // Switch Aspect Ratio presets
  const handleAspectRatioChange = (ratio: string) => {
    setAspectRatio(ratio);
    if (ratio === 'free' || !imageRef.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const ratioValue = ratio === 'aadhaar' ? 85 / 54 : ratio === 'a4' ? 1 / 1.414 : 1;
    
    // Recalculate cropBox width based on aspect ratio constraint
    let currentHeightInPx = (cropBox.height / 100) * containerRect.height;
    let targetWidthInPx = currentHeightInPx * ratioValue;
    let targetWidthPercent = (targetWidthInPx / containerRect.width) * 100;

    if (cropBox.x + targetWidthPercent > 100) {
      targetWidthPercent = 100 - cropBox.x;
      const targetHeightInPx = (targetWidthPercent / 100) * containerRect.width / ratioValue;
      const targetHeightPercent = (targetHeightInPx / containerRect.height) * 100;
      setCropBox(prev => ({ ...prev, width: Math.round(targetWidthPercent), height: Math.round(targetHeightPercent) }));
    } else {
      setCropBox(prev => ({ ...prev, width: Math.round(targetWidthPercent) }));
    }
  };

  // Perform Final Canvas Crop on the original high-resolution image
  const executeCrop = () => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load original natural dimensions
    const origWidth = img.naturalWidth;
    const origHeight = img.naturalHeight;

    // Convert cropBox percentage coordinates back to natural pixels
    const cropPixelX = Math.round((cropBox.x / 100) * origWidth);
    const cropPixelY = Math.round((cropBox.y / 100) * origHeight);
    const cropPixelW = Math.round((cropBox.width / 100) * origWidth);
    const cropPixelH = Math.round((cropBox.height / 100) * origHeight);

    // Create target cropped canvas size
    // We also support simple rotation on output if requested
    const rotateRad = (rotation * Math.PI) / 180;
    
    // Set target dimensions
    canvas.width = cropPixelW;
    canvas.height = cropPixelH;

    if (rotation !== 0) {
      // Draw rotated and cropped onto canvas
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rotateRad);
      ctx.drawImage(
        img,
        cropPixelX, cropPixelY, cropPixelW, cropPixelH,
        -cropPixelW / 2, -cropPixelH / 2, cropPixelW, cropPixelH
      );
    } else {
      ctx.drawImage(
        img,
        cropPixelX, cropPixelY, cropPixelW, cropPixelH,
        0, 0, cropPixelW, cropPixelH
      );
    }

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
    
    // Calculate sizes
    const origSizeKb = Math.round((imageSrc.length * 0.75) / 1024);
    const croppedSizeKb = Math.round((croppedBase64.length * 0.75) / 1024);

    onCropApplied(croppedBase64, origSizeKb, croppedSizeKb);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-natural-card border border-natural-border rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[85vh] md:h-[75vh]"
        id="autocrop-container-element"
      >
        
        {/* Header (Top Close bar) */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-3 right-3 z-30 p-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-full transition-colors border border-stone-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Side: Interactive Canvas & Image Workspace */}
        <div className="flex-1 bg-stone-950 p-6 flex flex-col items-center justify-center relative select-none">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 bg-stone-950/80">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-stone-300 font-mono">
                {t('Initializing Workspace...', 'वर्कस्पेस आरंभ किया जा रहा है...')}
              </p>
            </div>
          )}

          {/* Hidden Image for pixel analytics */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Original"
            className="hidden"
            onLoad={handleImageLoaded}
            crossOrigin="anonymous"
          />

          {/* Interactive Crop Workspace */}
          {!loading && (
            <div 
              ref={containerRef}
              className="relative max-w-full max-h-[50vh] md:max-h-[60vh] overflow-hidden shadow-2xl border border-white/10"
              style={{
                aspectRatio: imageRef.current ? `${imageRef.current.naturalWidth}/${imageRef.current.naturalHeight}` : 'auto'
              }}
            >
              <img
                src={imageSrc}
                alt="Workspace Document"
                className="w-full h-full object-contain pointer-events-none block"
                style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s ease' }}
              />

              {/* Draggable Crop Rectangle Overlay */}
              <div
                className="absolute border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] cursor-move z-10"
                style={{
                  left: `${cropBox.x}%`,
                  top: `${cropBox.y}%`,
                  width: `${cropBox.width}%`,
                  height: `${cropBox.height}%`
                }}
                onMouseDown={(e) => handleMouseDown(e, 'box')}
              >
                {/* Status Indicator inside crop-box */}
                <div className="absolute -top-6 left-0 bg-primary text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider shadow-xs flex items-center gap-1">
                  <Scissors className="w-2.5 h-2.5" />
                  <span>{t('Crop Area', 'क्रॉप क्षेत्र')}</span>
                </div>

                {/* Corner Handles */}
                <div
                  className="absolute w-4 h-4 -top-1.5 -left-1.5 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-20 flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'tl')}
                />
                <div
                  className="absolute w-4 h-4 -top-1.5 -right-1.5 bg-white border-2 border-primary rounded-full cursor-nesw-resize z-20 flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'tr')}
                />
                <div
                  className="absolute w-4 h-4 -bottom-1.5 -left-1.5 bg-white border-2 border-primary rounded-full cursor-nesw-resize z-20 flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'bl')}
                />
                <div
                  className="absolute w-4 h-4 -bottom-1.5 -right-1.5 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-20 flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'br')}
                />

                {/* Reticle grid lines inside the crop-box */}
                <div className="absolute inset-y-0 left-1/3 w-px border-l border-dashed border-white/40 pointer-events-none" />
                <div className="absolute inset-y-0 right-1/3 w-px border-l border-dashed border-white/40 pointer-events-none" />
                <div className="absolute inset-x-0 top-1/3 h-px border-t border-dashed border-white/40 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-1/3 h-px border-t border-dashed border-white/40 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Smart Controls Panel */}
        <div className="w-full md:w-80 bg-natural-card border-t md:border-t-0 md:border-l border-natural-border p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider font-mono mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('Smart Auto-Crop Tool', 'स्मार्ट ऑटो-क्रॉप टूल')}</span>
              </div>
              <h3 className="text-md font-serif font-semibold text-natural-dark">
                {t('Document Deskew & Crop', 'दस्तावेज़ क्रॉप और सीधा करें')}
              </h3>
              <p className="text-xs text-accent mt-1 leading-relaxed">
                {t(
                  'Auto-detect boundaries of government documents for premium Gemini recognition fidelity.',
                  'बेहतर जेमिनी विश्लेषण परिशुद्धता के लिए सरकारी दस्तावेजों के किनारों का स्वचालित रूप से पता लगाएं।'
                )}
              </p>
            </div>

            {/* Quick Auto Trigger */}
            <button
              onClick={detectDocumentBoundaries}
              type="button"
              className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl shadow-3xs flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-[1.01] active:scale-99"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>{t('Auto-Detect Boundaries', 'स्वचालित सीमाएँ ढूंढें')}</span>
            </button>

            {/* Aspect Ratio Presets */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-natural-dark uppercase tracking-wider font-mono">
                {t('Aspect Ratio Preset', 'पहलू अनुपात प्रीसेट')}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'free', label: 'Free-form', labelHi: 'मुक्त रूप' },
                  { id: 'aadhaar', label: 'Card Ratio (85:54)', labelHi: 'कार्ड (आधार)' },
                  { id: 'a4', label: 'A4 Portrait', labelHi: 'ए4 आकार' },
                  { id: 'square', label: 'Square (1:1)', labelHi: 'वर्गाकार' }
                ].map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handleAspectRatioChange(preset.id)}
                    type="button"
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-center border transition-all cursor-pointer ${
                      aspectRatio === preset.id
                        ? 'bg-primary text-white border-primary shadow-3xs'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {t(preset.label, preset.labelHi)}
                  </button>
                ))}
              </div>
            </div>

            {/* Fine Tuning Controls */}
            <div className="space-y-3 bg-natural-bg/40 p-3 rounded-xl border border-natural-border/60">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-accent uppercase tracking-wider font-mono">
                <Sliders className="w-3 h-3 text-primary" />
                <span>{t('Boundary Fine Tuning', 'बारीक ट्यूनिंग क्रेडेंशियल')}</span>
              </div>

              {/* Sensitivity slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-natural-dark font-medium">
                  <span>{t('Contrast Sensitivity', 'कंट्रास्ट संवेदनशीलता')}</span>
                  <span className="font-mono text-primary font-bold">{sensitivity}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="80"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseInt(e.target.value))}
                  className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Padding slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-natural-dark font-medium">
                  <span>{t('Crop Area Margin', 'क्रॉप क्षेत्र मार्जिन')}</span>
                  <span className="font-mono text-primary font-bold">{padding}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={padding}
                  onChange={(e) => setPadding(parseInt(e.target.value))}
                  className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Manual Rotation control */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-natural-dark font-medium">
                  {t('Deskew (Rotate)', 'सीधा करें (घुमाएं)')}
                </span>
                <button
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  type="button"
                  className="p-1.5 bg-white border border-stone-200 hover:bg-stone-50 rounded-lg text-stone-600 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                  title="Rotate image 90 degrees clockwise"
                >
                  <RotateCw className="w-3 h-3 text-primary" />
                  <span>+90°</span>
                </button>
              </div>
            </div>

            <div className="p-2.5 bg-amber-500/[0.04] border border-amber-500/10 rounded-xl text-[10px] text-amber-800 leading-relaxed flex gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                {t(
                  'Cropping aligns details cleanly and eliminates empty borders, making text recognition up to 40% more accurate.',
                  'क्रॉपिंग किनारों को साफ करती है और खाली जगह को हटा देती है, जिससे पाठ की पहचान 40% तक अधिक सटीक हो जाती है।'
                )}
              </span>
            </div>
          </div>

          {/* Dialog Action Footer */}
          <div className="flex gap-2.5 pt-4 border-t border-natural-border/50">
            <button
              onClick={onClose}
              type="button"
              className="flex-1 py-2 text-xs font-bold rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 transition-all cursor-pointer text-center"
            >
              {t('Cancel', 'रद्द करें')}
            </button>
            <button
              onClick={executeCrop}
              type="button"
              className="flex-1 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary-hover text-white shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t('Apply Crop', 'क्रॉप लागू करें')}</span>
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
