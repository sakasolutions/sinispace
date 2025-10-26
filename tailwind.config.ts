// tailwind.config.ts
import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';
import defaultTheme from 'tailwindcss/defaultTheme'; // Import defaultTheme

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Set Inter as the default sans-serif font
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      // Your existing typography settings remain unchanged
      typography: ({ theme }) => ({
        invert: {
          css: {
            '--tw-prose-body': theme('colors.white / 0.85'),
            '--tw-prose-headings': theme('colors.white'),
            '--tw-prose-links': theme('colors.indigo.300'),
            '--tw-prose-bold': theme('colors.white'),
            '--tw-prose-hr': theme('colors.white / 0.1'),
            '--tw-prose-quotes': theme('colors.white'),
            '--tw-prose-code': theme('colors.white'),
            '--tw-prose-th-borders': theme('colors.white / 0.15'),
            '--tw-prose-td-borders': theme('colors.white / 0.1'),
          },
        },
        DEFAULT: {
          css: {
            p: { marginTop: '0.6em', marginBottom: '0.6em', lineHeight: '1.7' },
            h1: { fontWeight: '700', fontSize: '1.35rem', margin: '0.6em 0 0.4em' },
            h2: { fontWeight: '700', fontSize: '1.15rem', margin: '1em 0 0.4em' },
            h3: { fontWeight: '600', fontSize: '1rem',  margin: '0.8em 0 0.3em' },
            'ul,ol': { margin: '0.4em 0 0.8em' },
            li: { margin: '0.2em 0' },
            code: { fontWeight: '600', padding: '0.15rem 0.35rem', borderRadius: '0.4rem' },
            pre: { padding: 0, background: 'transparent' }, // we style Pre externally
            table: { fontSize: '0.95rem' },
            'thead th': { fontWeight: '600' },
          },
        },
      }),
    },
  },
  plugins: [typography],
};
export default config;