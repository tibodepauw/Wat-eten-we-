/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider,
  Paper,
  Tabs,
  Tab,
  Alert
} from '@mui/material';
import {
  Plus,
  Trash2,
  Tag,
  Check,
  ShoppingBag,
  ShoppingCart,
  Layers,
  Sparkles,
  ClipboardList,
  User,
  CheckSquare,
  RefreshCw
} from 'lucide-react';
import { MealDatabase } from '../lib/db';
import { ShoppingItem } from '../types';

interface ShoppingListProps {
  activeProfile: string;
}

const SH_CATEGORIES = [
  { value: 'Groenten & Fruit', label: '🥦 Groenten & Fruit' },
  { value: 'Zuivel', label: '🥛 Zuivel' },
  { value: 'Vlees & Vis', label: '🥩 Vlees & Vis' },
  { value: 'Bakkerij', label: '🍞 Bakkerij' },
  { value: 'Kruidenier & Droogwaren', label: '🥫 Kruidenier & Droogwaren' },
  { value: 'Dranken & Snacks', label: '🥤 Dranken & Snacks' },
  { value: 'Huishoudelijk & Verzorging', label: '🧼 Huishoudelijk & Verzorging' },
  { value: 'Overig', label: '📦 Overig' }
];

export default function ShoppingList({ activeProfile }: ShoppingListProps) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Custom manual add inputs
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const [itemCategory, setItemCategory] = useState('Groenten & Fruit');
  const [errorText, setErrorText] = useState('');

  // Clear dialogs setup
  const [confirmClearType, setConfirmClearType] = useState<'completed' | 'all' | null>(null);

  // Filter view (All vs Active vs Completed)
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'completed'>('all');

  // Real-time synchronization
  useEffect(() => {
    setLoading(true);
    const unsubscribe = MealDatabase.subscribeShoppingList((updatedItems) => {
      setItems(updatedItems);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Handlers
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = itemName.trim();
    if (!trimmed) return;

    if (trimmed.length > 50) {
      setErrorText('Naam is te lang!');
      return;
    }

    try {
      setErrorText('');
      await MealDatabase.addShoppingItems({
        name: trimmed,
        amount: itemAmount.trim() || undefined,
        category: itemCategory,
        completed: false,
        addedBy: activeProfile
      });
      setItemName('');
      setItemAmount('');
    } catch (e) {
      setErrorText('Kon item niet toevoegen.');
    }
  };

  const handleToggleItemStatus = async (item: ShoppingItem) => {
    try {
      await MealDatabase.updateShoppingItem(item.id, {
        completed: !item.completed
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await MealDatabase.deleteShoppingItem(id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearTrigger = (type: 'completed' | 'all') => {
    setConfirmClearType(type);
  };

  const handleConfirmClear = async () => {
    if (!confirmClearType) return;
    try {
      await MealDatabase.clearShoppingList(confirmClearType);
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmClearType(null);
    }
  };

  // Group items by category
  const categoriesMap: { [key: string]: ShoppingItem[] } = {};
  SH_CATEGORIES.forEach(cat => {
    categoriesMap[cat.value] = [];
  });
  // Fallback for custom categories
  categoriesMap['Overig'] = [];

  // Filter items first
  const filteredItems = items.filter(item => {
    if (filterMode === 'active') return !item.completed;
    if (filterMode === 'completed') return item.completed;
    return true; // 'all'
  });

  filteredItems.forEach(item => {
    const cat = item.category || 'Overig';
    if (categoriesMap[cat]) {
      categoriesMap[cat].push(item);
    } else {
      categoriesMap['Overig'].push(item);
    }
  });

  const totalActive = items.filter(it => !it.completed).length;

  return (
    <Box sx={{ width: '100%', py: 1, px: 1 }}>
      {/* Title & Stats */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifySpaceBetween: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1, mb: 3, px: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#311300', display: 'flex', alignItems: 'center', gap: 1 }}>
            <ClipboardList size={26} className="text-amber-800" /> Boodschappenlijstje
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gezamenlijk boodschappenlijstje voor de hele familie!
          </Typography>
        </Box>
        
        {items.length > 0 && (
          <Chip
            avatar={<ShoppingCart size={14} className="text-white" />}
            label={`${totalActive} spullen te kopen`}
            color="primary"
            sx={{ fontWeight: 700, backgroundColor: '#8F4E00', color: '#ffffff' }}
          />
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 2fr' }, gap: 3.5 }}>
        {/* LEFT COLUMN: Add new item form & filters */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card sx={{ border: '1px solid #F0E0D6', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 850, mb: 2, color: '#311300', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Plus size={18} className="text-amber-800" /> Snel toevoegen
              </Typography>

              {errorText && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>
                  {errorText}
                </Alert>
              )}

              <Box component="form" onSubmit={handleAddItem} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  required
                  size="small"
                  label="Productnaam"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Bijv. Halfvolle melk, Appels"
                />

                <TextField
                  fullWidth
                  size="small"
                  label="Hoeveelheid (optioneel)"
                  value={itemAmount}
                  onChange={(e) => setItemAmount(e.target.value)}
                  placeholder="Bijv. 2 pakken, 1kg"
                />

                <FormControl size="small" fullWidth>
                  <InputLabel id="sh-cat-label">Categorie</InputLabel>
                  <Select
                    labelId="sh-cat-label"
                    value={itemCategory}
                    label="Categorie"
                    onChange={(e) => setItemCategory(e.target.value)}
                    sx={{ borderRadius: '12px' }}
                  >
                    {SH_CATEGORIES.map((cat) => (
                      <MenuItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  startIcon={<Plus size={16} />}
                  sx={{
                    fontWeight: 800,
                    borderRadius: '100px',
                    py: 1.2,
                    textTransform: 'none'
                  }}
                >
                  Toevoegen
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Quick Filter tabs & Clear board */}
          <Card sx={{ border: '1px solid #F0E0D6', borderRadius: '16px' }}>
            <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                Type overzicht
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 0.8 }}>
                <Button
                  size="small"
                  variant={filterMode === 'all' ? 'contained' : 'outlined'}
                  onClick={() => setFilterMode('all')}
                  sx={{ flex: 1, textTransform: 'none', fontWeight: 700, borderRadius: '100px', boxShadow: 'none' }}
                >
                  Alles ({items.length})
                </Button>
                <Button
                  size="small"
                  variant={filterMode === 'active' ? 'contained' : 'outlined'}
                  onClick={() => setFilterMode('active')}
                  sx={{ flex: 1, textTransform: 'none', fontWeight: 700, borderRadius: '100px', boxShadow: 'none' }}
                >
                  Actief ({items.filter(i => !i.completed).length})
                </Button>
                <Button
                  size="small"
                  variant={filterMode === 'completed' ? 'contained' : 'outlined'}
                  onClick={() => setFilterMode('completed')}
                  sx={{ flex: 1, textTransform: 'none', fontWeight: 700, borderRadius: '100px', boxShadow: 'none' }}
                >
                  Gereed
                </Button>
              </Box>

              {items.length > 0 && (
                <>
                  <Divider />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button
                      size="small"
                      color="warning"
                      variant="text"
                      startIcon={<CheckSquare size={14} />}
                      onClick={() => handleClearTrigger('completed')}
                      sx={{ textTransform: 'none', fontWeight: 750, justifyContent: 'flex-start' }}
                    >
                      Voltooide wissen
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="text"
                      startIcon={<Trash2 size={14} />}
                      onClick={() => handleClearTrigger('all')}
                      sx={{ textTransform: 'none', fontWeight: 750, justifyContent: 'flex-start' }}
                    >
                      Volledige lijst leegmaken
                    </Button>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* RIGHT COLUMN: Shopping List Items Categorized */}
        <Box>
          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
              <RefreshCw className="animate-spin text-amber-800 mb-2" size={32} />
              <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 650 }}>
                Lijstje synchroniseren...
              </Typography>
            </Box>
          ) : items.length === 0 ? (
            <Card sx={{ border: '2px dashed #F0E0D6', borderRadius: '24px', py: 6, px: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Box sx={{ p: 2, borderRadius: '100px', backgroundColor: '#FEF7F3', mb: 2, color: '#8F4E00' }}>
                <ShoppingBag size={35} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: '#311300' }}>
                Boodschappenlijstje is leeg!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                Voeg handmatig ingrediënten toe of ga naar de gerechten-tab om ingrediënten rechtstreeks van favoriete recepten in te plannen!
              </Typography>
            </Card>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {SH_CATEGORIES.map(category => {
                const categoryItems = categoriesMap[category.value] || [];
                if (categoryItems.length === 0) return null;

                return (
                  <Paper
                    key={category.value}
                    elevation={0}
                    sx={{
                      border: '1px solid #F0E0D6',
                      borderRadius: '16px',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Category Title Header */}
                    <Box sx={{ backgroundColor: '#FAF7F5', px: 2.5, py: 1.5, borderBottom: '1px solid #F0E0D6', display: 'flex', justifyBetween: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 850, color: '#311300' }}>
                          {category.label}
                        </Typography>
                        <Chip
                          label={categoryItems.length}
                          size="small"
                          sx={{ height: 18, fontSize: '0.7rem', fontWeight: 800, backgroundColor: '#8F4E00', color: '#ffffff' }}
                        />
                      </Box>
                    </Box>

                    {/* Category Items List */}
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      {categoryItems.map((item, index) => (
                        <Box
                          key={item.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 2,
                            py: 1.5,
                            borderBottom: index < categoryItems.length - 1 ? '1px solid #F0E0D6' : 'none',
                            backgroundColor: item.completed ? 'rgba(0, 0, 0, 0.01)' : '#ffffff',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                            <Checkbox
                              checked={!!item.completed}
                              onChange={() => handleToggleItemStatus(item)}
                              color="primary"
                              sx={{ p: 0.5, color: '#CBB2A6', '&.Mui-checked': { color: '#8F4E00' } }}
                            />
                            
                            <Box sx={{ ml: 0.5 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 700,
                                  color: item.completed ? 'text.secondary' : '#311300',
                                  textDecoration: item.completed ? 'line-through' : 'none',
                                  opacity: item.completed ? 0.6 : 1,
                                }}
                              >
                                {item.name}
                              </Typography>
                              {item.amount && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    display: 'block',
                                    fontWeight: 700,
                                    color: '#8F4E00',
                                    opacity: item.completed ? 0.5 : 0.8
                                  }}
                                >
                                  {item.amount}
                                </Typography>
                              )}
                            </Box>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {/* Member initial badge */}
                            <Chip
                              size="small"
                              avatar={<User size={10} />}
                              label={item.addedBy}
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                color: 'text.secondary'
                              }}
                            />
                            
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteItem(item.id)}
                              sx={{ color: '#CBB2A6', '&:hover': { color: '#d32f2f' } }}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* Confirmation modal for clears */}
      <Dialog
        open={!!confirmClearType}
        onClose={() => setConfirmClearType(null)}
        slotProps={{ paper: { sx: { borderRadius: '20px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {confirmClearType === 'completed' ? 'Spullen verwijderen?' : 'Lijstje leegmaken?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontWeight: 500 }}>
            {confirmClearType === 'completed'
              ? 'Weet je zeker dat je alle gekochte boodschappen uit de lijst wilt verwijderen?'
              : 'Weet je zeker dat je HELEMAAL ALLES uit de boodschappenlijst wilt wissen? Dit kan niet ongedaan worden gemaakt.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setConfirmClearType(null)}
            sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'none' }}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleConfirmClear}
            variant="contained"
            color={confirmClearType === 'completed' ? 'primary' : 'error'}
            sx={{ fontWeight: 800, borderRadius: '100px', textTransform: 'none' }}
          >
            Ja, wis dit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
