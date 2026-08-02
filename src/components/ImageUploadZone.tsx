import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Image as ImageIcon, X, RefreshCw, AlertCircle, Camera, CheckCircle2
} from 'lucide-react';

interface ImageUploadZoneProps {
  onImageSelected: (file: File, dataUrl: string) => void;
  onImageRemoved: () => void;
  selectedFile: File | null;
  previewUrl: string | null;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ImageUploadZone: React.FC<ImageUploadZoneProps> = ({
  onImageSelected,
  onImageRemoved,
  selectedFile,
  previewUrl,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  // Validate and process a File object
  const processFile = useCallback((file: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only JPG, JPEG, and PNG images are accepted.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File is too large. Maximum size is 10 MB (your file: ${formatBytes(file.size)}).`);
      return;
    }

    setIsImageLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      onImageSelected(file, dataUrl);
      // Loading skeleton shows until the <img> onLoad fires
    };
    reader.readAsDataURL(file);
  }, [onImageSelected]);

  // Hidden input change handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // Click anywhere in the zone
  const handleZoneClick = () => {
    if (!selectedFile) {
      inputRef.current?.click();
    }
  };

  // Drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only leave if truly exiting the zone (not a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Remove image
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    setIsImageLoading(false);
    onImageRemoved();
  };

  // Replace image
  const handleReplace = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    inputRef.current?.click();
  };

  // When a new previewUrl arrives, skeleton stays until img onLoad
  useEffect(() => {
    if (!previewUrl) {
      setIsImageLoading(false);
    }
  }, [previewUrl]);

  const hasImage = !!selectedFile && !!previewUrl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Hidden file input — accept images, enable camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleInputChange}
        aria-label="Upload infrastructure photo"
      />

      {/* ─── Upload Zone ─── */}
      <motion.div
        onClick={hasImage ? undefined : handleZoneClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        whileHover={!hasImage ? { scale: 1.008 } : {}}
        animate={{
          borderColor: isDragOver
            ? 'rgba(0, 212, 255, 0.7)'
            : hasImage
            ? 'rgba(16, 185, 129, 0.35)'
            : error
            ? 'rgba(239, 68, 68, 0.45)'
            : 'rgba(0, 212, 255, 0.18)',
          background: isDragOver
            ? 'rgba(0, 212, 255, 0.07)'
            : hasImage
            ? 'rgba(16, 185, 129, 0.04)'
            : 'rgba(255,255,255,0.02)',
          boxShadow: isDragOver
            ? '0 0 0 2px rgba(0, 212, 255, 0.25), inset 0 0 40px rgba(0, 212, 255, 0.04)'
            : 'none',
        }}
        transition={{ duration: 0.2 }}
        style={{
          borderRadius: 16,
          border: '2px dashed rgba(0, 212, 255, 0.18)',
          overflow: 'hidden',
          cursor: hasImage ? 'default' : 'pointer',
          position: 'relative',
          minHeight: hasImage ? 'auto' : 220,
        }}
      >
        <AnimatePresence mode="wait">

          {/* ── State A: Empty / Drag Target ── */}
          {!hasImage && !isImageLoading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 24px',
                gap: 14,
                height: '100%',
                minHeight: 220,
              }}
            >
              {/* Animated upload icon */}
              <motion.div
                animate={isDragOver ? { scale: 1.2, y: -6 } : { scale: 1, y: 0 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: isDragOver
                    ? 'rgba(0, 212, 255, 0.16)'
                    : 'rgba(0, 212, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
              >
                {isDragOver ? (
                  <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                    <ImageIcon size={30} color="#00D4FF" />
                  </motion.div>
                ) : (
                  <Upload size={28} color="#00D4FF" strokeWidth={1.5} />
                )}
              </motion.div>

              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 600,
                  color: isDragOver ? '#00D4FF' : '#94A3B8',
                  marginBottom: 4,
                  transition: 'color 0.2s',
                }}>
                  {isDragOver ? 'Drop image here' : 'Tap to upload or drag & drop'}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#475569' }}>
                  JPG, JPEG, PNG · Max 10 MB
                </div>
              </div>

              {/* Camera / Gallery row */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  fontSize: 12,
                  color: '#64748B',
                  fontFamily: 'var(--font-body)',
                }}>
                  <Camera size={13} />
                  Camera
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  fontSize: 12,
                  color: '#64748B',
                  fontFamily: 'var(--font-body)',
                }}>
                  <ImageIcon size={13} />
                  Gallery
                </div>
              </div>
            </motion.div>
          )}

          {/* ── State B: Loading Skeleton ── */}
          {isImageLoading && !previewUrl && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ padding: 16 }}
            >
              <div style={{
                width: '100%',
                height: 220,
                borderRadius: 12,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }} />
              <style>{`
                @keyframes shimmer {
                  0% { background-position: 200% 0; }
                  100% { background-position: -200% 0; }
                }
              `}</style>
            </motion.div>
          )}

          {/* ── State C: Image Preview ── */}
          {hasImage && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3 }}
              style={{ position: 'relative' }}
            >
              {/* Skeleton overlay until img loaded */}
              {isImageLoading && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(7,11,20,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                  borderRadius: 14,
                }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <RefreshCw size={24} color="#00D4FF" />
                  </motion.div>
                </div>
              )}

              {/* Image */}
              <img
                src={previewUrl!}
                alt="Selected infrastructure photo"
                onLoad={() => setIsImageLoading(false)}
                style={{
                  width: '100%',
                  maxHeight: 300,
                  objectFit: 'cover',
                  display: 'block',
                  borderRadius: 14,
                }}
              />

              {/* Gradient overlay at bottom */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 80,
                background: 'linear-gradient(to top, rgba(7,11,20,0.92), transparent)',
                borderRadius: '0 0 14px 14px',
              }} />

              {/* File info at bottom of image */}
              <div style={{
                position: 'absolute',
                bottom: 12,
                left: 14,
                right: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <CheckCircle2 size={14} color="#10B981" />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#F8FAFC',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {selectedFile!.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94A3B8' }}>
                    {formatBytes(selectedFile!.size)} · {selectedFile!.type.split('/')[1].toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Top-right action buttons */}
              <div style={{
                position: 'absolute',
                top: 10,
                right: 10,
                display: 'flex',
                gap: 6,
              }}>
                {/* Replace */}
                <motion.button
                  onClick={handleReplace}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  title="Replace image"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(17,24,39,0.85)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#94A3B8',
                  }}
                >
                  <RefreshCw size={14} />
                </motion.button>
                {/* Remove */}
                <motion.button
                  onClick={handleRemove}
                  whileHover={{ scale: 1.08, borderColor: 'rgba(239,68,68,0.5)', color: '#EF4444' }}
                  whileTap={{ scale: 0.95 }}
                  title="Remove image"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(17,24,39,0.85)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#94A3B8',
                    transition: 'color 0.2s, border-color 0.2s',
                  }}
                >
                  <X size={14} />
                </motion.button>
              </div>

              {/* Drag-over overlay when already has image */}
              <AnimatePresence>
                {isDragOver && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0, 212, 255, 0.12)',
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 5,
                    }}
                  >
                    <div style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#00D4FF',
                    }}>
                      Drop to replace
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>

      {/* ─── Validation Error Banner ─── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: '#FCA5A5',
              lineHeight: 1.4,
            }}>
              {error}
            </div>
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748B',
                padding: 0,
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
