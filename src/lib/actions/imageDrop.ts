import type { Action } from 'svelte/action';

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(',');

export type ImageDropOptions = {
  enabled: boolean;
  onFile: (file: File) => void | Promise<void>;
  onInvalid?: () => void;
};

function hasFiles(transfer: DataTransfer | null): boolean {
  if (!transfer) return false;
  if (transfer.files.length > 0) return true;
  if (transfer.items && Array.from(transfer.items).some((item) => item.kind === 'file'))
    return true;
  return Array.from(transfer.types).some((type) => type.toLowerCase() === 'files');
}

function supportedImage(files: FileList | File[]): File | undefined {
  return Array.from(files).find((file) =>
    IMAGE_MIME_TYPES.includes(file.type as (typeof IMAGE_MIME_TYPES)[number])
  );
}

export const imageDropzone: Action<HTMLElement, ImageDropOptions> = (element, initialOptions) => {
  let options = initialOptions;
  let depth = 0;

  const clear = () => {
    depth = 0;
    delete element.dataset.imageDragging;
  };

  const enter = (event: DragEvent) => {
    if (!options.enabled || !hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    depth += 1;
    element.dataset.imageDragging = 'true';
  };

  const over = (event: DragEvent) => {
    if (!options.enabled || !hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    element.dataset.imageDragging = 'true';
  };

  const leave = (event: DragEvent) => {
    if (!options.enabled || !hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    depth = Math.max(0, depth - 1);
    if (!depth) clear();
  };

  const drop = (event: DragEvent) => {
    if (!options.enabled || !hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    const file = supportedImage(event.dataTransfer?.files ?? []);
    clear();
    if (file) void options.onFile(file);
    else options.onInvalid?.();
  };

  element.addEventListener('dragenter', enter);
  element.addEventListener('dragover', over);
  element.addEventListener('dragleave', leave);
  element.addEventListener('drop', drop);

  return {
    update(nextOptions) {
      options = nextOptions;
      if (!options.enabled) clear();
    },
    destroy() {
      clear();
      element.removeEventListener('dragenter', enter);
      element.removeEventListener('dragover', over);
      element.removeEventListener('dragleave', leave);
      element.removeEventListener('drop', drop);
    }
  };
};
