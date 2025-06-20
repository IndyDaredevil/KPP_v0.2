/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: '#70C7BA40', // Kaspa green with opacity
        background: '#0A2540', // Kaspa dark blue
        foreground: '#FFFFFF', // White text
        ring: '#70C7BA', // Kaspa primary green
        'card-foreground': '#FFFFFF', // White text on cards
        
        // Kaspa Brand Colors
        kaspa: {
          primary: {
            green: '#70C7BA',
            dark: '#231F20',
            gray: '#B6B6B6',
          },
          secondary: {
            green: '#49EACB',
            'green-light': '#7FE6D5',
          },
          accent: {
            teal: '#5FB3A6',
            'dark-blue': '#0A2540',
            'medium-blue': '#1A3550',
            'light-blue': '#2A4560',
          }
        },
        
        // Updated primary colors to use Kaspa green
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#70C7BA', // Kaspa primary green
          600: '#5FB3A6', // Darker Kaspa green
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        
        // Keep existing grays but add Kaspa variants
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#231F20', // Kaspa dark
        }
      },
      fontFamily: {
        // Kaspa Brand Typography
        'kaspa-header': ['Rubik', 'system-ui', 'sans-serif'], // Headers
        'kaspa-subheader': ['Oswald', 'system-ui', 'sans-serif'], // Sub-headers
        'kaspa-body': ['Lato', 'system-ui', 'sans-serif'], // Body text
        sans: ['Lato', 'Rubik', 'Inter', 'system-ui', 'sans-serif'], // Default with Kaspa fonts first
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        'kaspa-glow': 'kaspaGlow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        kaspaGlow: {
          '0%': { boxShadow: '0 0 5px #70C7BA' },
          '100%': { boxShadow: '0 0 20px #70C7BA, 0 0 30px #49EACB' },
        },
      },
      // Add dark mode variants
      screens: {
        'dark': {'raw': '(prefers-color-scheme: dark)'},
        'light': {'raw': '(prefers-color-scheme: light)'},
      },
    },
  },
  plugins: [],
  // Enable dark mode based on system preference
  darkMode: 'media',
}