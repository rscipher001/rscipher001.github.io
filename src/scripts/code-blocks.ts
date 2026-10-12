// Adds a copy button to every code block. Without JavaScript the blocks are still plain, readable code.
export function setUpCodeBlocks() {
  if (!navigator.clipboard) return;
  for (const block of document.querySelectorAll<HTMLElement>('.code-block')) {
    const code = block.querySelector('pre');
    if (!code) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-block__copy';
    button.textContent = 'Copy';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.innerText.replace(/\n$/, ''));
        button.textContent = 'Copied';
        button.dataset.copied = '';
      } catch {
        button.textContent = 'Copy failed';
      }
      setTimeout(() => {
        button.textContent = 'Copy';
        delete button.dataset.copied;
      }, 1800);
    });
    block.append(button);
  }
}
