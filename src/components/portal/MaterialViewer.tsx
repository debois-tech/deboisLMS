import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, ShieldAlert, X } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getWatermarkedMaterialUrl } from '@/lib/supabase';
import { useTheme } from '@/lib/context/ThemeContext';
import type { Material } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface MaterialViewerProps {
  material: Material | null;
  onClose: () => void;
}

/**
 * Read-only reader for one material.
 *
 * What this actually guarantees: the browser never receives a downloadable file
 * handle — pages are rasterised to canvas and the blob URL is revoked as soon as
 * rendering finishes — and every page carries the reader's name and phone, burned
 * in server-side by the `watermark-material` function.
 *
 * What it cannot do: stop a screenshot or a screen recording. No browser API can.
 * The measures below (no context menu, no print, blank on tab-switch) raise the
 * effort; the watermark is what actually deters, because a leaked capture names
 * the person who took it.
 */
export function MaterialViewer(props: MaterialViewerProps) {
  return <MaterialViewerBody key={props.material?.id ?? 'closed'} {...props} />;
}

function MaterialViewerBody({ material, onClose }: MaterialViewerProps) {
  const { theme } = useTheme();
  const pagesRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [loading, setLoading] = useState(Boolean(material));
  const [error, setError] = useState('');
  // Blanked while the tab is in the background, which is what a naive screen
  // share or a switch to a recording app looks like from in here.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!material) return;

    let cancelled = false;
    let blobUrl = '';
    let doc: pdfjs.PDFDocumentProxy | null = null;

    (async () => {
      try {
        blobUrl = await getWatermarkedMaterialUrl(material.id);
        doc = await pdfjs.getDocument({ url: blobUrl }).promise;
        if (cancelled) return;

        const container = pagesRef.current;
        if (!container) return;
        container.replaceChildren();

        // Render at the device pixel ratio so text stays sharp on phones, but cap
        // it — a 3x ratio on a 40-page PDF is a lot of canvas memory.
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const targetWidth = container.clientWidth;

        /*
         * Pages are laid out immediately at their real size but drawn only as they
         * approach the viewport. Rendering all of them up front held a
         * full-resolution canvas per page — on a 40-page deck that is enough
         * memory to be a problem on a mid-range phone, and nothing appeared until
         * the whole loop finished.
         *
         * The placeholder carries the page's aspect ratio, so the scrollbar is
         * honest from the start and nothing jumps as pages fill in.
         */
        const drawPage = async (slot: HTMLElement, pageNumber: number) => {
          if (cancelled || !doc) return;
          const page = await doc.getPage(pageNumber);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (targetWidth / base.width) * ratio });

          const canvas = document.createElement('canvas');
          canvas.className = 'material-page';
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const context = canvas.getContext('2d');
          if (!context) return;

          await page.render({ canvasContext: context, viewport }).promise;
          if (cancelled) return;
          slot.replaceChildren(canvas);
          slot.classList.add('is-drawn');
        };

        const first = await doc.getPage(1);
        const firstViewport = first.getViewport({ scale: 1 });
        const aspect = firstViewport.height / firstViewport.width;

        const slots: HTMLElement[] = [];
        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
          const slot = document.createElement('div');
          slot.className = 'material-page-slot';
          slot.style.aspectRatio = `1 / ${aspect}`;
          slot.dataset.page = String(pageNumber);
          container.append(slot);
          slots.push(slot);
        }

        // `rootMargin` starts the render a screen early, so scrolling at a normal
        // pace never catches up with a blank page.
        observerRef.current = new IntersectionObserver(
          (entries, observer) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const slot = entry.target as HTMLElement;
              observer.unobserve(slot);
              void drawPage(slot, Number(slot.dataset.page));
            }
          },
          { root: container.parentElement, rootMargin: '150% 0px' },
        );

        slots.forEach((slot) => observerRef.current?.observe(slot));

        // The first page is drawn directly rather than waiting for the observer,
        // so something is on screen the moment loading ends.
        await drawPage(slots[0], 1);
        observerRef.current.unobserve(slots[0]);

        if (cancelled) return;
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err, 'Could not open this material.'));
        setLoading(false);
      } finally {
        // Revoked as soon as the pages are drawn: after this the document exists
        // only as pixels, with no URL left to save or share.
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      }
    })();

    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      doc?.destroy();
    };
  }, [material]);

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
    // Ctrl/Cmd+P and PrintScreen: block what we can, blank for the rest.
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault();
    }
    if (event.key === 'PrintScreen') {
      setHidden(true);
      setTimeout(() => setHidden(false), 1200);
    }
  }, [onClose]);

  useEffect(() => {
    if (!material) return;
    const onVisibility = () => setHidden(document.hidden);
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);

    document.addEventListener('keydown', handleKey);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.body.style.overflow = '';
    };
  }, [material, handleKey]);

  if (!material) return null;

  /*
   * Rendered into <body>, not in place. `position: fixed` resolves against the
   * nearest ancestor with a transform, filter or containment — and both shells
   * wrap their content in `.animate-fade-in`, whose `forwards` fill leaves a
   * settled `transform` behind. In place, the reader sized itself to that
   * wrapper instead of the viewport and clipped the pages to a strip.
   */
  return createPortal(
    <div className="material-viewer" role="dialog" aria-modal="true" aria-label={material.title}>
      <header className="material-viewer-bar">
        <img
          src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'}
          alt="Deboistech"
          className="material-viewer-logo"
        />
        <p className="material-viewer-title">{material.title}</p>
        <button type="button" onClick={onClose} className="material-viewer-close" aria-label="Close">
          <X size={18} />
        </button>
      </header>

      <div
        className="material-viewer-body"
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
      >
        {loading && (
          <p className="material-viewer-status">
            <Loader2 size={16} className="animate-spin" />
            Preparing your copy
          </p>
        )}
        {error && (
          <p className="material-viewer-status is-error">
            <ShieldAlert size={16} />
            {error}
          </p>
        )}
        <div ref={pagesRef} className="material-pages" />
        {!loading && !error && (
          <p className="material-viewer-note">
            This copy is marked with your name and phone number.
          </p>
        )}
      </div>

      {hidden && <div className="material-viewer-shield">Paused</div>}
    </div>,
    document.body,
  );
}
