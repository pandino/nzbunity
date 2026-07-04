import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.animetosho.xyz/*'],
  main(ctx) {
    new AnimeToshoXyzContent(ctx);
  },
});

class AnimeToshoXyzContent extends Content {
  get id() {
    return 'animetoshoxyz';
  }

  getNzbName(href: string): string {
    const parsed = new URL(href);
    const raw = parsed.searchParams.get('filename') ?? parsed.pathname.split('/').pop() ?? '';
    return decodeURIComponent(raw).replace(/\.nzb(\.gz)?$/, '');
  }

  initializeLinks = () => {
    for (const el of document.querySelectorAll('a[href*="storage.animetosho.xyz"][href*="/nzb/"]')) {
      const a = el as HTMLAnchorElement;
      const name = this.getNzbName(a.href);

      const link = this.createLink({
        styles: {
          margin: '0 0 0 3px',
          'vertical-align': 'middle',
        },
      });
      link.setAttribute('href', a.href);

      link.addEventListener('click', async (event) => {
        event.preventDefault();
        link.dispatchEvent(new Event('nzb.pending'));
        const res = await browser.runtime.sendMessage({
          fetchAndAddFile: { url: a.href, filename: name },
        });
        this.ctx.setTimeout(() => {
          link.dispatchEvent(new Event(res?.success ? 'nzb.success' : 'nzb.failure'));
        }, 500);
      }, false);

      if (this.replaceLinks) {
        a.replaceWith(link);
      } else {
        a.insertAdjacentElement('afterend', link);
      }
    }
  };
}
