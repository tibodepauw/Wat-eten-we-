/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
} from '@mui/material';
import { User, Plus, Database, Cloud, RefreshCw, AlertTriangle, HelpCircle } from 'lucide-react';
import { MealDatabase, isFirestoreFallback } from '../lib/db';
import { Member } from '../types';
import { getAvatarColor } from './ProfilePicker';

interface SettingsPanelProps {
  activeProfile: string;
  members: Member[];
  onSwitchProfile: (name: string) => void;
  onLogout: () => void;
}

export default function SettingsPanel({ activeProfile, members, onSwitchProfile, onLogout }: SettingsPanelProps) {
  const [newMemberName, setNewMemberName] = useState('');
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddMember = async () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) {
      setErrorText('Naam mag niet leeg zijn!');
      return;
    }
    if (trimmed.length > 20) {
      setErrorText('Naam is te lang (max 20 tekens)');
      return;
    }
    if (members.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorText('Dit gezinslid bestaat al!');
      return;
    }

    setLoading(true);
    await MealDatabase.addMember(trimmed);
    setNewMemberName('');
    setErrorText('');
    setLoading(false);
  };

  const handleResetLocalDB = () => {
    if (window.confirm('Weet je zeker dat je de lokale database wilt herstellen naar de standaard gerechten? Dit verwijdert alle eigen wijzigingen.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <Box sx={{ width: '100%', py: 1, px: 1 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, px: 1 }}>
        Instellingen & Familie
      </Typography>

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
            Je bent momenteel ingelogd als <b>{activeProfile}</b>. Klik op een ander gezinslid hieronder om van profiel te wisselen:
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
              gap: 1.5,
              mb: 3,
            }}
          >
            {members.map((member) => (
              <Box
                key={member.id}
                onClick={() => onSwitchProfile(member.name)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1.5,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: activeProfile === member.name ? '2px solid #8F4E00' : '1px solid #F0E0D6',
                  backgroundColor: activeProfile === member.name ? '#FFDCC0' : 'transparent',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.01)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    backgroundColor: getAvatarColor(member.name),
                    mr: 1.5
                  }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.name}
                </Typography>
                {activeProfile === member.name && (
                  <Chip size="small" label="Actief" color="primary" sx={{ ml: 'auto', height: 16, fontSize: '0.65rem', fontWeight: 800 }} />
                )}
              </Box>
            ))}
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
            <Plus size={18} className="text-primary" /> Nieuw Lid Toevoegen (Settings)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
            Heeft de familie uitbreiding gekregen of eet er iemand gezellig mee vanavond? Voeg ze hier toe!
          </Typography>

          {errorText && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
              {errorText}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              size="small"
              label="Naam van nieuw lid"
              variant="outlined"
              fullWidth
              value={newMemberName}
              onChange={(e) => {
                if (e.target.value.length <= 20) {
                  setNewMemberName(e.target.value);
                  setErrorText('');
                }
              }}
            />
            <Button
              variant="contained"
              onClick={handleAddMember}
              disabled={loading}
              sx={{ whiteSpace: 'nowrap', borderRadius: '100px', px: 3 }}
            >
              Toevoegen
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
