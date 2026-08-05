"use client";

import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { 
  ChevronLeft, 
  ChevronRight, 
  Pencil, 
  Columns, 
  Copy, 
  Share2, 
  Trash2, 
  Crown, 
  ShieldAlert,
  Loader2,
  FolderOpen,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDeck, SavedDeck } from "@/lib/deck-store";
import { getFrontImageUrl, MTG_CARD_BACK, isGameChangerCard } from "@/lib/scryfall";
import { CardMedia } from "@/components/CardMedia";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DeckShowcase3DProps {
  onOpenSplit: (deckId: string) => void;
  onShareOpen: (deckId: string) => void;
  onImportOpen?: (deckId?: string) => void;
}

export function DeckShowcase3D({ onOpenSplit, onShareOpen, onImportOpen }: DeckShowcase3DProps) {
  const { 
    decks, 
    dispatch, 
    storagePreference, 
    setStoragePreference, 
    storageLoading, 
    isFolderAuthorized, 
    requestFolderPermission 
  } = useDeck();

  const [activeIndex, setActiveIndex] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDeckSource, setCreateDeckSource] = useState<string>("new");

  // Spotlight search states
  const [typedText, setTypedText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const typedTextRef = useRef("");
  const isTypingRef = useRef(false);
  const lastStrokeRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Derive filtered decks based on deckName or Commander name
  const filteredDecks = decks.filter((deck) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const commander = deck.cards.find((c) => c.isCommander);
    const hasCommanderMatch = commander ? commander.name.toLowerCase().includes(q) : false;
    return deck.deckName.toLowerCase().includes(q) || hasCommanderMatch;
  });

  const clearSearch = () => {
    setTypedText("");
    typedTextRef.current = "";
    setSearchQuery("");
    setIsTyping(false);
    isTypingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeIndexRef = useRef(activeIndex);
  const decksRef = useRef(filteredDecks);
  const isMobileRef = useRef(isMobile);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    decksRef.current = filteredDecks;
  }, [filteredDecks]);

  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  // Spotlight search key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      // Ignore modifiers and utility keys
      if (
        e.key.length > 1 &&
        e.key !== "Backspace" &&
        e.key !== "Escape" &&
        e.key !== "Spacebar" &&
        e.key !== " "
      ) {
        return;
      }

      if (e.key === "Escape") {
        clearSearch();
        return;
      }

      let char = e.key;
      if (char === "Spacebar" || char === " ") {
        char = " ";
      }

      // Prevent default page scroll on Space
      if (e.key === " ") {
        e.preventDefault();
      }

      const now = Date.now();
      // Session is active if typing flag is set AND less than 1.5 seconds have elapsed since last keystroke
      const isSessionActive = isTypingRef.current && (now - lastStrokeRef.current < 1500);

      let nextText = "";
      if (e.key === "Backspace") {
        nextText = isSessionActive ? typedTextRef.current.slice(0, -1) : "";
      } else {
        nextText = isSessionActive ? (typedTextRef.current + char) : char;
      }

      setTypedText(nextText);
      typedTextRef.current = nextText;
      setIsTyping(true);
      isTypingRef.current = true;
      lastStrokeRef.current = now;

      if (timerRef.current) clearTimeout(timerRef.current);

      if (nextText === "") {
        setSearchQuery("");
        setIsTyping(false);
        isTypingRef.current = false;
      } else {
        timerRef.current = setTimeout(() => {
          setSearchQuery(nextText);
          setIsTyping(false);
          isTypingRef.current = false;
        }, 1000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.shadowMap.enabled = true;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 3.2);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(5, 8, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.35);
    dirLight2.position.set(-5, 5, -2);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xffffff, 1.2, 8);
    pointLight.position.set(0, 1, 3);
    scene.add(pointLight);

    // Carousel Group
    const carouselGroup = new THREE.Group();
    scene.add(carouselGroup);

    // Texture Loader with Cache
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'anonymous';
    const textures: Record<string, THREE.Texture> = {};

    const loadTex = (url: string, callback: (tex: THREE.Texture) => void) => {
      if (textures[url]) {
        callback(textures[url]);
        return;
      }
      textureLoader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textures[url] = tex;
        callback(tex);
      }, undefined, (err) => {
        console.warn("Failed to load texture:", url, err);
      });
    };

    // Helper to get mana color hex
    const getManaColorHex = (commander: any) => {
      if (!commander || !commander.scryfallData) return 0x2b2b2b;
      const colors = commander.scryfallData.colors || commander.scryfallData.color_identity || [];
      if (colors.length === 0) return 0x2b2b2b;
      const first = colors[0];
      if (first === 'W') return 0xfef08a;
      if (first === 'U') return 0x2563eb;
      if (first === 'B') return 0x4b1a7a;
      if (first === 'R') return 0xdc2626;
      if (first === 'G') return 0x16a34a;
      return 0x2b2b2b;
    };

    // Dimensions
    const boxW = 1.45;
    const boxH = 2.03;
    const boxD = 0.28;
    const cardW = 1.35;
    const cardH = 1.89;

    // Create item meshes for all decks
    const items = decksRef.current.map((deck, idx) => {
      const deckGroup = new THREE.Group();
      deckGroup.userData = { index: idx, id: deck.id };

      // Base Box Body
      const boxGeo = new THREE.BoxGeometry(boxW, boxH, boxD);
      const commander = deck.cards.find((c) => c.isCommander);
      const borderMat = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.5, metalness: 0.1 });

      // Create placeholder materials (black border panels, cardback front/back)
      const boxMaterials = [
        borderMat, // Right
        borderMat, // Left
        borderMat, // Top
        borderMat, // Bottom
        new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.3, metalness: 0.1 }), // Front
        new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.3, metalness: 0.1 }), // Back
      ];

      const boxBodyMesh = new THREE.Mesh(boxGeo, boxMaterials);
      boxBodyMesh.castShadow = true;
      boxBodyMesh.receiveShadow = true;
      deckGroup.add(boxBodyMesh);

      // Lid Pivot & Mesh
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, boxH / 2, -boxD / 2); // Rotate around back-top edge
      
      const lidH = 0.25;
      const lidGeo = new THREE.BoxGeometry(boxW + 0.01, lidH, boxD + 0.01);

      const lidMesh = new THREE.Mesh(lidGeo, borderMat);
      lidMesh.position.set(0, lidH / 2, boxD / 2); // Shift so it fits on top
      lidPivot.add(lidMesh);
      deckGroup.add(lidPivot);

      // Helper to generate a shape with rounded corners
      const roundedRect = (w: number, h: number, r: number) => {
        const shape = new THREE.Shape();
        const x = -w / 2;
        const y = -h / 2;
        shape.moveTo(x, y + r);
        shape.lineTo(x, y + h - r);
        shape.quadraticCurveTo(x, y + h, x + r, y + h);
        shape.lineTo(x + w - r, y + h);
        shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
        shape.lineTo(x + w, y + r);
        shape.quadraticCurveTo(x + w, y, x + w - r, y);
        shape.lineTo(x + r, y);
        shape.quadraticCurveTo(x, y, x, y + r);
        return shape;
      };

      const cardShape = roundedRect(cardW, cardH, 0.065);
      
      // Use two back-to-back ExtrudeGeometries to give 3D depth/thickness and rounded corners
      const cardHalfGeo = new THREE.ExtrudeGeometry(cardShape, {
        depth: 0.003,
        bevelEnabled: false
      });

      // Normalize UV coordinates so texture maps perfectly to the cap faces
      const posAttr = cardHalfGeo.attributes.position;
      const uvAttr = cardHalfGeo.attributes.uv;
      if (posAttr && uvAttr) {
        for (let i = 0; i < posAttr.count; i++) {
          const x = posAttr.getX(i);
          const y = posAttr.getY(i);
          const u = (x + cardW / 2) / cardW;
          const v = (y + cardH / 2) / cardH;
          uvAttr.setXY(i, u, v);
        }
        uvAttr.needsUpdate = true;
      }

      const cardFrontMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.2 });
      const cardBackMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.2 });
      const cardEdgeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }); // Black paper edge

      // ExtrudeGeometry materials: index 0 is Cap (face), index 1 is Side (walls)
      const frontMesh = new THREE.Mesh(cardHalfGeo, [cardFrontMat, cardEdgeMat]);
      frontMesh.position.set(0, 0, 0);

      const backMesh = new THREE.Mesh(cardHalfGeo, [cardBackMat, cardEdgeMat]);
      backMesh.position.set(0, 0, 0);
      backMesh.rotation.y = Math.PI;

      const cardGroup = new THREE.Group();
      cardGroup.position.set(0, 0, 0); // Inside box
      cardGroup.add(frontMesh);
      cardGroup.add(backMesh);

      deckGroup.add(cardGroup);

      // Add to carousel
      carouselGroup.add(deckGroup);

      // Load cardback texture
      const cardbackUrl = deck.customCardbackUrl || MTG_CARD_BACK;
      loadTex(cardbackUrl, (tex) => {
        boxMaterials[4].map = tex;
        boxMaterials[4].color.setHex(0xffffff);
        boxMaterials[4].needsUpdate = true;
        boxMaterials[5].map = tex;
        boxMaterials[5].color.setHex(0xffffff);
        boxMaterials[5].needsUpdate = true;

        cardBackMat.map = tex;
        cardBackMat.color.setHex(0xffffff);
        cardBackMat.needsUpdate = true;
      });

      // Load commander texture
      if (commander) {
        const commanderImg = getFrontImageUrl(commander.scryfallData);
        if (commanderImg) {
          loadTex(commanderImg, (tex) => {
            cardFrontMat.map = tex;
            cardFrontMat.color.setHex(0xffffff);
            cardFrontMat.needsUpdate = true;
          });
        }
      }

      return {
        deckId: deck.id,
        group: deckGroup,
        lidPivot,
        cardGroup,
        currLidRot: 0,
        currCardX: 0,
        currCardY: 0,
        currCardZ: 0,
        currCardRotY: 0,
        currCardRotZ: 0,
        currBoxX: 0,
        currBoxZ: 0,
        currBoxRotY: 0,
      };
    });

    // Layout the carousel extending backwards
    const totalDecks = decksRef.current.length;
    const radius = Math.max(3.8, totalDecks * 0.72);

    carouselGroup.position.set(0, 0, -radius);

    items.forEach((item, idx) => {
      const angle = idx * (2 * Math.PI / totalDecks);
      item.group.position.x = radius * Math.sin(angle);
      item.group.position.z = radius * Math.cos(angle);
      item.group.rotation.y = angle;
    });

    // Pointer Move
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouseRef.current = { x, y };
    };
    window.addEventListener("mousemove", onMouseMove);

    // Click Raycaster
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const intersects = raycaster.intersectObjects(carouselGroup.children, true);
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj !== scene) {
          if (obj.userData && typeof obj.userData.index === "number") {
            const clickedIndex = obj.userData.index;
            if (clickedIndex !== activeIndexRef.current) {
              setActiveIndex(clickedIndex);
            }
            break;
          }
          obj = obj.parent;
        }
      }
    };
    canvas.addEventListener("click", onClick);

    // Resize handler
    const handleResize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const activeIdx = activeIndexRef.current;
      const isMob = isMobileRef.current;
      const time = clock.getElapsedTime();

      // Dynamic camera distance to make models look much larger and frame perfectly
      if (isMob) {
        camera.position.set(0, 0, 3.6);
      } else {
        camera.position.set(0, 0, 3.2);
      }

      // Smooth rotate carousel to active deck
      const angleStep = (2 * Math.PI) / Math.max(totalDecks, 1);
      const targetCarouselRotY = -activeIdx * angleStep;

      let diff = targetCarouselRotY - carouselGroup.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      carouselGroup.rotation.y += diff * 0.08;

      items.forEach((item, idx) => {
        const isActive = idx === activeIdx;

        // Targets
        const targetLidRot = isActive ? -Math.PI * 0.72 : 0;
        const targetCardX = isActive ? (isMob ? -0.7 : -1.15) : 0;
        const targetCardY = isActive ? 0.05 : 0;
        const targetCardZ = isActive ? 0.25 : 0.01;
        const targetCardRotY = isActive ? 0.15 : 0;
        const targetCardRotZ = isActive ? -0.05 : 0;
        
        const targetBoxX = isActive ? (isMob ? 0.60 : 0.95) : 0;
        const targetBoxZ = isActive ? -0.2 : 0;
        const targetBoxRotY = isActive ? -0.22 : 0;

        // Lerps
        item.currLidRot = THREE.MathUtils.lerp(item.currLidRot, targetLidRot, 0.08);
        item.currCardX = THREE.MathUtils.lerp(item.currCardX, targetCardX, 0.08);
        item.currCardY = THREE.MathUtils.lerp(item.currCardY, targetCardY, 0.08);
        item.currCardZ = THREE.MathUtils.lerp(item.currCardZ, targetCardZ, 0.08);
        item.currCardRotY = THREE.MathUtils.lerp(item.currCardRotY, targetCardRotY, 0.08);
        item.currCardRotZ = THREE.MathUtils.lerp(item.currCardRotZ, targetCardRotZ, 0.08);

        item.currBoxX = THREE.MathUtils.lerp(item.currBoxX, targetBoxX, 0.08);
        item.currBoxZ = THREE.MathUtils.lerp(item.currBoxZ, targetBoxZ, 0.08);
        item.currBoxRotY = THREE.MathUtils.lerp(item.currBoxRotY, targetBoxRotY, 0.08);

        // Apply transformations
        item.lidPivot.rotation.x = item.currLidRot;

        let hoverTiltX = 0;
        let hoverTiltY = 0;
        let floatingY = 0;
        
        if (isActive) {
          hoverTiltX = mouseRef.current.y * 0.12;
          hoverTiltY = mouseRef.current.x * 0.15;
          floatingY = Math.sin(time * 2.2) * 0.035;
        }

        // Apply to Card Group
        item.cardGroup.position.set(item.currCardX, item.currCardY + floatingY, item.currCardZ);
        item.cardGroup.rotation.set(hoverTiltX, item.currCardRotY + hoverTiltY, item.currCardRotZ);

        // Apply to Box Body and Lid
        const boxContentMesh = item.group.children[0]; 
        const lidPivotGroup = item.group.children[1]; 

        boxContentMesh.position.set(item.currBoxX, floatingY * 0.7, item.currBoxZ);
        boxContentMesh.rotation.set(hoverTiltX * 0.5, item.currBoxRotY + hoverTiltY * 0.5, 0);

        lidPivotGroup.position.set(item.currBoxX, (boxH / 2) + floatingY * 0.7, item.currBoxZ - boxD / 2);
        lidPivotGroup.rotation.y = item.currBoxRotY + hoverTiltY * 0.5;
        lidPivotGroup.rotation.x = hoverTiltX * 0.5;
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      resizeObserver.disconnect();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      Object.values(textures).forEach((tex) => tex.dispose());
    };
  }, [filteredDecks.length, searchQuery]);

  // Sync active index if filtered deck list size changes
  useEffect(() => {
    if (activeIndex >= filteredDecks.length && filteredDecks.length > 0) {
      setActiveIndex(filteredDecks.length - 1);
    }
  }, [filteredDecks.length, activeIndex]);

  // Window resize handler to determine mobile vs desktop scaling
  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Helper to extract banner art for background
  function getDeckArt(deck: SavedDeck | null): string {
    if (!deck) return "https://i.pinimg.com/736x/7e/be/a3/7ebea35ad91c8ee201b0647a7c0d816b.jpg";
    if (deck.coverCardId) {
      const cover = deck.cards.find((c) => c.scryfallId === deck.coverCardId);
      if (cover?.scryfallData) {
        const data = cover.scryfallData;
        const id = cover.scryfallId;
        const art = data.image_uris?.art_crop || data.card_faces?.[0]?.image_uris?.art_crop || data.image_uris?.normal || "";
        if (
          art.endsWith(".webm") ||
          art.includes(".webm") ||
          art.includes("catbox.moe") ||
          art.includes("pixeldrain.com") ||
          art.includes("ufs.sh") ||
          art.includes("utfs.io")
        ) {
          return `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`;
        }
        if (art) return art;
      }
    }

    const commander = deck.cards.find((c) => c.isCommander);
    if (commander?.scryfallData) {
      const data = commander.scryfallData;
      const id = commander.scryfallId;
      const art = data.image_uris?.art_crop || data.card_faces?.[0]?.image_uris?.art_crop || data.image_uris?.normal || "";
      if (
        art.endsWith(".webm") ||
        art.includes(".webm") ||
        art.includes("catbox.moe") ||
        art.includes("pixeldrain.com") ||
        art.includes("ufs.sh") ||
        art.includes("utfs.io")
      ) {
        return `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`;
      }
      if (art) return art;
    }
    return "https://i.pinimg.com/736x/7e/be/a3/7ebea35ad91c8ee201b0647a7c0d816b.jpg";
  }

  // Navigation handlers
  const handlePrev = () => {
    if (filteredDecks.length === 0) return;
    setActiveIndex((prev) => (prev - 1 + filteredDecks.length) % filteredDecks.length);
    setDeletingId(null);
  };

  const handleNext = () => {
    if (filteredDecks.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % filteredDecks.length);
    setDeletingId(null);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in spotlight search or form inputs
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredDecks.length]);

  if (storageLoading) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative w-16 h-20 rounded-lg border-2 border-primary/20 bg-card/40 flex items-center justify-center animate-pulse">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
        <p className="text-sm font-semibold text-muted-foreground tracking-wide">
          Loading Decks...
        </p>
      </div>
    );
  }

  if (storagePreference === "folder" && !isFolderAuthorized) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 px-4">
        <div className="w-full max-w-md bg-secondary/15 border border-border/60 rounded-2xl p-6 text-center flex flex-col items-center gap-5 shadow-xl shadow-black/40 animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary mb-1">
            <FolderOpen className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-foreground">Local Folder Access Suspended</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              For security, the browser requires you to confirm permissions to access your local files upon page reload. 
              Click below to reconnect your decks without having to re-select the folder.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
            <Button 
              onClick={async () => {
                setReconnecting(true);
                await requestFolderPermission();
                setReconnecting(false);
              }}
              disabled={reconnecting}
              className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {reconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderOpen className="w-4 h-4" />
              )}
              Reconnect Folder
            </Button>
            <Button
              variant="outline"
              onClick={() => setStoragePreference(null)}
              className="border-border hover:bg-secondary text-xs"
            >
              Change Destination
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center py-16 px-4">
        <div className="text-center py-16 border border-border/30 rounded-2xl bg-secondary/5 mt-8 max-w-md mx-auto flex flex-col items-center">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-foreground/80">You don't have any saved decks</h3>
          <p className="text-xs text-muted-foreground mt-1 px-4 mb-6">
            Create a new one to start designing your Commander deck and experience the 3D showcase.
          </p>
          <Button 
            onClick={() => dispatch({ type: "CREATE_DECK", id: `deck-${Date.now()}` })}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create First Deck
          </Button>
        </div>
      </div>
    );
  }

  const activeDeck = filteredDecks[activeIndex] || null;
  const totalQty = activeDeck ? activeDeck.cards.reduce((sum, c) => sum + c.quantity, 0) : 0;
  
  const wins = activeDeck ? (activeDeck.wins || 0) : 0;
  const losses = activeDeck ? (activeDeck.losses || 0) : 0;
  const totalGames = wins + losses;
  const winrate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  
  const gcCount = activeDeck ? activeDeck.cards.filter((c) => isGameChangerCard(c.name)).reduce((sum, c) => sum + c.quantity, 0) : 0;
  const bannedCount = activeDeck ? activeDeck.cards.filter((c) => c.scryfallData.legalities?.commander === "banned").reduce((sum, c) => sum + c.quantity, 0) : 0;

  const activeCommander = activeDeck ? (activeDeck.cards.find((c) => c.isCommander) || null) : null;
  const activeCommanderImg = activeCommander ? getFrontImageUrl(activeCommander.scryfallData) : null;
  const activeCardback = activeDeck ? (activeDeck.customCardbackUrl || MTG_CARD_BACK) : MTG_CARD_BACK;

  // Helper to calculate dynamic radial gradient glow based on active commander's colors
  function getManaColorGlow(commander: any): string {
    if (!commander || !commander.scryfallData) {
      // Default warm red/gold glow
      return "radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 80%)";
    }

    const colors = commander.scryfallData.colors || commander.scryfallData.color_identity || [];

    if (colors.length === 0) {
      // Colorless: grey/silver glow
      return "radial-gradient(circle, rgba(148, 163, 184, 0.12) 0%, transparent 80%)";
    }

    // Map color symbols to nice semi-transparent RGBA glow colors
    const colorMap: Record<string, string> = {
      W: "rgba(254, 240, 138, 0.18)", // White -> Yellowish/Warm glow
      U: "rgba(59, 130, 246, 0.25)",  // Blue
      B: "rgba(168, 85, 247, 0.22)",  // Black -> Purple glow
      R: "rgba(239, 68, 68, 0.25)",   // Red
      G: "rgba(34, 197, 94, 0.22)",   // Green
    };

    if (colors.length === 1) {
      const color = colors[0];
      const rgba = colorMap[color] || "rgba(239, 68, 68, 0.15)";
      return `radial-gradient(circle, ${rgba} 0%, transparent 85%)`;
    }

    // Multicolor: Blend of colors
    const rgbList = colors.map((c: string) => colorMap[c]).filter(Boolean);
    if (rgbList.length === 0) {
      return "radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 80%)";
    }

    // Assemble radial gradient stops
    const stops = rgbList.map((rgba: string, idx: number) => {
      const percent = Math.round((idx / (rgbList.length - 1)) * 60);
      return `${rgba} ${percent}%,`;
    }).join(" ");

    return `radial-gradient(circle, ${stops} transparent 90%)`;
  }

  const activeDeckArt = activeDeck ? getDeckArt(activeDeck) : "https://i.pinimg.com/736x/7e/be/a3/7ebea35ad91c8ee201b0647a7c0d816b.jpg";

  return (
    <div className="flex-1 h-full w-full relative flex flex-col items-center justify-between pt-16 pb-4 overflow-hidden select-none">
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1.2s step-start infinite;
        }
      `}</style>

      {/* Floating New Deck Button */}
      <Button
        onClick={() => setIsCreateModalOpen(true)}
        className="absolute top-4 left-4 z-40 sm:top-6 sm:left-6 md:left-8 gap-1.5 text-xs font-semibold px-4 h-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 cursor-pointer transition-all duration-200"
      >
        <Plus className="w-4 h-4" />
        <span>New Deck</span>
      </Button>

      {/* ── SPOTLIGHT KEYBOARD SEARCH OVERLAY ── */}
      {isTyping && typedText && (
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in duration-200">
          <div className="text-center space-y-4 max-w-lg px-6">
            <p className="text-xs tracking-widest text-primary/80 font-bold animate-pulse">
              Buscando Mazos...
            </p>
            <div className="relative">
              <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight break-all select-none">
                {typedText}
                <span className="animate-blink font-light text-primary">|</span>
              </h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Deja de escribir para aplicar el filtro. Pulsa <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Esc</kbd> para cancelar.
            </p>
          </div>
        </div>
      )}

      {/* ── FILTER STATUS BAR ── */}
      {searchQuery && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-background/80 backdrop-blur-md border border-primary/20 rounded-full py-1.5 pl-4 pr-2 flex items-center gap-3 shadow-lg shadow-primary/5 animate-fade-in-up">
          <span className="text-xs font-semibold text-muted-foreground">
            Filtrado por: <strong className="text-foreground">{searchQuery}</strong>
          </span>
          <Button
            onClick={clearSearch}
            variant="destructive"
            size="xs"
            className="rounded-full px-3 h-6 text-[10px]"
          >
            Limpiar Filtro
          </Button>
        </div>
      )}

      {/* ── IMMERSIVE BACKGROUND ── */}
      <div className="absolute inset-0 pointer-events-none select-none z-0">
        {/* Blurred dynamic active commander card face background */}
        <div 
          className="absolute inset-0 bg-cover bg-center scale-110 opacity-35 blur-[90px] brightness-[0.55] transition-all duration-700 ease-out"
          style={{ backgroundImage: `url(${activeCommanderImg || activeDeckArt})` }}
        />

        {/* Dynamic Mana Color Glow Gradient Layer */}
        <div 
          className="absolute inset-0 transition-all duration-700 ease-out opacity-80"
          style={{ backgroundImage: getManaColorGlow(activeCommander) }}
        />
        
        {/* Scattered deck cards background */}
        <div className="absolute inset-0 opacity-[0.08] blur-[2px] scale-105 flex flex-wrap gap-6 items-center justify-center p-8 transition-all duration-700">
          {filteredDecks.map((deck, idx) => {
            const art = getDeckArt(deck);
            return (
              <div 
                key={`bg-deck-${deck.id}-${idx}`}
                className="w-28 h-38 rounded-lg bg-cover bg-center shadow-xl border border-white/5 transition-transform duration-700"
                style={{ 
                  backgroundImage: `url(${art})`,
                  transform: `rotate(${(idx * 13) % 40 - 20}deg) translateY(${(idx * 7) % 20 - 10}px)`
                }}
              />
            );
          })}
        </div>
        
        {/* Radial vignette mask for depth and premium focus */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,var(--background)_85%)]" />
      </div>

      {/* ── 3D ROULETTE CAROUSEL AREA ── */}
      <div className="w-full max-w-none relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center">
        
        {/* Carousel Showcase Row */}
        <div className="w-full flex-1 min-h-0 flex items-center justify-center relative px-0">
          
          {/* Left Navigation Arrow */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            disabled={filteredDecks.length === 0}
            className="absolute left-2 sm:left-6 md:left-12 w-12 h-12 rounded-full border border-border/40 bg-black/50 backdrop-blur-md hover:bg-primary/20 hover:border-primary/50 text-foreground transition-all duration-200 shadow-md z-35 shrink-0 disabled:opacity-30 disabled:pointer-events-none"
            title="Previous"
          >
            <ChevronLeft className="w-7 h-7" />
          </Button>

          {/* 3D Container viewport */}
          <div className="flex-1 h-full w-full relative overflow-visible flex items-center justify-center">
            {filteredDecks.length === 0 ? (
              <div className="text-center space-y-4 p-8 border border-border/20 rounded-2xl bg-secondary/5 max-w-sm z-30 shadow-xl backdrop-blur-sm">
                <ShieldAlert className="w-10 h-10 text-muted-foreground/60 mx-auto mb-1 animate-bounce" />
                <h3 className="text-base font-bold text-foreground">No se encontraron mazos</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No hay ningún mazo guardado o comandante que coincida con la palabra &ldquo;<strong className="text-primary font-bold">{searchQuery}</strong>&rdquo;.
                </p>
                <Button onClick={clearSearch} size="sm" className="mt-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 h-9">
                  Limpiar búsqueda
                </Button>
              </div>
            ) : (
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full outline-none" />
            )}
          </div>

          {/* Right Navigation Arrow */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            disabled={filteredDecks.length === 0}
            className="absolute right-2 sm:right-6 md:right-12 w-12 h-12 rounded-full border border-border/40 bg-black/50 backdrop-blur-md hover:bg-primary/20 hover:border-primary/50 text-foreground transition-all duration-200 shadow-md z-35 shrink-0 disabled:opacity-30 disabled:pointer-events-none"
            title="Next"
          >
            <ChevronRight className="w-7 h-7" />
          </Button>

        </div>

        {/* ── ACTIVE DECK INFORMATION DISPLAY ── */}
        {activeDeck && (
          <div className="mt-10 text-center max-w-2xl w-full px-6 space-y-6 animate-fade-in-up">
            {/* Title & Commander Section */}
            <div className="space-y-2">
              {/* Large Deck Title */}
              <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
                {activeDeck.deckName}
              </h2>
              
              {/* Commander Subtitle */}
              <p className="text-sm md:text-base text-muted-foreground font-medium flex items-center justify-center gap-2">
                {activeCommander ? (
                  <>
                    <Crown className="w-5 h-5 text-amber-500 fill-amber-500/10 animate-bounce" />
                    <span>Led by <strong className="text-foreground/90 font-semibold">{activeCommander.name}</strong></span>
                  </>
                ) : (
                  <span className="italic text-muted-foreground/60">No commander specified</span>
                )}
              </p>
            </div>

            {/* Premium Grid Stats Panel */}
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              {/* Stat 1: Cards count */}
              <div className="bg-secondary/20 border border-border/40 rounded-xl p-3 backdrop-blur-xs flex flex-col items-center justify-center shadow-sm">
                <span className="font-mono text-xl sm:text-2xl font-extrabold text-foreground">
                  {totalQty} <span className="text-xs text-muted-foreground/80 font-normal">/100</span>
                </span>
                <span className="text-[10px] tracking-wider text-muted-foreground font-semibold mt-1">
                  Cartas
                </span>
              </div>

              {/* Stat 2: Game Changers */}
              <div className="bg-secondary/20 border border-border/40 rounded-xl p-3 backdrop-blur-xs flex flex-col items-center justify-center shadow-sm">
                <span className="font-mono text-xl sm:text-2xl font-extrabold text-indigo-400">
                  {gcCount}
                </span>
                <span className="text-[10px] tracking-wider text-muted-foreground font-semibold mt-1">
                  Game Changers
                </span>
              </div>
            </div>

            {/* ── ACTION BUTTONS UNDER THE DECK ── */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
              {deletingId === activeDeck.id ? (
                <div className="flex items-center gap-3 w-full bg-destructive/90 rounded-xl border border-red-500/30 p-2 text-sm text-destructive-foreground justify-between font-semibold shadow-lg animate-pulse">
                  <span className="pl-3">¿Eliminar este mazo de forma permanente?</span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => {
                        dispatch({ type: "DELETE_DECK", deckId: activeDeck.id });
                        setDeletingId(null);
                      }}
                      className="bg-white text-destructive font-bold px-4 py-1.5 rounded-lg hover:bg-white/80 transition-colors shadow text-xs"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="bg-black/40 font-bold px-4 py-1.5 rounded-lg hover:bg-black/60 text-white transition-colors text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* 1. Edit */}
                  <Button
                    onClick={() => dispatch({ type: "OPEN_DECK", deckId: activeDeck.id })}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 px-6 h-11 shadow-lg shadow-primary/20 text-sm shrink-0 rounded-xl"
                  >
                    <Pencil className="w-4 h-4" />
                    <span>Editar Mazo</span>
                  </Button>

                  {/* 2. Split view */}
                  <Button
                    variant="outline"
                    onClick={() => onOpenSplit(activeDeck.id)}
                    className="w-11 h-11 sm:w-auto sm:px-4 text-muted-foreground hover:text-foreground border border-border/40 rounded-xl bg-black/20 hover:bg-black/40 shrink-0 gap-2 text-xs"
                    title="Abrir en pantalla dividida"
                  >
                    <Columns className="w-4 h-4 text-primary" />
                    <span className="hidden sm:inline">Vista Dividida</span>
                  </Button>

                  {/* 3. Duplicate */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      dispatch({
                        type: "DUPLICATE_DECK",
                        deckId: activeDeck.id,
                        newDeckId: `deck-${Date.now()}`,
                      });
                    }}
                    className="w-11 h-11 sm:w-auto sm:px-4 text-muted-foreground hover:text-foreground border border-border/40 rounded-xl bg-black/20 hover:bg-black/40 shrink-0 gap-2 text-xs"
                    title="Duplicar Mazo"
                  >
                    <Copy className="w-4 h-4 text-amber-400" />
                    <span className="hidden sm:inline">Duplicar</span>
                  </Button>

                  {/* 4. Share */}
                  <Button
                    variant="outline"
                    onClick={() => onShareOpen(activeDeck.id)}
                    className="w-11 h-11 sm:w-auto sm:px-4 text-muted-foreground hover:text-emerald-400 border border-border/40 rounded-xl bg-black/20 hover:bg-black/40 shrink-0 gap-2 text-xs"
                    title="Compartir Mazo"
                  >
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Compartir</span>
                  </Button>

                  {/* 5. Delete */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setDeletingId(activeDeck.id)}
                    className="w-11 h-11 text-muted-foreground hover:text-red-400 border border-border/40 rounded-xl bg-black/20 hover:bg-destructive/20 hover:border-destructive/30 shrink-0"
                    title="Eliminar Mazo"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Create Deck Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create New Deck</DialogTitle>
            <DialogDescription>Start from scratch or copy an existing deck.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Select value={createDeckSource} onValueChange={(val) => setCreateDeckSource(val || "new")}>
              <SelectTrigger>
                <SelectValue placeholder="Select starting point" />
              </SelectTrigger>
              <SelectContent className="max-h-64 custom-scrollbar">
                <SelectItem value="new">Create New Deck</SelectItem>
                {decks.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Copy from: {d.deckName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (createDeckSource === "new") {
                  dispatch({ type: "CREATE_DECK", id: `deck-${Date.now()}` });
                } else {
                  dispatch({
                    type: "DUPLICATE_DECK",
                    deckId: createDeckSource,
                    newDeckId: `deck-${Date.now()}`,
                  });
                }
                setIsCreateModalOpen(false);
              }}
            >
              Create Deck
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
