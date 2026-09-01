/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Avatar,
  Grid,
  TextField,
  Chip,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { 
  User, Plus, Database, Cloud, RefreshCw, AlertTriangle, HelpCircle, Key, Palette, Image, Check, ChevronRight, Lock, Trash2
} from 'lucide-react';
import { MealDatabase, isFirestoreFallback } from '../lib/db';
import { Member } from '../types';
import { getAvatarColor, avatarIconsMap } from './ProfilePicker';

interface SettingsPanelProps {
  activeProfile: string;
  members: Member[];
  onSwitchProfile: (name: string) => void;
  onLogout: () => void;
}

const AVAILABLE_COLORS = [
  '#8F4E00', // Warm Bronze/Amber
  '#a26c4f', // Soft Terracotta
  '#5a7862', // Sage Green
  '#3d5a45', // Forest Green
  '#f28f3b', // Muted Apricot
  '#c0392b', // Deep Crimson
  '#9b59b6', // Amethyst purple
  '#16a085', // Dark Teal
  '#3498db', // Light Steel Blue
  '#2980b9', // Strong Blue
  '#2c3e50', // Midnight Slate
  '#e67e22', // Deep Orange
];

const PRESET_ICONS = [
  { key: '', label: 'Geen (Letter)' },
  { key: 'smile', label: 'Lachen' },
  { key: 'heart', label: 'Hartje' },
  { key: 'star', label: 'Ster' },
  { key: 'flame', label: 'Vuur' },
  { key: 'crown', label: 'Kroon' },
  { key: 'shield', label: 'Schild' },
  { key: 'trophy', label: 'Beker' },
  { key: 'moon', label: 'Maan' },
  { key: 'sun', label: 'Zon' },
  { key: 'ghost', label: 'Spook' },
  { key: 'music', label: 'Muziek' },
  { key: 'coffee', label: 'Koffie' },
  { key: 'pizza', label: 'Pizza' },
  { key: 'cat', label: 'Kat' },
  { key: 'dog', label: 'Hond' },
  { key: 'apple', label: 'Appel' },
  { key: 'cake', label: 'Taart' },
  { key: 'user', label: 'Persoon' },
];

