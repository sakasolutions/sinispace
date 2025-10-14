// app/api/auth/logout/route.ts
import { NextResponse, NextRequest } from 'next/server';

function baseDomain(hostname: string) {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length >= 2) return `.${parts.slice(-2).join('.')}`;
  return hostname; // z.B. localhost
}

export async function POST(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost';
  const root = baseDomain(host);

  // Pfade erweitern, falls du z.B. /app etc. nutzt
  const paths = ['/', '/api', '/chat', '/login'];
  // Domain-Varianten
  const domains: (string | undefined)[] = [undefined, host, root];

  // Falls du feste Cookie-Namen hast, trage sie hier ein
  const names = [
    'session', 'app_session', 'ss_session', 'token', '__session',
    'next-auth.session-token', '__Secure-next-auth.session-token',
    'firebaseToken',
  ];

  const res = new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Safari-Caches ausschalten
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      pragma: 'no-cache',
      expires: '0',
    },
  });

  // 1) bekannte Namen pro Domain/Path killen
  for (const name of names) {
    // __Host- Cookies: KEINE Domain erlaubt, path MUSS '/'
    if (name.startsWith('__Host-')) {
      res.headers.append(
        'set-cookie',
        `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
      );
      continue;
    }
    for (const p of paths) {
      for (const d of domains) {
        res.headers.append(
          'set-cookie',
          `${name}=; Path=${p}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly;` +
            ` Secure; SameSite=Lax${d ? `; Domain=${d}` : ''}`
        );
      }
    }
  }

  // 2) Sicherheitsnetz: ALLE vorhandenen Cookies noch mal generisch löschen
  //    (falls Namen unbekannt). Wir kennen hier die echten Flags nicht,
  //    aber wir decken die üblichen Varianten ab:
  const cookieHeader = req.headers.get('cookie') || '';
  const existing = cookieHeader
    .split(';')
    .map((s) => s.trim().split('=')[0])
    .filter(Boolean);

  for (const name of existing) {
    if (names.includes(name)) continue; // schon behandelt
    for (const p of paths) {
      for (const d of domains) {
        res.headers.append(
          'set-cookie',
          `${name}=; Path=${p}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly;` +
            ` Secure; SameSite=Lax${d ? `; Domain=${d}` : ''}`
        );
      }
    }
  }

  return res;
}
