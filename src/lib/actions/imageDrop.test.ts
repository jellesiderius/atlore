import { describe, expect, it, vi } from 'vitest';
import { IMAGE_ACCEPT, imageDropzone } from './imageDrop';

function dragEvent(type: string, files: File[]) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { types: ['Files'], files, dropEffect: 'none' }
  });
  return event;
}

describe('imageDropzone', () => {
  it('accepteert ondersteunde afbeeldingen en ruimt de dragstatus op', () => {
    const element = document.createElement('div');
    const onFile = vi.fn();
    imageDropzone(element, { enabled: true, onFile });
    const file = new File(['image'], 'kaart.png', { type: 'image/png' });

    element.dispatchEvent(dragEvent('dragenter', [file]));
    expect(element.dataset.imageDragging).toBe('true');

    const dropped = dragEvent('drop', [file]);
    element.dispatchEvent(dropped);
    expect(dropped.defaultPrevented).toBe(true);
    expect(onFile).toHaveBeenCalledWith(file);
    expect(element.dataset.imageDragging).toBeUndefined();
  });

  it('weigert andere bestandstypen en laat interne node-drags ongemoeid', () => {
    const element = document.createElement('div');
    const onFile = vi.fn();
    const onInvalid = vi.fn();
    imageDropzone(element, { enabled: true, onFile, onInvalid });

    element.dispatchEvent(
      dragEvent('drop', [new File(['text'], 'notitie.txt', { type: 'text/plain' })])
    );
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(onFile).not.toHaveBeenCalled();

    const nodeDrag = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(nodeDrag, 'dataTransfer', {
      value: { types: ['application/x-atlore-node'], files: [], dropEffect: 'none' }
    });
    element.dispatchEvent(nodeDrag);
    expect(nodeDrag.defaultPrevented).toBe(false);
  });

  it('deelt dezelfde acceptlijst met alle file inputs', () => {
    expect(IMAGE_ACCEPT).toBe('image/jpeg,image/png,image/webp,image/gif');
  });
});
