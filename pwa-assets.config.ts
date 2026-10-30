import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const background = '#101216';

export default defineConfig({
    headLinkOptions: {
        preset: '2023',
    },
    preset: {
        ...minimal2023Preset,
        maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
        apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
    },
    images: ['public/favicon.svg'],
});
