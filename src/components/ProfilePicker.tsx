/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  Plus, ChefHat, Smile, Heart, Star, Flame, Crown, Shield, 
  Trophy, Moon, Sun, Ghost, Music, Coffee, Pizza, Cat, Dog, Apple, Cake, User
} from 'lucide-react';
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

export const avatarIconsMap: { [key: string]: React.ComponentType<any> } = {
  smile: Smile,
  heart: Heart,
  star: Star,
  flame: Flame,
  crown: Crown,
  shield: Shield,
  trophy: Trophy,
  moon: Moon,
  sun: Sun,
  ghost: Ghost,
  music: Music,
  coffee: Coffee,
  pizza: Pizza,
  cat: Cat,
  dog: Dog,
  apple: Apple,
  cake: Cake,
  user: User,
};

export default function ProfilePicker({ onSelectProfile, activeProfile }: ProfilePickerProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [addErrorText, setAddErrorText] = useState('');

  // Password Login state
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginErrorText, setLoginErrorText] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    // Subscribe to database profiles in real-time
    const unsubscribe = MealDatabase.subscribeMembers((fetchedMembers) => {
      setMembers(fetchedMembers);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleMemberClick = (member: Member) => {
    setSelectedMember(member);
    setPasswordInput('');
    setLoginErrorText('');
    setRequires2FA(false);
    setTempToken('');
    setOtpCode('');
  };

  const handleLoginSubmit = async () => {
    if (!selectedMember) return;
    setAuthenticating(true);
    setLoginErrorText('');
    try {
      const res = await MealDatabase.loginMember(selectedMember.name, passwordInput);
      if (res.requires2FA) {
        setRequires2FA(true);
        setTempToken(res.tempToken);
        setEmailMasked(res.emailMasked || '');
        setOtpCode('');
      } else if (res.success) {
        onSelectProfile(selectedMember.name);
        setSelectedMember(null);
      } else {
        setLoginErrorText('Onjuist wachtwoord. Probeer het opnieuw.');
      }
    } catch (err: any) {
      setLoginErrorText(err.message || 'Fout bij het inloggen. Probeer het opnieuw.');
    } finally {
      setAuthenticating(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!otpCode.trim()) {
      setLoginErrorText('Voer de 6-cijferige code in.');
      return;
    }
    setAuthenticating(true);
    setLoginErrorText('');
    try {
      const res = await MealDatabase.verify2FA(tempToken, otpCode.trim());
      if (res.success && selectedMember) {
        onSelectProfile(selectedMember.name);
        setSelectedMember(null);
        setRequires2FA(false);
      } else {
        setLoginErrorText('Onjuiste of ongeldige code.');
      }
    } catch (err: any) {
      setLoginErrorText(err.message || 'Fout bij het verifiëren van de code.');
    } finally {
      setAuthenticating(false);
    }
  };

  const handleCreateMember = async () => {
    const nameTrimmed = newMemberName.trim();
    const passTrimmed = newMemberPassword.trim();
    if (!nameTrimmed) {
      setAddErrorText('Naam mag niet leeg zijn');
      return;
    }
    if (nameTrimmed.length > 20) {
      setAddErrorText('Naam is te lang (max 20 tekens)');
      return;
    }
    if (!passTrimmed) {
      setAddErrorText('Wachtwoord mag niet leeg zijn');
      return;
    }
    if (members.some(m => m.name.toLowerCase() === nameTrimmed.toLowerCase())) {
      setAddErrorText('Dit familielid bestaat al!');
      return;
    }

    setLoading(true);
    // Derive letter
    const letter = nameTrimmed.charAt(0).toUpperCase();
    // Default avatar color index derived
    const color = getAvatarColor(nameTrimmed);

    await MealDatabase.addMember(nameTrimmed, passTrimmed, color, letter, 'smile');
    setNewMemberName('');
    setNewMemberPassword('');
    setAddErrorText('');
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
              cursor: 'pointer'
            }}
          >
            <ChefHat size={44} strokeWidth={1.5} />
          </Box>

          <Typography variant="h4" sx={{ mb: 1, fontWeight: 800 }}>
            Wat Eten We?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Welkom! Wie schuift er vandaag gezellig aan? Om de familiestatistieken en instellingen te beschermen is elk lid beveiligd met een wachtwoord.
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
              {members.map((member) => {
                const IconComponent = member.avatarIcon ? avatarIconsMap[member.avatarIcon] : null;
                const bgColor = member.avatarColor || getAvatarColor(member.name);
                return (
                  <Box
                    key={member.id}
                    onClick={() => handleMemberClick(member)}
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
                        backgroundColor: bgColor,
                        color: '#ffffff',
                        mb: 1.5,
                        boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
                      }}
                    >
                      {IconComponent ? (
                        <IconComponent size={30} strokeWidth={2} />
                      ) : (
                        member.avatarLetter || member.name.charAt(0).toUpperCase()
                      )}
                    </Avatar>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 700,
                        color: activeProfile === member.name ? '#311300' : 'text.primary',
                        maxWidth: '120px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {member.name}
                    </Typography>
                  </Box>
                );
              })}

              {/* Add Member Button Box */}
              <Box
                onClick={() => {
                  setOpenAddDialog(true);
                  setNewMemberName('');
                  setNewMemberPassword('');
                  setAddErrorText('');
                }}
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
                  Lid toevoegen
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Login with Password Dialog */}
      <Dialog
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        maxWidth="xs"
        fullWidth
      >
        <Box sx={{ p: 1 }}>
        {selectedMember && (
          <>
            <DialogTitle sx={{ fontWeight: 800, pb: 0, textAlign: 'center' }}>
              Inloggen als {selectedMember.name}
            </DialogTitle>
            <DialogContent sx={{ pt: 2, textAlign: 'center' }}>
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  mx: 'auto',
                  mb: 2,
                  backgroundColor: selectedMember.avatarColor || getAvatarColor(selectedMember.name),
                  boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
                }}
              >
                {selectedMember.avatarIcon && avatarIconsMap[selectedMember.avatarIcon] ? (
                  React.createElement(avatarIconsMap[selectedMember.avatarIcon], { size: 30 })
                ) : (
                  selectedMember.avatarLetter || selectedMember.name.charAt(0).toUpperCase()
                )}
              </Avatar>

              {requires2FA ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Tweestapsverificatie is actief voor dit profiel. Voer de 6-cijferige code in die naar <strong>{emailMasked}</strong> is verzonden.
                  </Typography>

                  {loginErrorText && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                      {loginErrorText}
                    </Alert>
                  )}

                  <TextField
                    autoFocus
                    margin="dense"
                    label="6-cijferige verificatiecode"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={otpCode}
                    slotProps={{
                      htmlInput: {
                        maxLength: 6,
                        style: { textAlign: 'center', fontSize: '1.4rem', letterSpacing: '4px', fontWeight: 800 }
                      }
                    }}
                    onChange={(e) => {
                      setOtpCode(e.target.value);
                      setLoginErrorText('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleVerify2FA();
                      }
                    }}
                    placeholder="123456"
                  />
                </>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Voer je wachtwoord in om veilig toegang te krijgen tot de app.
                    <br />
                    <span style={{ fontSize: '0.75rem', color: '#8F4E00', fontWeight: 'bold' }}>
                      (Tip: Standaard wachtwoord is je naam in kleine letters, bijv. '{selectedMember.name.toLowerCase()}')
                    </span>
                  </Typography>

                  {loginErrorText && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                      {loginErrorText}
                    </Alert>
                  )}

                  <TextField
                    autoFocus
                    margin="dense"
                    label="Wachtwoord"
                    type="password"
                    fullWidth
                    variant="outlined"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setLoginErrorText('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleLoginSubmit();
                      }
                    }}
                    placeholder="Je persoonlijke wachtwoord"
                  />
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
              <Button
                onClick={() => {
                  if (requires2FA) {
                    setRequires2FA(false);
                    setOtpCode('');
                    setLoginErrorText('');
                  } else {
                    setSelectedMember(null);
                  }
                }}
                variant="text"
                sx={{ color: 'text.secondary', fontWeight: 700 }}
              >
                {requires2FA ? 'Terug' : 'Annuleren'}
              </Button>
              <Button 
                onClick={requires2FA ? handleVerify2FA : handleLoginSubmit} 
                variant="contained" 
                disabled={authenticating}
                sx={{ borderRadius: '100px', px: 3 }}
              >
                {authenticating ? (requires2FA ? 'Verifiëren...' : 'Inloggen...') : (requires2FA ? 'Verifieer code' : 'Volgende')}
              </Button>
            </DialogActions>
          </>
        )}
        </Box>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => {
          setOpenAddDialog(false);
          setAddErrorText('');
          setNewMemberName('');
          setNewMemberPassword('');
        }}
        maxWidth="xs"
        fullWidth
      >
        <Box sx={{ p: 1 }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Nieuw familielid toevoegen</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Kies een naam en stel meteen een veilig wachtwoord in om je profiel te beveiligen.
          </Typography>

          {addErrorText && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
              {addErrorText}
            </Alert>
          )}

          <TextField
            autoFocus
            margin="dense"
            label="Naam van gezinslid"
            type="text"
            fullWidth
            variant="outlined"
            value={newMemberName}
            onChange={(e) => {
              if (e.target.value.length <= 20) {
                setNewMemberName(e.target.value);
                setAddErrorText('');
              }
            }}
            placeholder="Bijv. Lucas, Opa..."
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label="Wachtwoord"
            type="password"
            fullWidth
            variant="outlined"
            value={newMemberPassword}
            onChange={(e) => {
              setNewMemberPassword(e.target.value);
              setAddErrorText('');
            }}
            placeholder="Kies een makkelijk te onthouden wachtwoord"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
          <Button
            onClick={() => {
              setOpenAddDialog(false);
              setAddErrorText('');
              setNewMemberName('');
              setNewMemberPassword('');
            }}
            variant="text"
            sx={{ color: 'text.secondary', fontWeight: 700 }}
          >
            Annuleren
          </Button>
          <Button 
            onClick={handleCreateMember} 
            variant="contained" 
            disabled={loading}
            sx={{ borderRadius: '100px', px: 3 }}
          >
            Toevoegen
          </Button>
        </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