export default function SettingsPanel({ activeProfile, members, onSwitchProfile, onLogout }: SettingsPanelProps) {
  const activeMember = members.find(m => m.name.toLowerCase() === activeProfile.toLowerCase());

  // Form states
  const [profileName, setProfileName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [avatarColor, setAvatarColor] = useState('#8F4E00');
  const [avatarLetter, setAvatarLetter] = useState('U');
  const [avatarIcon, setAvatarIcon] = useState('');

  const [addMemberName, setAddMemberName] = useState('');
  const [addMemberPassword, setAddMemberPassword] = useState('');

  const [profileErrorText, setProfileErrorText] = useState('');
  const [profileSuccessText, setProfileSuccessText] = useState('');
  
  const [addErrorText, setAddErrorText] = useState('');
  const [addSuccessText, setAddSuccessText] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  // Delete member states
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);
  const [deleteMemberError, setDeleteMemberError] = useState('');

  // Sync state values on load or user switch
  useEffect(() => {
    if (activeMember) {
      const targetName = activeMember.name;
      const targetPassword = activeMember.password || activeMember.name.toLowerCase();
      const targetColor = activeMember.avatarColor || getAvatarColor(activeMember.name);
      const targetLetter = activeMember.avatarLetter || activeMember.name.charAt(0).toUpperCase();
      const targetIcon = activeMember.avatarIcon || '';

      if (profileName !== targetName) setProfileName(targetName);
      if (profilePassword !== targetPassword) setProfilePassword(targetPassword);
      if (avatarColor !== targetColor) setAvatarColor(targetColor);
      if (avatarLetter !== targetLetter) setAvatarLetter(targetLetter);
      if (avatarIcon !== targetIcon) setAvatarIcon(targetIcon);
      
      setProfileErrorText('');
      setProfileSuccessText('');
    }
  }, [
    activeMember?.id,
    activeMember?.name,
    activeMember?.password,
    activeMember?.avatarColor,
    activeMember?.avatarLetter,
    activeMember?.avatarIcon,
    activeProfile
  ]);

  const handleSaveProfile = async () => {
    if (!activeMember) return;
    const trimName = profileName.trim();
    const trimPass = profilePassword.trim();
    const trimLetter = avatarLetter.trim().substring(0, 2);

    if (!trimName) {
      setProfileErrorText('Naam mag niet leeg zijn!');
      return;
    }
    if (trimName.length > 20) {
      setProfileErrorText('Naam mag maximaal 20 tekens zijn!');
      return;
    }
    if (!trimPass) {
      setProfileErrorText('Wachtwoord mag niet leeg zijn!');
      return;
    }

    // Name conflict check if changed
    if (trimName.toLowerCase() !== activeMember.name.toLowerCase()) {
      const alreadyTaken = members.some(m => m.id !== activeMember.id && m.name.toLowerCase() === trimName.toLowerCase());
      if (alreadyTaken) {
        setProfileErrorText('Deze naam is al in gebruik door iemand anders!');
        return;
      }
    }

    setSavingProfile(true);
    setProfileErrorText('');
    setProfileSuccessText('');

    try {
      const resp = await MealDatabase.updateMember(activeMember.id, {
        name: trimName,
        password: trimPass,
        avatarColor,
        avatarLetter: trimLetter || trimName.charAt(0).toUpperCase(),
        avatarIcon
      });

      setProfileSuccessText('Je profiel is succesvol aangepast!');
      // Update session state
      onSwitchProfile(trimName);
    } catch (e: any) {
      setProfileErrorText(e.message || 'Profiel kon niet worden bijgewerkt.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddMember = async () => {
    const trimName = addMemberName.trim();
    const trimPass = addMemberPassword.trim();

    if (!trimName) {
      setAddErrorText('Naam mag niet leeg zijn!');
      return;
    }
    if (trimName.length > 20) {
      setAddErrorText('Naam is te lang (max 20 tekens)');
      return;
    }
    if (!trimPass) {
      setAddErrorText('Wachtwoord mag niet leeg zijn!');
      return;
    }
    if (members.some(m => m.name.toLowerCase() === trimName.toLowerCase())) {
      setAddErrorText('Dit gezinslid bestaat al!');
      return;
    }

    setAddingMember(true);
    setAddErrorText('');
    setAddSuccessText('');

    try {
      const letter = trimName.charAt(0).toUpperCase();
      const color = getAvatarColor(trimName);

      await MealDatabase.addMember(trimName, trimPass, color, letter, 'smile');
      setAddMemberName('');
      setAddMemberPassword('');
      setAddSuccessText(`Gezinslid "${trimName}" is succesvol toegevoegd! Wachtwoord is ingesteld.`);
    } catch (e: any) {
      setAddErrorText(e.message || 'Kon gezinslid niet toevoegen.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleConfirmDeleteMember = async () => {
    if (!memberToDelete) return;
    if (members.length <= 1) {
      setDeleteMemberError('Er moet minstens één gezinslid bewaard blijven.');
      return;
    }

    setDeletingMember(true);
    setDeleteMemberError('');
    try {
      await MealDatabase.deleteMember(memberToDelete.id);
      const isCurrentActive = memberToDelete.name.toLowerCase() === activeProfile.toLowerCase();
      setMemberToDelete(null);

      if (isCurrentActive) {
        const remaining = members.filter(m => m.id !== memberToDelete.id);
        if (remaining.length > 0) {
          onSwitchProfile(remaining[0].name);
        } else {
          onLogout();
        }
      }
    } catch (err: any) {
      setDeleteMemberError(err.message || 'Kon gezinslid niet verwijderen.');
    } finally {
      setDeletingMember(false);
    }
  };

  const handleResetLocalDB = () => {
    if (window.confirm('Weet je zeker dat je de lokale database wilt herstellen naar de standaard gerechten? Dit verwijdert alle eigen wijzigingen.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // Preview properties
  const PreviewIcon = avatarIcon ? avatarIconsMap[avatarIcon] : null;

  return (
    <Box sx={{ width: '100%', py: 1, px: 1 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, px: 1 }}>
        Instellingen
      </Typography>

      {/* Profilerings Customizer Panel (HIGHLIGHT NEW FEATURE) */}
      <Card sx={{ mb: 3, border: '1px solid #FFDCC0', backgroundColor: '#FFFDFB' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Palette size={22} className="text-amber-800" />
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#8F4E00' }}>
              Profiel
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Personaliseer je naam, kies je favoriete achtergrondkleur, stel een uniek symbool of een letter in, en beveilig je profiel met een eigen snelwachtwoord.
          </Typography>

          {profileErrorText && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>
              {profileErrorText}
            </Alert>
          )}

          {profileSuccessText && (
            <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>
              {profileSuccessText}
            </Alert>
          )}

          <Grid container spacing={3.5}>
            {/* Left Column: Visual Avatar Preview & Name / Wachtwoord */}
            <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: { md: '1px solid #F0E0D6' }, pr: { md: 3 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'text.secondary' }}>
                Voorbeeld Weergave
              </Typography>
              
              <Avatar
                sx={{
                  width: 90,
                  height: 90,
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  backgroundColor: avatarColor,
                  color: '#ffffff',
                  mb: 2.5,
                  boxShadow: '0px 6px 18px rgba(0,0,0,0.12)',
                }}
              >
                {PreviewIcon ? (
                  <PreviewIcon size={44} strokeWidth={2.3} />
                ) : (
                  avatarLetter || '?'
                )}
              </Avatar>

              <Box sx={{ width: '100%', mt: 1 }}>
                <TextField
                  label="Mijn Naam"
                  fullWidth
                  size="small"
                  variant="outlined"
                  value={profileName}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.length <= 20) {
                      setProfileName(val);
                      setProfileErrorText('');
                      // Auto-update default active letter
                      if (val.trim()) {
                        setAvatarLetter(val.trim().charAt(0).toUpperCase());
                      }
                    }
                  }}
                  sx={{ mb: 2 }}
                />

                <TextField
                  label="Mijn Snelwachtwoord"
                  type="password"
                  fullWidth
                  size="small"
                  variant="outlined"
                  value={profilePassword}
                  onChange={(e) => {
                    setProfilePassword(e.target.value);
                    setProfileErrorText('');
                  }}
                  placeholder="Typ nieuw wachtwoord"
                  helperText="Om veilig in te loggen via het startscherm"
                />
              </Box>
            </Grid>

            {/* Right Column: Colors & Symbols options */}
            <Grid size={{ xs: 12, md: 7 }}>
              {/* Background color selection block */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Palette size={16} /> Kies Achtergrondkleur
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {AVAILABLE_COLORS.map((color) => (
                    <Box
                      key={color}
                      onClick={() => setAvatarColor(color)}
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: color,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid transparent',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        transform: avatarColor === color ? 'scale(1.15)' : 'none',
                        borderColor: avatarColor === color ? '#ffffff' : 'transparent',
                        outline: avatarColor === color ? `2px solid ${color}` : 'none',
                        transition: 'all 0.15s ease',
                        '&:hover': { transform: 'scale(1.1)' }
                      }}
                    >
                      {avatarColor === color && <Check size={14} className="text-white font-bold" />}
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Avatar Type: Letter or Icon selection */}
              <Box sx={{ mb: 3.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Image size={16} /> Kies Letter of Symbool / Icon
                </Typography>

                <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                  <TextField
                    label="Profiel Letter (max 2)"
                    size="small"
                    variant="outlined"
                    value={avatarLetter}
                    onChange={(e) => {
                      setAvatarLetter(e.target.value.substring(0, 2));
                      setAvatarIcon(''); // Clear icon choice to prioritize letter
                    }}
                    placeholder="P"
                    sx={{ width: '130px' }}
                    disabled={!!avatarIcon}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {avatarIcon ? 'Symbool is geselecteerd. Wis de selectie om letter te gebruiken.' : 'Of kies hieronder een symbool:'}
                    </Typography>
                  </Box>
                </Box>

                {/* Preset Icons Selection list */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: '110px', overflowY: 'auto', p: 1, border: '1px solid #F0E0D6', borderRadius: '12px', backgroundColor: '#ffffff' }}>
                  {PRESET_ICONS.map((preset) => {
                    const PresetIcon = preset.key ? avatarIconsMap[preset.key] : null;
                    const isSelected = avatarIcon === preset.key;
                    return (
                      <Chip
                        key={preset.key}
                        icon={PresetIcon ? <PresetIcon size={12} /> : undefined}
                        label={preset.label}
                        size="small"
                        onClick={() => {
                          setAvatarIcon(preset.key);
                          if (preset.key) setAvatarLetter(''); // clear letter if choosing icon
                        }}
                        variant={isSelected ? 'filled' : 'outlined'}
                        color={isSelected ? 'primary' : 'default'}
                        sx={{
                          fontWeight: 700,
                          cursor: 'pointer',
                          borderColor: isSelected ? 'transparent' : '#F0E0D6',
                          backgroundColor: isSelected ? '#8F4E00' : 'transparent',
                          color: isSelected ? '#ffffff !important' : 'text.primary',
                          '& .MuiChip-icon': {
                            color: isSelected ? '#ffffff !important' : 'inherit'
                          }
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>

              <Button
                variant="contained"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                fullWidth
                sx={{ borderRadius: '100px', py: 1.2, fontWeight: 800 }}
              >
                {savingProfile ? 'Gegevens Opslaan...' : 'Aanpassingen Opslaan'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Database State Card */}
      <Card sx={{ mb: 3, border: '1px solid #F0E0D6' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            {isFirestoreFallback ? (
              <Box sx={{ p: 1, borderRadius: '12px', backgroundColor: 'rgba(241, 168, 10, 0.1)', color: 'warning.main' }}>
                <Cloud size={24} />
              </Box>
            ) : (
              <Box sx={{ p: 1, borderRadius: '12px', backgroundColor: 'rgba(56, 106, 32, 0.1)', color: 'success.main' }}>
                <Database size={24} />
              </Box>
            )}
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Database Synchronisatie Status
            </Typography>
          </Box>

          {isFirestoreFallback ? (
            <Alert severity="warning" variant="outlined" icon={<AlertTriangle size={20} />} sx={{ borderRadius: '12px', mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Lokale Simulator Modus is Actief
              </Typography>
              <Typography variant="caption" color="text.secondary">
                De app draait momenteel op een lokale database in je browser. Dit is perfect voor het testen! Zodra de Firebase-sleutels via het platform zijn geconfigureerd, schakelt de app automatisch en naadloos over op live, cloud-gesynchroniseerde Firestore gegevens.
              </Typography>
            </Alert>
          ) : (
            <Alert severity="success" variant="outlined" sx={{ borderRadius: '12px', mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Gekoppeld aan Live Cloud-Firestore!
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Gerechten en stemmen worden nu direct en real-time gesynchroniseerd tussen alle gezinsleden op elk apparaat.
              </Typography>
            </Alert>
          )}

          {isFirestoreFallback && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<RefreshCw size={14} />}
              onClick={handleResetLocalDB}
              sx={{ borderRadius: '12px', mt: 1 }}
            >
              Reset Lokale Database
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Profile Switching Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <User size={18} className="text-primary" /> Wissel van Gezinslid
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Je bent momenteel ingelogd als <b>{activeProfile}</b>. Klik op een ander gezinslid hieronder om over te stappen van profiel:
          </Typography>

          {deleteMemberError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
              {deleteMemberError}
            </Alert>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 1.5,
              mb: 3,
            }}
          >
            {members.map((member) => {
              const IconComp = member.avatarIcon ? avatarIconsMap[member.avatarIcon] : null;
              const isActive = activeProfile.toLowerCase() === member.name.toLowerCase();
              return (
                <Box
                  key={member.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    borderRadius: '12px',
                    border: isActive ? '2px solid #8F4E00' : '1px solid #F0E0D6',
                    backgroundColor: isActive ? '#FFDCC0' : 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': {
                      backgroundColor: isActive ? '#FFDCC0' : 'rgba(0,0,0,0.01)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  <Box
                    onClick={() => onSwitchProfile(member.name)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      flex: 1,
                      overflow: 'hidden'
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        backgroundColor: member.avatarColor || getAvatarColor(member.name),
                        color: '#ffffff',
                        mr: 1.5,
                        flexShrink: 0
                      }}
                    >
                      {IconComp ? (
                        <IconComp size={15} />
                      ) : (
                        member.avatarLetter || member.name.charAt(0).toUpperCase()
                      )}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.name}
                    </Typography>
                    {isActive && (
                      <Chip size="small" label="Actief" color="primary" sx={{ ml: 1, height: 16, fontSize: '0.65rem', fontWeight: 800 }} />
                    )}
                  </Box>

                  {members.length > 1 && (
                    <Tooltip title={`Verwijder ${member.name}`}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteMemberError('');
                          setMemberToDelete(member);
                        }}
                        sx={{ ml: 1, p: 0.5 }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              );
            })}
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Button
            variant="text"
            color="error"
            onClick={onLogout}
            sx={{ fontWeight: 'bold' }}
          >
            Log uit en ga naar Welkomstscherm
          </Button>
        </CardContent>
      </Card>

      {/* Add Member in Settings */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Plus size={18} className="text-primary" /> Nieuw lid toevoegen
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Registreer een nieuw lid aan de gezinstafel met een eigen wachtwoord.
          </Typography>

          {addErrorText && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
              {addErrorText}
            </Alert>
          )}

          {addSuccessText && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }}>
              {addSuccessText}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                size="small"
                label="Naam van nieuw lid"
                variant="outlined"
                fullWidth
                value={addMemberName}
                onChange={(e) => {
                  if (e.target.value.length <= 20) {
                    setAddMemberName(e.target.value);
                    setAddErrorText('');
                    setAddSuccessText('');
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                size="small"
                label="Stel wachtwoord in"
                type="password"
                variant="outlined"
                fullWidth
                value={addMemberPassword}
                onChange={(e) => {
                  setAddMemberPassword(e.target.value);
                  setAddErrorText('');
                  setAddSuccessText('');
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <Button
                variant="contained"
                onClick={handleAddMember}
                disabled={addingMember}
                fullWidth
                sx={{ height: '40px', borderRadius: '100px' }}
              >
                {addingMember ? '...' : 'Voeg toe'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Delete Member Confirmation Modal */}
      <Dialog
        open={Boolean(memberToDelete)}
        onClose={() => setMemberToDelete(null)}
        slotProps={{
          paper: { sx: { borderRadius: '16px', p: 1 } }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Gezinslid verwijderen?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Weet je zeker dat je <strong>{memberToDelete?.name}</strong> wilt verwijderen van de gezinstafel? Alle individuele beoordelingen van dit lid worden eveneens opgeruimd.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setMemberToDelete(null)}
            color="inherit"
            disabled={deletingMember}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleConfirmDeleteMember}
            color="error"
            variant="contained"
            disabled={deletingMember}
            sx={{ borderRadius: '100px' }}
          >
            {deletingMember ? 'Verwijderen...' : 'Ja, verwijder lid'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
