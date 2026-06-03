'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  Search,
  Trash2,
  Loader2,
  SlidersHorizontal,
  Layers,
  Download,
  Settings,
  X,
  Plus,
  RefreshCw,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { DeckCard, useDeck } from '@/lib/deck-store';
// @ts-ignore
import gifshot from 'gifshot';
// @ts-ignore
import { parseGIF, decompressFrames } from 'gifuct-js';

// Mix blend modes options for energy/spell effects
const BLEND_MODES = [
  { value: 'normal', label: 'Normal' },
  { value: 'screen', label: 'Screen (Glow)' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'multiply', label: 'Multiply' },
];

// Curated search terms for MTG card alters
const CURATED_CATEGORIES = [
  { label: '✨ Sparkles', term: 'sparkles transparent' },
  { label: '🔥 Fire', term: 'fire transparent' },
  { label: '⚡ Lightning', term: 'lightning transparent' },
  { label: '👑 Crown', term: 'crown transparent' },
  { label: '🌀 Spell Portal', term: 'magic circle transparent' },
  { label: '🌠 Energy Aura', term: 'anime aura transparent' },
  { label: '☄️ Laser / Beam', term: 'laser transparent' },
];

interface GifLayer {
  id: string;
  url: string;
  name: string;
  x: number; // center X (pixels relative to 280px container)
  y: number; // center Y (pixels relative to 392px container)
  w: number; // width in pixels
  h: number; // height in pixels
  rotation: number; // degrees
  opacity: number; // 0 to 1
  blendMode: string; // mix-blend-mode
}

interface CommanderGifAlterModalProps {
  card: DeckCard;
  open: boolean;
  onClose: () => void;
}

