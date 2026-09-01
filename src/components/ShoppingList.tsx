/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  { value: 'Groenten & Fruit', label: 'Groenten & Fruit' },
  { value: 'Zuivel', label: 'Zuivel' },
  { value: 'Vlees & Vis', label: 'Vlees & Vis' },
  { value: 'Bakkerij', label: 'Bakkerij' },
  { value: 'Kruidenier & Droogwaren', label: 'Kruidenier & Droogwaren' },
  { value: 'Dranken & Snacks', label: 'Dranken & Snacks' },
  { value: 'Huishoudelijk & Verzorging', label: 'Huishoudelijk & Verzorging' },
  { value: 'Overig', label: 'Overig' }
];

export default function ShoppingList({ activeProfile }: ShoppingListProps) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Custom manual add inputs
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const [itemCategory, setItemCategory] = useState('Groenten & Fruit');
  const [errorText, setErrorText] = useState('');

  // Autocomplete suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Clear dialogs setup
  const [confirmClearType, setConfirmClearType] = useState<'completed' | 'all' | null>(null);

  // Filter view (Default to active - uncompleted, is 'active' vs 'completed')
  const [filterMode, setFilterMode] = useState<'active' | 'completed'>('active');

  // Real-time synchronization
  useEffect(() => {
    setLoading(true);
    const unsubscribe = MealDatabase.subscribeShoppingList((updatedItems) => {
      setItems(updatedItems);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Compute autocomplete suggestions based on previously archived/completed items
  const query = itemName.trim().toLowerCase();
  
  // Get unique archived items
  const archivedItems = items.filter(item => item.completed);
  const distinctPresets: ShoppingItem[] = [];
  const seenNames = new Set<string>();
  
  archivedItems.forEach(item => {
    const norm = item.name.trim().toLowerCase();
    if (!seenNames.has(norm)) {
      seenNames.add(norm);
      distinctPresets.push(item);
    }
  });

  const suggestions = query.length >= 1 
    ? distinctPresets.filter(item => item.name.toLowerCase().includes(query))
    : [];

  const handleSelectSuggestion = (preset: ShoppingItem) => {
    setItemName(preset.name);
    if (preset.amount) {
      setItemAmount(preset.amount);
    }
    if (preset.category) {
      setItemCategory(preset.category);
    }
    setShowSuggestions(false);
  };

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
      setShowSuggestions(false);
    } catch (e) {
      setErrorText('Kon item niet toevoegen.');
    }
  };

  const handleToggleItemStatus = async (item: ShoppingItem) => {
    // Optimistic update
    setItems(prevItems =>
      prevItems.map(it =>
        it.id === item.id ? { ...it, completed: !it.completed } : it
      )
    );
    try {
      await MealDatabase.updateShoppingItem(item.id, {
        completed: !item.completed
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteItem = async (id: string) => {
    // Optimistic update
    setItems(prevItems => prevItems.filter(it => it.id !== id));
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
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1, mb: 3, px: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#311300', display: 'flex', alignItems: 'center', gap: 1 }}>
            <ClipboardList size={26} className="text-amber-800" /> Boodschappenlijstje
          </Typography>
        </Box>
        
        {items.length > 0 && (
          <Chip
            icon={<ShoppingCart size={14} style={{ color: '#ffffff' }} />}
            label={`${totalActive} spullen te kopen`}
            color="primary"
            sx={{
              fontWeight: 700,
              backgroundColor: '#8F4E00',
              color: '#ffffff',
              '& .MuiChip-icon': {
                color: '#ffffff !important',
              }
            }}
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
                <Box sx={{ position: 'relative' }}>
                  <TextField
                    fullWidth
                    required
                    size="small"
                    label="Productnaam"
                    value={itemName}
                    onChange={(e) => {
                      setItemName(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      // Slight delay to allow clicks on selection to register first
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    placeholder="Bijv. Halfvolle melk, Appels"
                  />

                  {showSuggestions && suggestions.length > 0 && (
                    <Paper
                      elevation={4}
                      sx={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 10,
                        maxHeight: 180,
                        overflowY: 'auto',
                        mt: 0.5,
                        border: '1px solid #F0E0D6',
                        borderRadius: '12px',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 4px 12px rgba(49, 19, 0, 0.08)'
                      }}
                    >
                      {suggestions.map((preset) => (
                        <Box
                          key={preset.id}
                          onClick={() => handleSelectSuggestion(preset)}
                          sx={{
                            px: 2,
                            py: 1,
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid #FAF7F5',
                            '&:hover': {
                              backgroundColor: '#FEF7F3'
                            },
                            transition: 'background-color 0.1s'
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#311300' }}>
                            {preset.name}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {preset.amount && (
                              <Chip
                                label={preset.amount}
                                size="small"
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, backgroundColor: 'rgba(143, 78, 0, 0.08)', color: '#8F4E00' }}
                              />
                            )}
                            <Chip
                              label={preset.category || 'Overig'}
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          </Box>
                        </Box>
                      ))}
                    </Paper>
                  )}
                </Box>

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
                  variant={filterMode === 'active' ? 'contained' : 'outlined'}
                  onClick={() => setFilterMode('active')}
                  sx={{ flex: 1, textTransform: 'none', fontWeight: 700, borderRadius: '100px', boxShadow: 'none' }}
                >
                  Active Boodschappen ({items.filter(i => !i.completed).length})
                </Button>
                <Button
                  size="small"
                  variant={filterMode === 'completed' ? 'contained' : 'outlined'}
                  onClick={() => setFilterMode('completed')}
                  sx={{ flex: 1, textTransform: 'none', fontWeight: 700, borderRadius: '100px', boxShadow: 'none' }}
                >
                  Gearchiveerd ({items.filter(i => i.completed).length})
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
                    <Box sx={{ backgroundColor: '#FAF7F5', px: 2.5, py: 1.5, borderBottom: '1px solid #F0E0D6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <AnimatePresence initial={false}>
                        {categoryItems.map((item, index) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0, overflow: 'hidden', scale: 0.95 }}
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                          >
                            <Box
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
                          </motion.div>
                        ))}
                      </AnimatePresence>
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
