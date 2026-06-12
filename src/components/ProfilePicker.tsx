/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import { Plus, ChefHat } from 'lucide-react';
import { MealDatabase } from '../lib/db';
import { Member } from '../types';

interface ProfilePickerProps {
  onSelectProfile: (name: string) => void;
  activeProfile: string | null;
}

// Preset pastel theme colors for family members
const avatarColors = [
  '#8F4E00', // Warm Bronze/Amber
  '#5a7862', // Sage Green
  '#f28f3b', // Muted Apricot
  '#9b59b6', // Amethyst Berry
  '#3498db', // Light Steel Blue
  '#1abc9c', // Teal Blue
  '#e67e22', // Deep Orange
];

export const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
};

export default function ProfilePicker({ onSelectProfile, activeProfile }: ProfilePickerProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    // Subscribe to database profiles in real-time
    const unsubscribe = MealDatabase.subscribeMembers((fetchedMembers) => {
      setMembers(fetchedMembers);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateMember = async () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) {
      setErrorText('Naam mag niet leeg zijn');
      return;
    }
    if (trimmed.length > 20) {
      setErrorText('Naam is te lang (max 20 tekens)');
      return;
    }
    if (members.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorText('Dit familielid bestaat al!');
      return;
    }

    setLoading(true);
    await MealDatabase.addMember(trimmed);
    setNewMemberName('');
    setErrorText('');
    setOpenAddDialog(false);
    setLoading(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        py: 6,
        background: '#FEF7F3', // Soft warm minimal backdrop
      }}
    >
      <Card
        sx={{
          maxWidth: 480,
          width: '100%',
          p: { xs: 2, sm: 4 },
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          border: '1px solid #F0E0D6',
        }}
      >
        <CardContent>
          {/* Decorative Logo Icon */}
          <Box
            sx={{
              display: 'inline-flex',
              p: 2,
              borderRadius: '24px',
              backgroundColor: '#FFDCC0',
              color: '#8F4E00',
              mb: 3,
            }}
          >
            <ChefHat size={44} strokeWidth={1.5} />
          </Box>

          <Typography variant="h4" sx={{ mb: 1, fontWeight: 800 }}>
            Wat Eten We?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Welkom! Wie schuift er vandaag gezellig aan aan de familietafel?
          </Typography>

          {loading ? (
            <Box sx={{ py: 4 }}>
              <CircularProgress size={40} thickness={4} color="primary" />
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                gap: 2,
                mb: 4,
                justifyContent: 'center',
              }}
            >
              {members.map((member) => (
                <Box
                  key={member.id}
                  onClick={() => onSelectProfile(member.name)}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 2,
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    border: activeProfile === member.name 
                      ? '2px solid #8F4E00' 
                      : '2px solid transparent',
                    backgroundColor: activeProfile === member.name 
                      ? '#FFDCC0' 
                      : 'transparent',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      backgroundColor: '#FFDCC0',
                      opacity: 0.9,
                      border: activeProfile === member.name 
                        ? '2px solid #8F4E00' 
                        : '2px solid #F0E0D6',
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      width: 64,
                      height: 64,
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      backgroundColor: getAvatarColor(member.name),
                      mb: 1.5,
                      boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
                    }}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 600,
                      color: activeProfile === member.name ? '#311300' : 'text.primary'
                    }}
                  >
                    {member.name}
                  </Typography>
                </Box>
              ))}

              {/* Add Member Button Box */}
              <Box
                onClick={() => setOpenAddDialog(true)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  p: 2,
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '2px dashed #F0E0D6',
                  backgroundColor: 'transparent',
                  '&:hover': {
                    backgroundColor: '#FFDCC0',
                    borderColor: '#8F4E00',
                  },
                }}
              >
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    backgroundColor: 'transparent',
                    color: '#8F4E00',
                    border: '2px dashed #8F4E00',
                    mb: 1.5,
                  }}
                >
                  <Plus size={28} />
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  Lid Toevoegen
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => {
          setOpenAddDialog(false);
          setErrorText('');
          setNewMemberName('');
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Familielid toevoegen</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Vul de naam in van het nieuwe lid dat aan de familietafel van "Wat Eten We?" schuift.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Naam"
            type="text"
            fullWidth
            variant="outlined"
            value={newMemberName}
            onChange={(e) => {
              if (e.target.value.length <= 20) {
                setNewMemberName(e.target.value);
                setErrorText('');
              }
            }}
            error={!!errorText}
            helperText={errorText}
            placeholder="Bijv. Opa, Kleine Bas..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => {
              setOpenAddDialog(false);
              setErrorText('');
              setNewMemberName('');
            }}
            variant="text"
            sx={{ color: 'text.secondary' }}
          >
            Annuleren
          </Button>
          <Button onClick={handleCreateMember} variant="contained" disabled={loading}>
            Toevoegen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
