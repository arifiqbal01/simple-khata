/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],

  presets: [require('nativewind/preset')],

  theme: {
    extend: {
      colors: {
        // Base
        background: '#F7F7F5',
        surface: '#FFFFFF',

        // Text
        foreground: '#181816',
        muted: '#777770',
        subtle: '#9A9A93',
        inverse: '#FFFFFF',

        // Borders
        border: '#E7E7E2',
        'border-strong': '#D8D8D2',

        // Primary actions
        primary: '#242422',
        'primary-pressed': '#3A3A37',

        // Ledger semantics
        udhaar: '#D9544D',
        'udhaar-soft': '#FCEDEC',

        payment: '#16835D',
        'payment-soft': '#EAF6F0',

        // Controls
        chip: '#EFEFEB',
        'input-background': '#F1F1EE',

        // Disabled
        disabled: '#C8C8C2',
        'disabled-foreground': '#8F8F89',
      },

      fontFamily: {
          sans: ['SplineSans_400Regular'],
          display: ['SplineSans_400Regular'],

          medium: ['SplineSans_500Medium'],
          semibold: ['SplineSans_600SemiBold'],
          bold: ['SplineSans_700Bold'],
        },

      fontSize: {
        caption: ['12px', '16px'],
        small: ['14px', '20px'],
        body: ['16px', '22px'],
        money: ['17px', '22px'],
        heading: ['20px', '26px'],
        title: ['28px', '34px'],
        'money-lg': ['32px', '38px'],
        display: ['36px', '42px'],
      },

      borderRadius: {
        control: '12px',
        card: '16px',
        large: '20px',
      },

      spacing: {
        18: '72px',
      },
    },
  },

  plugins: [],
};