type TooltipOptions = string | { label: string; delay?: number };

let nextId = 0;

export function tooltip(node: HTMLElement, options: TooltipOptions) {
  let config = normalize(options);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let layer: HTMLDivElement | undefined;
  const id = `atlore-tooltip-${++nextId}`;

  function show(immediate = false) {
    if (!config.label || matchMedia('(hover: none)').matches) return;
    clearTimeout(timer);
    timer = setTimeout(
      () => {
        hide();
        layer = document.createElement('div');
        layer.id = id;
        layer.className = 'atlore-tooltip';
        layer.role = 'tooltip';
        layer.textContent = config.label;
        document.body.append(layer);
        node.setAttribute('aria-describedby', id);
        position();
      },
      immediate ? 0 : config.delay
    );
  }

  function position() {
    if (!layer) return;
    const anchor = node.getBoundingClientRect();
    const tip = layer.getBoundingClientRect();
    let left = anchor.right + 9;
    if (left + tip.width > innerWidth - 8) left = anchor.left - tip.width - 9;
    let top = anchor.top + anchor.height / 2 - tip.height / 2;
    top = Math.max(8, Math.min(innerHeight - tip.height - 8, top));
    layer.style.left = `${Math.round(left)}px`;
    layer.style.top = `${Math.round(top)}px`;
  }

  function hide() {
    clearTimeout(timer);
    layer?.remove();
    layer = undefined;
    if (node.getAttribute('aria-describedby') === id) node.removeAttribute('aria-describedby');
  }

  const enter = () => show();
  const focus = () => show(true);
  node.addEventListener('pointerenter', enter);
  node.addEventListener('pointerleave', hide);
  node.addEventListener('focus', focus);
  node.addEventListener('blur', hide);
  window.addEventListener('resize', hide);
  window.addEventListener('scroll', hide, true);

  return {
    update(value: TooltipOptions) {
      config = normalize(value);
      if (layer) {
        layer.textContent = config.label;
        position();
      }
    },
    destroy() {
      hide();
      node.removeEventListener('pointerenter', enter);
      node.removeEventListener('pointerleave', hide);
      node.removeEventListener('focus', focus);
      node.removeEventListener('blur', hide);
      window.removeEventListener('resize', hide);
      window.removeEventListener('scroll', hide, true);
    }
  };
}

function normalize(options: TooltipOptions) {
  return typeof options === 'string'
    ? { label: options, delay: 240 }
    : { label: options.label, delay: options.delay ?? 240 };
}
