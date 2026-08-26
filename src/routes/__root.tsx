import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Matchday — Football scores & fixtures' },
      {
        name: 'description',
        content: 'Football scores and fixtures, built for people and their agents.',
      },
      { property: 'og:title', content: 'Matchday — Football scores & fixtures' },
      { property: 'og:description', content: 'Every match. Every level. One question away.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Matchday — Football scores & fixtures' },
      { name: 'twitter:description', content: 'Every match. Every level. One question away.' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: Outlet,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