export function CommanderGifAlterModal({ card, open, onClose }: CommanderGifAlterModalProps) {
  const { dispatch } = useDeck();
  const [layers, setLayers] = useState<GifLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // GIPHY search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'stickers' | 'gifs'>('stickers');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [hoveredGifId, setHoveredGifId] = useState<string | null>(null);

  // Compilation state
  const [compiling, setCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState('');
  const [compileProgress, setCompileProgress] = useState(0);

  const previewRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, layerX: 0, layerY: 0 });
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0, ratio: 1 });
  const isRotatingRef = useRef(false);
  const rotateStartRef = useRef({ x: 0, y: 0, angle: 0 });
  const ignoreNextBackdropClickRef = useRef(false);

  let cardImageUrl =
    card.scryfallData.image_uris?.normal ||
    card.scryfallData.card_faces?.[0]?.image_uris?.normal ||
    '';

  // Bypass WebM / Custom alters for image loading compatibility
  if (
    cardImageUrl &&
    (cardImageUrl.endsWith('.webm') ||
      cardImageUrl.includes('.webm') ||
      cardImageUrl.includes('catbox.moe') ||
      cardImageUrl.includes('pixeldrain.com'))
  ) {
    const scryId = card.scryfallId;
    if (scryId && scryId.length >= 2) {
      cardImageUrl = `https://cards.scryfall.io/normal/front/${scryId[0]}/${scryId[1]}/${scryId}.jpg`;
    }
  }

  // Load initial search on open
  useEffect(() => {
    if (open) {
      handleSearch('sparkles transparent');
    }
  }, [open]);

  // Clean up selection when layers change/deleted
  useEffect(() => {
    if (layers.length === 0) {
      setSelectedLayerId(null);
    } else if (selectedLayerId && !layers.some(l => l.id === selectedLayerId)) {
      setSelectedLayerId(layers[layers.length - 1].id);
    }
  }, [layers, selectedLayerId]);

  // Search GIPHY via server-side API proxy
  async function handleSearch(term: string) {
    if (!term.trim()) return;
    setLoadingSearch(true);
    try {
      const url = `/api/giphy?q=${encodeURIComponent(term)}&type=${searchType}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch Giphy overlays.');
      }
      const data = await res.json();
      setSearchResults(data.data || []);
    } catch (err: any) {
      console.error(err);
      alert(`Search failed: ${err.message || err}`);
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }

  // Add layer helper
  function addLayer(gifUrl: string, name: string = 'Sticker Overlay') {
    const img = new Image();
    img.src = gifUrl;
    img.onload = () => {
      const naturalWidth = img.naturalWidth || 150;
      const naturalHeight = img.naturalHeight || 150;
      
      let w = 150;
      let h = 150;
      if (naturalWidth > naturalHeight) {
        h = Math.round((150 * naturalHeight) / naturalWidth);
      } else {
        w = Math.round((150 * naturalWidth) / naturalHeight);
      }

      const newLayer: GifLayer = {
        id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: gifUrl,
        name: name,
        x: 175, // Center of 350px wide container
        y: 245, // Center of 490px high container
        w: w,
        h: h,
        rotation: 0,
        opacity: 1,
        blendMode: 'normal',
      };
      setLayers(prev => [...prev, newLayer]);
      setSelectedLayerId(newLayer.id);
    };
    img.onerror = () => {
      const newLayer: GifLayer = {
        id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: gifUrl,
        name: name,
        x: 175,
        y: 245,
        w: 150,
        h: 150,
        rotation: 0,
        opacity: 1,
        blendMode: 'normal',
      };
      setLayers(prev => [...prev, newLayer]);
      setSelectedLayerId(newLayer.id);
    };
  }

  // Handle click on card-preview backdrop to deselect
  function handleBackdropClick(e: React.MouseEvent) {
    if (ignoreNextBackdropClickRef.current) {
      ignoreNextBackdropClickRef.current = false;
      return;
    }
    if (e.target === e.currentTarget) {
      setSelectedLayerId(null);
    }
  }

  // Pointer event handlers for moving, resizing, rotating layers
  function handlePointerDown(e: React.PointerEvent, layer: GifLayer, action: 'drag' | 'resize' | 'rotate') {
    e.stopPropagation();
    setSelectedLayerId(layer.id);
    ignoreNextBackdropClickRef.current = true;

    if (action === 'drag') {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        layerX: layer.x,
        layerY: layer.y,
      };
    } else if (action === 'resize') {
      isResizingRef.current = true;
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        w: layer.w,
        h: layer.h,
        ratio: layer.w / (layer.h || 1),
      };
    } else if (action === 'rotate') {
      isRotatingRef.current = true;
      // Get the preview container coordinates for rotation center
      if (previewRef.current) {
        const rect = previewRef.current.getBoundingClientRect();
        const layerCenterX = rect.left + layer.x;
        const layerCenterY = rect.top + layer.y;

        // Calculate starting angle (offset relative to top)
        const dx = e.clientX - layerCenterX;
        const dy = e.clientY - layerCenterY;
        const currentAngleRad = Math.atan2(dy, dx);
        const currentAngleDeg = (currentAngleRad * 180) / Math.PI - 90; // Top is 0

        rotateStartRef.current = {
          x: layerCenterX,
          y: layerCenterY,
          angle: layer.rotation - currentAngleDeg,
        };
      }
    }

    if (previewRef.current) {
      previewRef.current.setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!selectedLayerId) return;

    const layer = layers.find(l => l.id === selectedLayerId);
    if (!layer) return;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      // Update coordinates (contain within bounds loosely)
      const nextX = Math.max(-50, Math.min(400, dragStartRef.current.layerX + dx));
      const nextY = Math.max(-50, Math.min(540, dragStartRef.current.layerY + dy));

      setLayers(prev =>
        prev.map(l => (l.id === selectedLayerId ? { ...l, x: Math.round(nextX), y: Math.round(nextY) } : l))
      );
    } else if (isResizingRef.current) {
      const dx = e.clientX - resizeStartRef.current.x;
      const dy = e.clientY - resizeStartRef.current.y;

      // Use larger offset to change size proportionately or non-proportionately
      // We will preserve ratio to keep GIF overlays square or standard
      const sizeOffset = Math.max(dx, dy);
      const nextW = Math.max(30, Math.min(350, resizeStartRef.current.w + sizeOffset));
      const nextH = nextW / resizeStartRef.current.ratio;

      setLayers(prev =>
        prev.map(l => (l.id === selectedLayerId ? { ...l, w: Math.round(nextW), h: Math.round(nextH) } : l))
      );
    } else if (isRotatingRef.current) {
      const dx = e.clientX - rotateStartRef.current.x;
      const dy = e.clientY - rotateStartRef.current.y;
      const currentAngleRad = Math.atan2(dy, dx);
      const currentAngleDeg = (currentAngleRad * 180) / Math.PI - 90; // Top is 0

      let nextRotation = (rotateStartRef.current.angle + currentAngleDeg) % 360;
      if (nextRotation < 0) nextRotation += 360;

      // Snap to 45 degree increments if shift is pressed
      if (e.shiftKey) {
        nextRotation = Math.round(nextRotation / 45) * 45;
      }

      setLayers(prev =>
        prev.map(l => (l.id === selectedLayerId ? { ...l, rotation: Math.round(nextRotation) } : l))
      );
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    isDraggingRef.current = false;
    isResizingRef.current = false;
    isRotatingRef.current = false;

    if (previewRef.current) {
      try {
        previewRef.current.releasePointerCapture(e.pointerId);
      } catch { }
    }
  }

  // HTML5 Drag and Drop Handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const gifUrl = e.dataTransfer.getData('text/plain');
    if (gifUrl && (gifUrl.startsWith('http') || gifUrl.startsWith('data:'))) {
      // Find relative drop coordinates if dropped on preview area
      if (previewRef.current) {
        const rect = previewRef.current.getBoundingClientRect();
        const dropX = e.clientX - rect.left;
        const dropY = e.clientY - rect.top;

        const img = new Image();
        img.src = gifUrl;
        img.onload = () => {
          const naturalWidth = img.naturalWidth || 150;
          const naturalHeight = img.naturalHeight || 150;
          
          let w = 150;
          let h = 150;
          if (naturalWidth > naturalHeight) {
            h = Math.round((150 * naturalHeight) / naturalWidth);
          } else {
            w = Math.round((150 * naturalWidth) / naturalHeight);
          }

          const newLayer: GifLayer = {
            id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url: gifUrl,
            name: 'Sticker Overlay',
            x: Math.round(Math.max(10, Math.min(340, dropX))),
            y: Math.round(Math.max(10, Math.min(480, dropY))),
            w: w,
            h: h,
            rotation: 0,
            opacity: 1,
            blendMode: 'normal',
          };
          setLayers(prev => [...prev, newLayer]);
          setSelectedLayerId(newLayer.id);
        };
        img.onerror = () => {
          const newLayer: GifLayer = {
            id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url: gifUrl,
            name: 'Sticker Overlay',
            x: Math.round(Math.max(10, Math.min(340, dropX))),
            y: Math.round(Math.max(10, Math.min(480, dropY))),
            w: 150,
            h: 150,
            rotation: 0,
            opacity: 1,
            blendMode: 'normal',
          };
          setLayers(prev => [...prev, newLayer]);
          setSelectedLayerId(newLayer.id);
        };
      }
    }
  }

  // Modify Layer Property
  function updateLayerProperty(layerId: string, property: keyof GifLayer, value: any) {
    setLayers(prev =>
      prev.map(l => (l.id === layerId ? { ...l, [property]: value } : l))
    );
  }

  // Delete Layer
  function deleteLayer(layerId: string) {
    setLayers(prev => prev.filter(l => l.id !== layerId));
  }

  // Compile and Export WebM Video Alter
  async function compileAndDownloadWebM() {
    if (layers.length === 0) return;
    setCompiling(true);
    setCompileStatus('Initializing WebM compiler...');
    setCompileProgress(10);

    try {
      // 1. Preload Background card image
      setCompileStatus('Loading Commander base art...');
      setCompileProgress(20);
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.src = `${cardImageUrl}${cardImageUrl.includes('?') ? '&' : '?'}cors=true`;
      await new Promise((resolve, reject) => {
        bgImg.onload = resolve;
        bgImg.onerror = () => reject(new Error('Commander card image failed to load.'));
      });

      // 2. Fetch and Decode GIFs via gifuct-js
      const loadedLayers: Array<{
        layer: GifLayer;
        frames: any[];
        gifWidth: number;
        gifHeight: number;
        layerCanvases: HTMLCanvasElement[];
        totalDuration: number;
      }> = [];

      for (let i = 0; i < layers.length; i++) {
        const lyr = layers[i];
        setCompileStatus(`Decoding overlay ${i + 1}/${layers.length}...`);
        setCompileProgress(25 + Math.round((i / layers.length) * 35));

        const res = await fetch(lyr.url);
        if (!res.ok) throw new Error(`Could not fetch sticker: ${lyr.name}`);
        const buffer = await res.arrayBuffer();
        const parsedGif = parseGIF(buffer);
        const decompressed = decompressFrames(parsedGif, true);

        const firstFrame = decompressed[0];
        const gifW = firstFrame ? firstFrame.dims.width : 100;
        const gifH = firstFrame ? firstFrame.dims.height : 100;

        const layerCanvases: HTMLCanvasElement[] = [];
        const accumCanvas = document.createElement('canvas');
        accumCanvas.width = gifW;
        accumCanvas.height = gifH;
        const accumCtx = accumCanvas.getContext('2d')!;

        let totalDuration = 0;

        for (let f = 0; f < decompressed.length; f++) {
          const frame = decompressed[f];
          totalDuration += frame.delay || 100;

          if (frame.disposalType === 2) {
            accumCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
          }

          const patchCanvas = document.createElement('canvas');
          patchCanvas.width = frame.dims.width;
          patchCanvas.height = frame.dims.height;
          const patchCtx = patchCanvas.getContext('2d')!;

          const imgData = new ImageData(
            new Uint8ClampedArray(frame.patch),
            frame.dims.width,
            frame.dims.height
          );
          patchCtx.putImageData(imgData, 0, 0);

          accumCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

          const frameCanvas = document.createElement('canvas');
          frameCanvas.width = gifW;
          frameCanvas.height = gifH;
          frameCanvas.getContext('2d')!.drawImage(accumCanvas, 0, 0);
          layerCanvases.push(frameCanvas);
        }

        loadedLayers.push({
          layer: lyr,
          frames: decompressed,
          gifWidth: gifW,
          gifHeight: gifH,
          layerCanvases,
          totalDuration,
        });
      }

      // 3. Set up canvas recording
      setCompileStatus('Starting WebM recording loop (3s)...');
      setCompileProgress(70);

      const outputWidth = 350;
      const outputHeight = 490;
      const mainCanvas = document.createElement('canvas');
      mainCanvas.width = outputWidth;
      mainCanvas.height = outputHeight;
      const mainCtx = mainCanvas.getContext('2d')!;

      // Setup MediaStream and MediaRecorder
      const stream = mainCanvas.captureStream(30); // 30 FPS
      const recordedChunks: Blob[] = [];

      let mimeType = 'video/webm;codecs=vp8';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp9';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
          }
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      const downloadPromise = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => {
          try {
            const blob = new Blob(recordedChunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const cleanCardName = card.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            const link = document.createElement('a');
            link.href = url;
            link.download = `${cleanCardName}_webm_alter.webm`;
            link.click();
            resolve();
          } catch (err) {
            reject(err);
          }
        };
      });

      recorder.start();

      // Run real-time drawing loop for 3000ms
      const durationMs = 3000;
      const startTime = performance.now();

      await new Promise<void>((resolve, reject) => {
        function drawFrame() {
          const now = performance.now();
          const elapsed = now - startTime;

          if (elapsed >= durationMs) {
            recorder.stop();
            resolve();
            return;
          }

          // Update compile progress visually
          const recordPct = Math.round((elapsed / durationMs) * 25);
          setCompileProgress(70 + recordPct);

          // Clear
          mainCtx.clearRect(0, 0, outputWidth, outputHeight);
          // Draw base
          mainCtx.drawImage(bgImg, 0, 0, outputWidth, outputHeight);

          // Draw layers
          for (const loadedLyr of loadedLayers) {
            const { layer, layerCanvases, totalDuration, frames } = loadedLyr;
            if (layerCanvases.length === 0) continue;

            const timeInLoop = elapsed % (totalDuration || 1000);
            let accDelay = 0;
            let frameIndex = 0;
            for (let fd = 0; fd < frames.length; fd++) {
              accDelay += frames[fd].delay || 100;
              if (timeInLoop < accDelay) {
                frameIndex = fd;
                break;
              }
            }

            const activeFrameCanvas = layerCanvases[frameIndex];

            mainCtx.save();
            mainCtx.globalAlpha = layer.opacity;
            mainCtx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;

            const cx = layer.x;
            const cy = layer.y;
            const cw = layer.w;
            const ch = layer.h;

            mainCtx.translate(cx, cy);
            mainCtx.rotate((layer.rotation * Math.PI) / 180);
            mainCtx.drawImage(activeFrameCanvas, -cw / 2, -ch / 2, cw, ch);

            mainCtx.restore();
          }

          requestAnimationFrame(drawFrame);
        }

        requestAnimationFrame(drawFrame);
      });

      await downloadPromise;
      setCompileStatus('Video compiled and downloaded!');
      setCompileProgress(100);
    } catch (err: any) {
      console.error(err);
      alert(`WebM recording failed: ${err.message || 'Unknown error'}`);
    } finally {
      setTimeout(() => {
        setCompiling(false);
      }, 500);
    }
  }

  // Compile and Save as Alter to Card (uploads WebM to Catbox and updates deck data)
  async function compileAndUploadAlter() {
    if (layers.length === 0) return;
    setCompiling(true);
    setCompileStatus('Initializing WebM compiler...');
    setCompileProgress(10);

    try {
      // 1. Preload Background card image
      setCompileStatus('Loading Commander base art...');
      setCompileProgress(20);
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.src = `${cardImageUrl}${cardImageUrl.includes('?') ? '&' : '?'}cors=true`;
      await new Promise((resolve, reject) => {
        bgImg.onload = resolve;
        bgImg.onerror = () => reject(new Error('Commander card image failed to load.'));
      });

      // 2. Fetch and Decode GIFs via gifuct-js
      const loadedLayers: Array<{
        layer: GifLayer;
        frames: any[];
        gifWidth: number;
        gifHeight: number;
        layerCanvases: HTMLCanvasElement[];
        totalDuration: number;
      }> = [];

      for (let i = 0; i < layers.length; i++) {
        const lyr = layers[i];
        setCompileStatus(`Decoding overlay ${i + 1}/${layers.length}...`);
        setCompileProgress(25 + Math.round((i / layers.length) * 35));

        const res = await fetch(lyr.url);
        if (!res.ok) throw new Error(`Could not fetch sticker: ${lyr.name}`);
        const buffer = await res.arrayBuffer();
        const parsedGif = parseGIF(buffer);
        const decompressed = decompressFrames(parsedGif, true);

        const firstFrame = decompressed[0];
        const gifW = firstFrame ? firstFrame.dims.width : 100;
        const gifH = firstFrame ? firstFrame.dims.height : 100;

        const layerCanvases: HTMLCanvasElement[] = [];
        const accumCanvas = document.createElement('canvas');
        accumCanvas.width = gifW;
        accumCanvas.height = gifH;
        const accumCtx = accumCanvas.getContext('2d')!;

        let totalDuration = 0;

        for (let f = 0; f < decompressed.length; f++) {
          const frame = decompressed[f];
          totalDuration += frame.delay || 100;

          if (frame.disposalType === 2) {
            accumCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
          }

          const patchCanvas = document.createElement('canvas');
          patchCanvas.width = frame.dims.width;
          patchCanvas.height = frame.dims.height;
          const patchCtx = patchCanvas.getContext('2d')!;

          const imgData = new ImageData(
            new Uint8ClampedArray(frame.patch),
            frame.dims.width,
            frame.dims.height
          );
          patchCtx.putImageData(imgData, 0, 0);

          accumCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

          const frameCanvas = document.createElement('canvas');
          frameCanvas.width = gifW;
          frameCanvas.height = gifH;
          frameCanvas.getContext('2d')!.drawImage(accumCanvas, 0, 0);
          layerCanvases.push(frameCanvas);
        }

        loadedLayers.push({
          layer: lyr,
          frames: decompressed,
          gifWidth: gifW,
          gifHeight: gifH,
          layerCanvases,
          totalDuration,
        });
      }

      // 3. Set up canvas recording
      setCompileStatus('Starting WebM recording loop (3s)...');
      setCompileProgress(70);

      const outputWidth = 350;
      const outputHeight = 490;
      const mainCanvas = document.createElement('canvas');
      mainCanvas.width = outputWidth;
      mainCanvas.height = outputHeight;
      const mainCtx = mainCanvas.getContext('2d')!;

      // Setup MediaStream and MediaRecorder
      const stream = mainCanvas.captureStream(30); // 30 FPS
      const recordedChunks: Blob[] = [];

      let mimeType = 'video/webm;codecs=vp8';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp9';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
          }
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      const uploadPromise = new Promise<string>((resolve, reject) => {
        recorder.onstop = async () => {
          try {
            setCompileStatus('Uploading WebM to host...');
            setCompileProgress(95);

            const blob = new Blob(recordedChunks, { type: mimeType });
            const cleanCardName = card.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            const file = new File([blob], `${cleanCardName}_webm_alter.webm`, { type: mimeType });

            const formData = new FormData();
            formData.append('image', file);

            const res = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || 'Failed to upload WebM video.');
            }

            const data = await res.json();
            if (!data.data?.url) {
              throw new Error('Upload response did not contain file URL.');
            }

            resolve(data.data.url);
          } catch (err) {
            reject(err);
          }
        };
      });

      recorder.start();

      // Run real-time drawing loop for 3000ms
      const durationMs = 3000;
      const startTime = performance.now();

      await new Promise<void>((resolve) => {
        function drawFrame() {
          const now = performance.now();
          const elapsed = now - startTime;

          if (elapsed >= durationMs) {
            recorder.stop();
            resolve();
            return;
          }

          // Update compile progress visually
          const recordPct = Math.round((elapsed / durationMs) * 20);
          setCompileProgress(70 + recordPct);

          // Clear
          mainCtx.clearRect(0, 0, outputWidth, outputHeight);
          // Draw base
          mainCtx.drawImage(bgImg, 0, 0, outputWidth, outputHeight);

          // Draw layers
          for (const loadedLyr of loadedLayers) {
            const { layer, layerCanvases, totalDuration, frames } = loadedLyr;
            if (layerCanvases.length === 0) continue;

            const timeInLoop = elapsed % (totalDuration || 1000);
            let accDelay = 0;
            let frameIndex = 0;
            for (let fd = 0; fd < frames.length; fd++) {
              accDelay += frames[fd].delay || 100;
              if (timeInLoop < accDelay) {
                frameIndex = fd;
                break;
              }
            }

            const activeFrameCanvas = layerCanvases[frameIndex];

            mainCtx.save();
            mainCtx.globalAlpha = layer.opacity;
            mainCtx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;

            const cx = layer.x;
            const cy = layer.y;
            const cw = layer.w;
            const ch = layer.h;

            mainCtx.translate(cx, cy);
            mainCtx.rotate((layer.rotation * Math.PI) / 180);
            mainCtx.drawImage(activeFrameCanvas, -cw / 2, -ch / 2, cw, ch);

            mainCtx.restore();
          }

          requestAnimationFrame(drawFrame);
        }

        requestAnimationFrame(drawFrame);
      });

      const uploadedUrl = await uploadPromise;

      setCompileStatus('Applying WebM alter to card...');
      setCompileProgress(99);

      // 1. Add to global customCards list
      const alterName = `${card.name} WebM Alter`;
      dispatch({
        type: 'ADD_CUSTOM_CARD',
        name: alterName,
        imageUrl: uploadedUrl,
        associatedScryfallId: card.scryfallId,
        associatedName: card.name,
      });

      // 2. Update active card's image data to use this WebM alter URL
      const updatedScryfallData = {
        ...card.scryfallData,
        image_uris: {
          ...card.scryfallData.image_uris,
          small: uploadedUrl,
          normal: uploadedUrl,
          large: uploadedUrl,
          png: uploadedUrl,
          art_crop: uploadedUrl,
        },
        card_faces: card.scryfallData.card_faces?.map((face, index) =>
          index === 0
            ? {
              ...face,
              image_uris: {
                ...face.image_uris,
                small: uploadedUrl,
                normal: uploadedUrl,
                large: uploadedUrl,
                png: uploadedUrl,
                art_crop: uploadedUrl,
              },
            }
            : face
        ),
      };

      dispatch({
        type: 'UPDATE_CARD_DATA',
        scryfallId: card.scryfallId,
        newCardData: updatedScryfallData,
      });

      setCompileStatus('Successfully saved & applied WebM alter!');
      setCompileProgress(100);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`WebM alter compilation or upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setTimeout(() => {
        setCompiling(false);
      }, 500);
    }
  }

  // Active Layer
  const activeLayer = layers.find(l => l.id === selectedLayerId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[80vw] max-w-[1350px] sm:max-w-none bg-card border border-border shadow-2xl flex flex-col h-[88vh] max-h-[92vh] overflow-hidden p-0">

        {/* Modal Header */}
        <div className="p-4 border-b border-border/80 flex items-center justify-between shrink-0 bg-secondary/10">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 text-foreground text-lg font-bold">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              Commander GIF Alter Workshop
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add transparent animated GIF effects on top of <span className="text-primary font-semibold">{card.name}</span>, position them, and export a combined loop!
            </DialogDescription>
          </DialogHeader>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-8 h-8 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row h-full relative min-h-[500px]">

          {/* COLUMN 1: Active Layers & Sliders */}
          <div className="w-full md:w-[320px] shrink-0 border-r border-border/40 bg-card flex flex-col overflow-hidden h-full">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">

                {/* ACTIVE LAYERS MANAGEMENT SECTION */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    Active Alter Layers ({layers.length})
                  </h3>

                  {layers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl bg-secondary/5 select-none">
                      No overlays added yet. Search and add effects on the right to begin.
                    </div>
                  ) : (
                    <div className="space-y-3.5">

                      {/* Selected Layer Controls (Opacity, Size, Blend Modes) */}
                      {activeLayer ? (
                        <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-4 animate-fade-in-up">
                          <div className="flex items-center justify-between border-b border-purple-500/10 pb-2">
                            <span className="text-xs font-bold text-foreground truncate max-w-[170px]">
                              Selected: <span className="text-primary">{activeLayer.name.slice(0, 20)}</span>
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6 text-muted-foreground hover:text-destructive hover:bg-destructive/15 rounded-md"
                              onClick={() => deleteLayer(activeLayer.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          {/* Sliders Grid */}
                          <div className="space-y-3.5">
                            {/* Opacity */}
                            <div className="space-y-1.5">
                              <label className="text-[10.5px] font-bold text-muted-foreground flex justify-between font-mono">
                                <span>OPACITY:</span>
                                <span className="text-foreground">{Math.round(activeLayer.opacity * 100)}%</span>
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={activeLayer.opacity * 100}
                                onChange={(e) => updateLayerProperty(activeLayer.id, 'opacity', parseFloat(e.target.value) / 100)}
                                className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                              />
                            </div>

                            {/* Size */}
                            <div className="space-y-1.5">
                              <label className="text-[10.5px] font-bold text-muted-foreground flex justify-between font-mono">
                                <span>SIZE:</span>
                                <span className="text-foreground">{activeLayer.w}px</span>
                              </label>
                              <input
                                type="range"
                                min="30"
                                max="350"
                                value={activeLayer.w}
                                onChange={(e) => {
                                  const nextW = parseInt(e.target.value);
                                  const ratio = activeLayer.w / (activeLayer.h || 1);
                                  updateLayerProperty(activeLayer.id, 'w', nextW);
                                  updateLayerProperty(activeLayer.id, 'h', Math.round(nextW / ratio));
                                }}
                                className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                              />
                            </div>

                            {/* Rotation */}
                            <div className="space-y-1.5">
                              <label className="text-[10.5px] font-bold text-muted-foreground flex justify-between font-mono">
                                <span>ROTATION:</span>
                                <span className="text-foreground">{activeLayer.rotation}°</span>
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="359"
                                value={activeLayer.rotation}
                                onChange={(e) => updateLayerProperty(activeLayer.id, 'rotation', parseInt(e.target.value))}
                                className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                              />
                            </div>

                            {/* Blend Mode */}
                            <div className="space-y-1.5">
                              <label className="text-[10.5px] font-bold text-muted-foreground font-mono">
                                BLEND MODE:
                              </label>
                              <select
                                value={activeLayer.blendMode}
                                onChange={(e) => updateLayerProperty(activeLayer.id, 'blendMode', e.target.value)}
                                className="w-full bg-secondary border border-border/80 text-foreground text-xs rounded-lg px-2 py-1.5 focus:border-primary/50 outline-none cursor-pointer font-medium"
                              >
                                {BLEND_MODES.map(mode => (
                                  <option key={mode.value} value={mode.value}>{mode.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Depth Order helpers */}
                          <div className="flex gap-2 justify-end text-[10px] pt-1">
                            <button
                              onClick={() => {
                                const idx = layers.findIndex(l => l.id === activeLayer.id);
                                if (idx > 0) {
                                  const nextLayers = [...layers];
                                  const temp = nextLayers[idx];
                                  nextLayers[idx] = nextLayers[idx - 1];
                                  nextLayers[idx - 1] = temp;
                                  setLayers(nextLayers);
                                }
                              }}
                              className="px-2 py-1 bg-secondary border border-border rounded flex items-center gap-1 active:scale-95 text-muted-foreground hover:text-foreground"
                            >
                              <ChevronDown className="w-3 h-3" /> Send Back
                            </button>
                            <button
                              onClick={() => {
                                const idx = layers.findIndex(l => l.id === activeLayer.id);
                                if (idx < layers.length - 1) {
                                  const nextLayers = [...layers];
                                  const temp = nextLayers[idx];
                                  nextLayers[idx] = nextLayers[idx + 1];
                                  nextLayers[idx + 1] = temp;
                                  setLayers(nextLayers);
                                }
                              }}
                              className="px-2 py-1 bg-secondary border border-border rounded flex items-center gap-1 active:scale-95 text-muted-foreground hover:text-foreground"
                            >
                              <ChevronUp className="w-3 h-3" /> Bring Forward
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 text-center text-xs text-muted-foreground/80 bg-secondary/10 border border-border/40 rounded-lg italic select-none">
                          Select any active overlay layer below to adjust its parameters.
                        </div>
                      )}

                      {/* List of Layer Blocks */}
                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                        {layers.map((lyr, index) => {
                          const isSelected = lyr.id === selectedLayerId;
                          return (
                            <div
                              key={lyr.id}
                              onClick={() => setSelectedLayerId(lyr.id)}
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${isSelected
                                ? 'bg-primary/10 border-primary font-bold text-foreground'
                                : 'border-border/60 bg-secondary/5 text-muted-foreground hover:border-border hover:text-foreground'
                                }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[10px] text-muted-foreground font-semibold">#{index + 1}</span>
                                <div className="w-6 h-6 rounded overflow-hidden bg-black/40 shrink-0 border border-border/40 flex items-center justify-center p-0.5">
                                  <img src={lyr.url} alt={lyr.name} className="w-full h-full object-contain" />
                                </div>
                                <span className="truncate max-w-[120px]">{lyr.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono opacity-80">{lyr.blendMode !== 'normal' ? lyr.blendMode.toUpperCase() : ''}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteLayer(lyr.id);
                                  }}
                                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-red-400"
                                  title="Delete Layer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  )}
                </div>

              </div>
            </ScrollArea>

            {/* Bottom Actions Footer (Fixed at the bottom of Column 1) */}
            <div className="p-4 border-t border-border bg-secondary/15 flex flex-col gap-2 shrink-0">
              <Button
                disabled={layers.length === 0 || compiling}
                onClick={compileAndUploadAlter}
                className="w-full py-5 text-sm bg-primary hover:bg-primary/95 text-primary-foreground font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 relative overflow-hidden"
              >
                {compiling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Recording & Uploading... {compileProgress}%</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    <span>Save & Apply WebM Alter</span>
                  </>
                )}
              </Button>

              <Button
                disabled={layers.length === 0 || compiling}
                onClick={compileAndDownloadWebM}
                variant="outline"
                className="w-full py-5 text-xs text-foreground font-semibold flex items-center justify-center gap-2 relative overflow-hidden"
              >
                {compiling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Recording video... {compileProgress}%</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download WebM (Local Copy)</span>
                  </>
                )}
              </Button>

              {compiling && (
                <div className="space-y-1.5 mt-1 animate-fade-in">
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${compileProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground text-center">{compileStatus}</p>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: Card Preview Canvas */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 border-r border-border/40 bg-black/60 relative overflow-hidden select-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.08),transparent_70%)]" />

            <div className="text-center mb-4 shrink-0 z-10">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Card Alter Preview</p>
              <p className="text-[9px] text-amber-400/90 mt-0.5">Click/drag layers inside to modify. Drag corner to resize. Drag top dot to rotate.</p>
            </div>

            {/* Interactive Card Canvas Wrapper */}
            <div
              ref={previewRef}
              onClick={handleBackdropClick}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative w-[350px] h-[490px] rounded-2xl overflow-hidden border border-border/80 shadow-2xl bg-secondary shrink-0 select-none cursor-default"
              style={{ minWidth: '350px', minHeight: '490px' }}
            >
              {/* Commander card background */}
              <img
                src={cardImageUrl}
                alt={card.name}
                className="w-full h-full object-cover absolute inset-0 select-none pointer-events-none"
                draggable={false}
              />

              {/* Absolute sticker layers */}
              {layers.map((lyr) => {
                const isSelected = lyr.id === selectedLayerId;

                return (
                  <div
                    key={lyr.id}
                    onPointerDown={(e) => handlePointerDown(e, lyr, 'drag')}
                    className={`absolute flex items-center justify-center select-none cursor-move ${isSelected ? 'z-30 ring-2 ring-primary ring-offset-1 ring-offset-black/50' : 'z-20 hover:ring-1 hover:ring-white/40'
                      }`}
                    style={{
                      left: `${lyr.x}px`,
                      top: `${lyr.y}px`,
                      width: `${lyr.w}px`,
                      height: `${lyr.h}px`,
                      transform: `translate(-50%, -50%) rotate(${lyr.rotation}deg)`,
                      opacity: lyr.opacity,
                      mixBlendMode: lyr.blendMode as any,
                    }}
                  >
                    {/* Animated Sticker Image */}
                    <img
                      src={lyr.url}
                      alt={lyr.name}
                      className="w-full h-full object-contain select-none pointer-events-none"
                      draggable={false}
                    />

                    {/* Resize Handle (Bottom Right) */}
                    {isSelected && (
                      <div
                        onPointerDown={(e) => handlePointerDown(e, lyr, 'resize')}
                        className="absolute bottom-0 right-0 w-4 h-4 bg-primary border-2 border-white rounded-full translate-x-1/2 translate-y-1/2 cursor-se-resize z-40 hover:scale-125 transition-transform"
                        title="Drag to resize"
                      />
                    )}

                    {/* Rotate Handle (Top Center Dot) */}
                    {isSelected && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center z-40 select-none">
                        <div
                          onPointerDown={(e) => handlePointerDown(e, lyr, 'rotate')}
                          className="w-4 h-4 bg-amber-500 border-2 border-white rounded-full cursor-alias hover:scale-125 transition-transform"
                          title="Drag to rotate (Hold Shift to snap)"
                        />
                        <div className="w-0.5 h-2 bg-white/70" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total Layer Count status */}
            <div className="mt-4 text-xs text-muted-foreground z-10 flex items-center gap-1.5 font-mono">
              <Layers className="w-3.5 h-3.5" />
              <span>{layers.length} Layers Added</span>
              {layers.length > 0 && (
                <button
                  onClick={() => setLayers([])}
                  className="text-[10px] text-red-400 hover:text-red-300 ml-2 border border-red-500/20 hover:border-red-500/40 px-1.5 py-0.5 rounded transition-all active:scale-95"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* COLUMN 3: GIPHY Search Column */}
          <div className="w-full md:w-[500px] shrink-0 flex flex-col bg-card overflow-hidden h-full p-4 space-y-4">

            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-primary" />
                Find Overlay Effects
              </h3>
            </div>

            {/* Preselected curated quick-search buttons */}
            <div className="flex flex-wrap gap-1 shrink-0">
              {CURATED_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => {
                    setSearchQuery(cat.term);
                    handleSearch(cat.term);
                  }}
                  className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-[10.5px] font-medium border border-border/40 hover:border-primary/20 text-foreground transition-all"
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search query input */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch(searchQuery);
                  }}
                  placeholder="Search Giphy... (e.g. fire, shield, sparks)"
                  className="pl-9 h-9 bg-secondary border-border focus:border-primary/40 text-xs"
                />
              </div>

              {/* Stickers vs Full GIFs selector */}
              <select
                value={searchType}
                onChange={(e) => {
                  setSearchType(e.target.value as any);
                  if (searchQuery.trim()) {
                    setTimeout(() => handleSearch(searchQuery), 50);
                  }
                }}
                className="bg-secondary border border-border text-foreground text-xs rounded-lg px-2 py-2 focus:border-primary/50 outline-none cursor-pointer"
              >
                <option value="stickers">Stickers (Transparent)</option>
                <option value="gifs">GIFs (Full background)</option>
              </select>

              <Button
                size="sm"
                className="h-9 px-3 bg-primary hover:bg-primary/95 text-xs"
                onClick={() => handleSearch(searchQuery)}
              >
                Search
              </Button>
            </div>

            {/* Search results grid - stretch flex-1 to fill the vertical space */}
            <div className="border border-border/40 rounded-xl bg-secondary/15 p-2.5 flex-1 overflow-y-auto min-h-0">
              {loadingSearch ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  <span>Fetching animated overlays...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground text-center px-4">
                  No overlay effects loaded. Use the search bar or click quick effects above.
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 justify-items-center">
                  {searchResults.map((gif) => {
                    const stillUrl = gif.images.fixed_height_small_still?.url || gif.images.fixed_height_small?.url || gif.images.original?.url;
                    const animatedUrl = gif.images.fixed_height_small?.url || gif.images.original?.url;
                    const fullUrl = gif.images.original?.url;
                    const isHovered = hoveredGifId === gif.id;

                    return (
                      <div
                        key={gif.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', fullUrl);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => addLayer(fullUrl, gif.title || 'Giphy Sticker')}
                        onMouseEnter={() => setHoveredGifId(gif.id)}
                        onMouseLeave={() => setHoveredGifId(null)}
                        className="w-20 h-20 sm:w-22 sm:h-22 rounded-lg overflow-hidden border border-border/60 bg-black/40 hover:border-primary cursor-pointer hover:scale-105 transition-all p-1.5 flex items-center justify-center relative group"
                        title="Click to add or drag onto the card"
                      >
                        <img
                          src={isHovered ? animatedUrl : stillUrl}
                          alt={gif.title}
                          className="w-full h-full object-contain select-none pointer-events-none"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Plus className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground/80 italic text-right shrink-0">
              Tip: Click to place in center, or drag-and-drop to place directly.
            </p>

          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
