/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createTheme } from '@mui/material/styles';

export const appTheme = createTheme({
  palette: {
    primary: {
      main: '#8F4E00', // Warm medium brown/cooked caramel
      light: '#FFDCC0', // Soft peach/apricot background
      dark: '#51443B',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#83746B', // Soft grey-brown neutral
      light: '#F0E0D6', // Light warm tan border
      dark: '#311300', // Extra dark highlight
      contrastText: '#ffffff',
    },
    background: {
      default: '#FEF7F3', // Soft warm peach/apricot tinted off-white
      paper: '#ffffff',
    },
    text: {
      primary: '#201A17', // Rich deep charcoal/brown tint
      secondary: '#83746B', // Soft dark terracotta gray from design
    },
    error: {
      main: '#ba1a1a',
    },
    warning: {
      main: '#f1a80a',
    },
    success: {
      main: '#386a20',
    },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontWeight: 800,
      letterSpacing: '-0.025em',
      color: '#201A17',
    },
    h2: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      color: '#201A17',
    },
    h3: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontWeight: 750,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
    },
    h5: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 600,
    },
    body1: {
      fontSize: '0.975rem',
      lineHeight: 1.6,
    },
    button: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 16, // Clean modern card and element corners
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 100, // Pill-shaped buttons are still fine
          padding: '10px 24px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(143,78,0,0.15)',
          },
        },
        contained: {
          '&:hover': {
            backgroundColor: '#a35c02',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16, // Clean 16px card corners
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          border: '1px solid #F0E0D6', // Clean warm tan border
          overflow: 'hidden',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16, // Clean 16px dialog paper corners
          padding: '12px',
          backgroundImage: 'none',
          border: '1px solid #F0E0D6',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12, // Subtle 12px input corners
            '& fieldset': {
              borderColor: '#F0E0D6',
            },
            '&:hover fieldset': {
              borderColor: '#83746B',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#8F4E00',
            },
          },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: '#F7EFE8', // soft warm beige from navigation design
          borderTop: '1px solid #F0E0D6',
          height: 72,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          paddingTop: 14,
          paddingBottom: 14,
          color: '#51443B',
          '&.Mui-selected': {
            color: '#8F4E00',
            fontWeight: 700,
          },
        },
        label: {
          fontSize: '0.75rem',
          '&.Mui-selected': {
            fontSize: '0.8rem',
            fontWeight: 800,
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          borderRadius: 16, // Squircle 16px border-radius
          backgroundColor: '#FFDCC0',
          color: '#311300',
          boxShadow: '0 4px 12px rgba(143,78,0,0.2)',
          '&:hover': {
            backgroundColor: '#f7cbb1',
          },
        },
      },
    },
  },
});
