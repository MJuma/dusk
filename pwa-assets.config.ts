import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const background = '#101216';

// The source icon is a full-bleed square whose artwork already sits inside the maskable safe
// zone, so no extra padding: iOS and Android crop it with their own rounded masks. Padding (or
// transparent corners) shows up as a white border around the icon on the iOS home screen.
export default defineConfig({
    headLinkOptions: {
        preset: '2023',
    },
    preset: {
        ...minimal2023Preset,
        transparent: { ...minimal2023Preset.transparent, padding: 0 },
        maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background } },
        apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
    },
    images: ['public/favicon.svg'],
});
