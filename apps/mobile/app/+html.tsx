import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Customizes the root HTML document for web (both `expo start --web` and static export) —
// see https://docs.expo.dev/router/reference/static-rendering/#root-html. This is the only
// place PWA installability metadata (manifest, icons, theme color, service worker
// registration) can be added; it doesn't touch anything inside the actual app.
export default function Root({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no, viewport-fit=cover, user-scalable=no"
        />
        <title>Gadha Chor</title>

        {/* PWA installability: manifest + icons + theme color. */}
        <link href="/manifest.json" rel="manifest" />
        <link href="/favicon.png" rel="icon" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" />
        <meta content="#3B2A1E" name="theme-color" />

        {/* Once installed (Add to Home Screen), these are what actually drop the address
            bar and status bar chrome on Android/iOS — the manifest's "display": "standalone"
            covers Android Chrome, these meta tags cover iOS Safari's equivalent. */}
        <meta content="yes" name="mobile-web-app-capable" />
        <meta content="yes" name="apple-mobile-web-app-capable" />
        <meta content="black-translucent" name="apple-mobile-web-app-status-bar-style" />
        <meta content="Gadha Chor" name="apple-mobile-web-app-title" />

        <ScrollViewStyleReset />

        {/* A fetch-handling service worker is one of Chrome's installability requirements.
            Registered here (not inside the app) since it must exist before the first paint
            and has nothing to do with any game logic. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); }); }`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
