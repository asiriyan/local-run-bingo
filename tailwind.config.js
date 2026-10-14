/**
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [
    "./www/**/*.{html,js}"   // includes all .html and .js files in www and subfolders
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        'space-grotesk': ['Space Grotesk', 'sans-serif'],
        'jetbrains-mono': ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          purple: '#7c3aed',
          pink: '#ec4899',
          gold: '#f59e0b',
        },
        universe: {
          bg: '#050816',
          bg2: '#0a0e27',
          bg3: '#0d1129',
          primary: '#6366f1',
          primaryDark: '#4f46e5',
          accent: '#ec4899',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
        dashboard: {
          dark: {
            bg: '#0a0e13',
            bgElev: '#0e131a',
            panel: '#141b24',
            panel2: '#1e2733',
            border: '#2e3946',
            borderSoft: '#212a35',
            text: '#f6f9fc',
            textDim: '#b9c3d1',
            textFaint: '#8c97a6',
            accent: '#ffc35c',
            accentSoft: 'rgba(255,195,92,.16)',
            teal: '#3fe6a8',
            tealSoft: 'rgba(63,230,168,.14)',
            blue: '#84a2ff',
            blueSoft: 'rgba(132,162,255,.16)',
            danger: '#ff6f6b',
            dangerSoft: 'rgba(255,111,107,.14)',
            onAccent: '#1a1305',
          },
          light: {
            bg: '#eef1f5',
            bgElev: '#ffffff',
            panel: '#ffffff',
            panel2: '#f1f4f8',
            border: '#dbe1e9',
            borderSoft: '#e6eaf0',
            text: '#12161d',
            textDim: '#3f4854',
            textFaint: '#5f6976',
            accent: '#b3690a',
            accentSoft: 'rgba(179,105,10,.12)',
            teal: '#0d8f66',
            tealSoft: 'rgba(13,143,102,.1)',
            blue: '#3050d8',
            blueSoft: 'rgba(48,80,216,.1)',
            danger: '#c9302c',
            dangerSoft: 'rgba(201,48,44,.1)',
            onAccent: '#fff8ec',
          },
        },
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'bounce-call': 'bounceCall 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'nebula-drift': 'nebulaDrift 25s ease-in-out infinite',
        'card-shine': 'cardShine 5.5s ease-in-out infinite',
        'live-pulse': 'livePulse 1.6s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        bounceCall: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '40%': { transform: 'scale(1.3)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(124,58,237,0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(124,58,237,0.6)' },
        },
        nebulaDrift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(40px, -30px) scale(1.1)' },
          '66%': { transform: 'translate(-30px, 40px) scale(0.95)' },
        },
        cardShine: {
          '0%, 100%': { transform: 'rotate(18deg)', opacity: '0.3' },
          '50%': { opacity: '0.3' },
        },
        livePulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      backgroundImage: {
        'gradient-universe': 'linear-gradient(135deg, #050816 0%, #0a0e27 50%, #0d1129 100%)',
        'gradient-purple': 'linear-gradient(135deg, #7c3aed, #5b21b6)',
        'gradient-gold': 'linear-gradient(135deg, #f59e0b, #b45309)',
        'gradient-green': 'linear-gradient(135deg, #10b981, #047857)',
        'gradient-blue': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        'gradient-pink': 'linear-gradient(135deg, #ec4899, #be185d)',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0,0,0,0.1)',
        'glass-dark': '0 8px 32px rgba(0,0,0,0.5)',
        'card': '0 4px 18px rgba(0,0,0,0.22)',
        'card-hover': '0 10px 26px rgba(0,0,0,0.32)',
      },
      backdropBlur: {
        'glass': '16px',
      },
      borderRadius: {
        'app': '0.65rem',
        'app-sm': '0.5rem',
      },
      spacing: {
        '0.5': '0.125rem',
        '1.5': '0.375rem',
        '2.5': '0.625rem',
      },
    },
  },
  plugins: [],
}
