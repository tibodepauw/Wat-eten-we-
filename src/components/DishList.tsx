/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Card,
  CardContent,
  CardMedia,
  Grid,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Rating,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Alert,
  Checkbox,
  CircularProgress
} from '@mui/material';
import { Search, Calendar, User, Tag, Star, Trash2, X, Plus, Check, ShoppingBag, ShoppingCart, Pencil, Clock, Image as ImageIcon } from 'lucide-react';
import { Dish, Rating as RatingType, Member, Ingredient } from '../types';
import { MealDatabase } from '../lib/db';
import { getAvatarColor, avatarIconsMap } from './ProfilePicker';
import { compressImage, DISH_IMAGE_PRESETS } from '../lib/imageUtils';

interface DishListProps {
  dishes: Dish[];
  ratingsMap: { [dishId: string]: RatingType[] };
  members: Member[];
  activeProfile: string;
}

type SortOption = 'rating' | 'date' | 'name';

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

const cuisinePresets = [
  'Italiaans',
  'Belgisch',
  'Hollands',
  'Aziatisch',
  'Mexicaans',
  'Frans',
  'Amerikaans',
  'Grieks',
  'Overig'
];

export default function DishList({ dishes, ratingsMap, members, activeProfile }: DishListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [maxPrepTime, setMaxPrepTime] = useState<number | 'all'>('all');
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [addedIngMap, setAddedIngMap] = useState<{ [key: string]: boolean }>({});
  const [addingAllLoading, setAddingAllLoading] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);

  // Edit Dish states
  const [isEditingDish, setIsEditingDish] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCuisine, setEditCuisine] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editPrepTime, setEditPrepTime] = useState<number | ''>('');
  const [editRecipe, setEditRecipe] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editNewTagInput, setEditNewTagInput] = useState('');
  const [editSuitableMoments, setEditSuitableMoments] = useState<string[]>(['Warm eten']);
  
  // Ingredients management for editing
  const [editIngredients, setEditIngredients] = useState<Ingredient[]>([]);
  const [editIngName, setEditIngName] = useState('');
  const [editIngAmount, setEditIngAmount] = useState('');
  const [editIngCategory, setEditIngCategory] = useState('Groenten & Fruit');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editCompressing, setEditCompressing] = useState(false);
  const [editingEditIngredientIndex, setEditingEditIngredientIndex] = useState<number | null>(null);

  // Edit Dish supporting handlers
  const handleStartEditDish = (dish: Dish) => {
    setEditName(dish.name);
    setEditCuisine(dish.cuisine || '');
    setEditDescription(dish.description || '');
    setEditImageUrl(dish.imageUrl || '');
    setEditPrepTime(dish.prepTime !== undefined ? dish.prepTime : '');
    setEditRecipe(dish.recipe || '');
    setEditTags(dish.tags || []);
    setEditSuitableMoments(dish.suitableMoments || ['Warm eten']);
    setEditIngredients(dish.ingredients || []);
    setEditNewTagInput('');
    setEditIngName('');
    setEditIngAmount('');
    setEditIngCategory('Groenten & Fruit');
    setEditingEditIngredientIndex(null);
    setEditError('');
    setEditSuccess(false);
    setIsEditingDish(true);
  };

  const handleAddEditIngredient = () => {
    const trimmed = editIngName.trim();
    if (!trimmed) return;
    
    // Prevent duplicate ingredient names
    const isDuplicate = editIngredients.some((ing, idx) => 
      idx !== editingEditIngredientIndex && ing.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setEditError('Dit ingrediënt staat al in de lijst!');
      return;
    }

    if (editingEditIngredientIndex !== null) {
      const updated = [...editIngredients];
      updated[editingEditIngredientIndex] = {
        name: trimmed,
        amount: editIngAmount.trim() || undefined,
        category: editIngCategory
      };
      setEditIngredients(updated);
      setEditingEditIngredientIndex(null);
    } else {
      setEditIngredients([
        ...editIngredients,
        {
          name: trimmed,
          amount: editIngAmount.trim() || undefined,
          category: editIngCategory
        }
      ]);
    }
    
    setEditIngName('');
    setEditIngAmount('');
    setEditError('');
  };

  const handleStartEditEditIngredient = (index: number) => {
    const ing = editIngredients[index];
    setEditIngName(ing.name);
    setEditIngAmount(ing.amount || '');
    setEditIngCategory(ing.category || 'Groenten & Fruit');
    setEditingEditIngredientIndex(index);
    setEditError('');
  };

  const handleCancelEditEditIngredient = () => {
    setEditIngName('');
    setEditIngAmount('');
    setEditIngCategory('Groenten & Fruit');
    setEditingEditIngredientIndex(null);
    setEditError('');
  };

  const handleRemoveEditIngredient = (index: number) => {
    setEditIngredients(editIngredients.filter((_, i) => i !== index));
    if (editingEditIngredientIndex === index) {
      handleCancelEditEditIngredient();
    } else if (editingEditIngredientIndex !== null && editingEditIngredientIndex > index) {
      setEditingEditIngredientIndex(editingEditIngredientIndex - 1);
    }
  };

  const handleToggleEditMoment = (moment: string) => {
    if (editSuitableMoments.includes(moment)) {
      if (editSuitableMoments.length > 1) {
        setEditSuitableMoments(editSuitableMoments.filter(m => m !== moment));
      }
    } else {
      setEditSuitableMoments([...editSuitableMoments, moment]);
    }
  };

  const handleAddEditTag = () => {
    const trimmed = editNewTagInput.trim();
    if (trimmed && !editTags.includes(trimmed)) {
      if (trimmed.length > 20) {
        setEditError('Tag is te lang! Maximaal 20 tekens.');
        return;
      }
      setEditTags([...editTags, trimmed]);
      setEditNewTagInput('');
      setEditError('');
    }
  };

  const handleRemoveEditTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag));
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditCompressing(true);
    setEditError('');
    try {
      const compressedDataUrl = await compressImage(file, 1024, 0.75);
      setEditImageUrl(compressedDataUrl);
    } catch (err: any) {
      console.error(err);
      setEditError('Er is een fout opgetreden bij het verwerken van de afbeelding.');
    } finally {
      setEditCompressing(false);
    }
  };

  const handleSaveEditDish = async () => {
    if (!editName.trim()) {
      setEditError('Naam is verplicht.');
      return;
    }
    if (!selectedDish) return;

    setEditLoading(true);
    setEditError('');
    try {
      const updates = {
        name: editName.trim(),
        cuisine: editCuisine.trim() || undefined,
        description: editDescription.trim() || undefined,
        imageUrl: editImageUrl.trim() || '',
        prepTime: editPrepTime !== '' ? Number(editPrepTime) : undefined,
        recipe: editRecipe.trim() || undefined,
        tags: editTags,
        suitableMoments: editSuitableMoments,
        ingredients: editIngredients,
      };

      await MealDatabase.updateDish(selectedDish.id, updates);
      
      // Update our selectedDish reference automatically
      setSelectedDish({
        ...selectedDish,
        ...updates
      } as Dish);

      setEditSuccess(true);
      setTimeout(() => {
        setIsEditingDish(false);
        setEditSuccess(false);
      }, 1000);
    } catch (e) {
      setEditError('Fout bij het opslaan van de wijzigingen.');
      console.error(e);
    } finally {
      setEditLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedDish(null);
    setAddedIngMap({});
    setSelectedIngredients([]);
  };

  // Automatically select all non-added ingredients when a dish is opened
  useEffect(() => {
    if (selectedDish?.ingredients) {
      const nonAdded = selectedDish.ingredients
        .filter(ing => !addedIngMap[ing.name])
        .map(ing => ing.name);
      setSelectedIngredients(nonAdded);
    } else {
      setSelectedIngredients([]);
    }
  }, [selectedDish]);

  const handleAddSelectedIngredients = async () => {
    if (!selectedDish?.ingredients) return;
    setAddingAllLoading(true);
    try {
      const toAdd = selectedDish.ingredients.filter(ing => 
        selectedIngredients.includes(ing.name) && !addedIngMap[ing.name]
      );
      if (toAdd.length === 0) return;

      const itemsToPost = toAdd.map(ing => ({
        name: ing.name,
        amount: ing.amount || '',
        category: ing.category || 'Overig',
        completed: false,
        addedBy: activeProfile
      }));
      await MealDatabase.addShoppingItems(itemsToPost);
      
      const updatedMap = { ...addedIngMap };
      toAdd.forEach(ing => {
        updatedMap[ing.name] = true;
      });
      setAddedIngMap(updatedMap);
      
      // Update local checked states as well
      setSelectedIngredients(prev => prev.filter(name => !toAdd.some(t => t.name === name)));
    } catch (err) {
      console.error(err);
    } finally {
      setAddingAllLoading(false);
    }
  };

  const handleAddSingleIngredientItem = async (ing: any) => {
    try {
      await MealDatabase.addShoppingItems({
        name: ing.name,
        amount: ing.amount || '',
        category: ing.category || 'Overig',
        completed: false,
        addedBy: activeProfile
      });
      setAddedIngMap(prev => ({ ...prev, [ing.name]: true }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAllIngredients = async (ings: any[]) => {
    setAddingAllLoading(true);
    try {
      const itemsToPost = ings.map(ing => ({
        name: ing.name,
        amount: ing.amount || '',
        category: ing.category || 'Overig',
        completed: false,
        addedBy: activeProfile
      }));
      await MealDatabase.addShoppingItems(itemsToPost);
      
      const updatedMap = { ...addedIngMap };
      ings.forEach(ing => {
        updatedMap[ing.name] = true;
      });
      setAddedIngMap(updatedMap);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingAllLoading(false);
    }
  };

  // Calculate stats for a given dish
  const getDishStats = (dishId: string) => {
    const dishRatings = ratingsMap[dishId] || [];
    if (dishRatings.length === 0) {
      return { average: 0, count: 0, text: 'Nog geen beoordelingen' };
    }
    const sum = dishRatings.reduce((acc, r) => acc + r.score, 0);
    const avg = sum / dishRatings.length;
    return {
      average: avg,
      count: dishRatings.length,
      text: `${avg.toFixed(1)} / 10 (${dishRatings.length} stem${dishRatings.length === 1 ? '' : 'men'})`
    };
  };

  // Filter and Sort Dishes
  const processedDishes = dishes
    .filter((dish) => {
      // Filter by max preparation time
      if (maxPrepTime !== 'all') {
        const pTime = dish.prepTime;
        if (pTime === undefined || pTime === null) {
          return false; // exclude dishes without a time if a specific limit is selected
        }
        if (pTime > maxPrepTime) {
          return false;
        }
      }
      
      const nameMatch = dish.name.toLowerCase().includes(searchTerm.toLowerCase());
      const cuisineMatch = dish.cuisine?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const descMatch = dish.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      return nameMatch || cuisineMatch || descMatch;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'date') {
        // Sort by dates descending
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      }
      if (sortBy === 'rating') {
        // Sort by average rating descending, then fallback to name
        const avgA = getDishStats(a.id).average;
        const avgB = getDishStats(b.id).average;
        if (avgA !== avgB) {
          return avgB - avgA;
        }
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

  const handleRate = async (dishId: string, value: number | null) => {
    if (value === null) return;
    await MealDatabase.rateDish(dishId, activeProfile, value);
  };

  const handleDeleteDish = async () => {
    if (selectedDish) {
      await MealDatabase.deleteDish(selectedDish.id);
      setOpenDeleteConfirm(false);
      setSelectedDish(null);
    }
  };

  // Find the rating given by the active member for the selected dish
  const getActiveUserRating = (dishId: string) => {
    const list = ratingsMap[dishId] || [];
    const found = list.find((r) => r.ratedBy.toLowerCase() === activeProfile.toLowerCase());
    return found ? found.score : 0;
  };

  return (
    <Box sx={{ width: '100%', py: 1, px: 1 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, px: 1 }}>
        Gerechten & Recepten
      </Typography>

      {/* Search and Sort Row */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <TextField
            fullWidth
            placeholder="Zoek een lekker gerecht..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <Search size={20} className="text-gray-400 mr-2" />,
              },
            }}
            variant="outlined"
          />
        </Box>
        <Box sx={{ minWidth: { sm: 180 } }}>
          <FormControl fullWidth>
            <InputLabel id="preptime-select-label">Bereidingstijd</InputLabel>
            <Select
              labelId="preptime-select-label"
              value={maxPrepTime}
              label="Bereidingstijd"
              onChange={(e) => setMaxPrepTime(e.target.value as number | 'all')}
              sx={{ borderRadius: '16px' }}
            >
              <MenuItem value="all">Alle tijden</MenuItem>
              <MenuItem value={15}>Snel (&lt;= 15 min)</MenuItem>
              <MenuItem value={30}>Gemiddeld (&lt;= 30 min)</MenuItem>
              <MenuItem value={45}>Uitgebreid (&lt;= 45 min)</MenuItem>
              <MenuItem value={60}>Feestelijk (&lt;= 60 min)</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ minWidth: { sm: 180 } }}>
          <FormControl fullWidth>
            <InputLabel id="sort-select-label">Sorteer op</InputLabel>
            <Select
              labelId="sort-select-label"
              value={sortBy}
              label="Sorteer op"
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              sx={{ borderRadius: '16px' }}
            >
              <MenuItem value="rating">Beste score</MenuItem>
              <MenuItem value="date">Nieuwste gerechten</MenuItem>
              <MenuItem value="name">Alfabetische volgorde</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Results grid */}
      {processedDishes.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
            Geen gerechten gevonden
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Probeer een andere zoekterm, of voeg zelf een nieuw gerecht toe!
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          {processedDishes.map((dish) => {
            const stats = getDishStats(dish.id);
            return (
              <Box key={dish.id}>
                <Card
                  onClick={() => setSelectedDish(dish)}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.165, 0.84, 0.44, 1)',
                    position: 'relative',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0px 10px 24px rgba(143, 78, 0, 0.08)',
                      borderColor: '#8F4E00',
                    },
                  }}
                >
                  {dish.imageUrl ? (
                    <CardMedia
                      component="img"
                      height="150"
                      image={dish.imageUrl}
                      alt={dish.name}
                      sx={{ filter: 'brightness(0.96)' }}
                    />
                  ) : (
                     <Box
                       sx={{
                         height: 100,
                         backgroundColor: '#FEF7F3',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         borderBottom: '1px solid #F0E0D6'
                       }}
                     >
                       <Star size={32} className="text-amber-200 fill-amber-100" />
                     </Box>
                  )}
                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyBetween: 'stretch', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                        {dish.name}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mt: 0.5 }}>
                      {dish.cuisine && (
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          <Tag size={12} className="text-secondary-light" />
                          <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 700 }}>
                            {dish.cuisine}
                          </Typography>
                        </Box>
                      )}
                      
                      {dish.prepTime !== undefined && dish.prepTime !== null && (
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          <Clock size={12} className="text-secondary-light" />
                          <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 700 }}>
                            {dish.prepTime} min
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {dish.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 1,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          fontSize: '0.85rem'
                        }}
                      >
                        {dish.description}
                      </Typography>
                    )}

                    {/* Stats summary section */}
                    <Box sx={{ mt: 'auto', pt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Star size={16} fill="#f1a80a" color="#f1a80a" />
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#311300', ml: 0.5 }}>
                          {stats.average > 0 ? `${stats.average.toFixed(1)} / 10` : 'Geen stemmen'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                          ({stats.count})
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <User size={12} /> {dish.addedBy}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            );
          })}
        </Box>
      )}

      {/* DISH DETAILS AND INDIVIDUAL RATINGS SLIDE-UP DIALOG */}
      <Dialog
        open={!!selectedDish}
        onClose={handleCloseDetail}
        maxWidth="md"
        fullWidth
        scroll="paper"
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 12px 36px rgba(49, 19, 0, 0.12)',
            maxHeight: '90vh',
            position: 'relative'
          }
        }}
      >
        {selectedDish && (
          <>
            {/* Elegant Translucent Close X Button in the top right */}
            <IconButton
              onClick={handleCloseDetail}
              sx={{
                position: 'absolute',
                right: 16,
                top: 16,
                color: '#311300',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid #F0E0D6',
                zIndex: 100,
                width: 38,
                height: 38,
                boxShadow: '0px 4px 12px rgba(49, 19, 0, 0.08)',
                '&:hover': {
                  backgroundColor: '#ffffff',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.15s ease'
              }}
            >
              <X size={18} />
            </IconButton>

            {/* Dialog header title without top cover image */}
            <DialogTitle component="div" sx={{ fontWeight: 900, pb: 1, pt: 3.5, px: 3, pr: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, color: '#311300', fontSize: { xs: '1.4rem', sm: '1.75rem' } }}>
                  {selectedDish.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                  {selectedDish.cuisine && (
                    <Chip
                      label={selectedDish.cuisine}
                      size="small"
                      sx={{ fontWeight: 700, backgroundColor: 'rgba(143, 78, 0, 0.08)', color: '#8F4E00' }}
                    />
                  )}
                  {selectedDish.prepTime !== undefined && selectedDish.prepTime !== null && (
                    <Chip
                      icon={<Clock size={14} style={{ color: '#8F4E00' }} />}
                      label={`${selectedDish.prepTime} min`}
                      size="small"
                      sx={{ fontWeight: 700, backgroundColor: 'rgba(143, 78, 0, 0.08)', color: '#8F4E00', '& .MuiChip-icon': { color: '#8F4E00' } }}
                    />
                  )}
                </Box>
              </Box>
              <IconButton
                onClick={() => handleStartEditDish(selectedDish)}
                sx={{
                  backgroundColor: 'rgba(143, 78, 0, 0.06)',
                  color: '#8F4E00',
                  '&:hover': { backgroundColor: 'rgba(143, 78, 0, 0.12)' },
                  ml: 2,
                  flexShrink: 0
                }}
              >
                <Pencil size={20} />
              </IconButton>

              <IconButton
                color="error"
                onClick={() => setOpenDeleteConfirm(true)}
                sx={{
                  backgroundColor: 'rgba(186,26,26,0.06)',
                  '&:hover': { backgroundColor: 'rgba(186,26,26,0.12)' },
                  ml: 2,
                  mr: 1,
                  flexShrink: 0
                }}
              >
                <Trash2 size={20} />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pb: 4, px: 3, overflowY: 'auto' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' }, gap: 4, mt: 1 }}>
                
                {/* Left Column: Description, Tags, Recipe & Bottom Image */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                  {selectedDish.description && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: '#8F4E00', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Over het gerecht
                      </Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ borderLeft: '4px solid #8F4E00', pl: 2, py: 0.5, lineHeight: 1.6, fontSize: '0.95rem' }}>
                        {selectedDish.description}
                      </Typography>
                    </Box>
                  )}

                  {/* Suitable moments section */}
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, color: '#8F4E00', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Geschikte momenten
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {(selectedDish.suitableMoments && selectedDish.suitableMoments.length > 0
                        ? selectedDish.suitableMoments
                        : ['Warm eten']
                      ).map((moment, idx) => (
                        <Chip
                          key={idx}
                          label={moment}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            backgroundColor: 'rgba(143, 78, 0, 0.08)',
                            color: '#8F4E00',
                            border: '1px solid #F0E0D6',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Tags section */}
                  {selectedDish.tags && selectedDish.tags.length > 0 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, color: '#8F4E00', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Tags
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedDish.tags.map((tag, idx) => (
                           <Chip
                             key={idx}
                             label={tag}
                             size="small"
                             sx={{
                               fontWeight: 700,
                               backgroundColor: '#FFDCC0',
                               border: '1px solid #F0E0D6',
                               color: '#311300',
                             }}
                           />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Ingredients section */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#8F4E00', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Ingrediënten
                      </Typography>
                      {selectedDish.ingredients && selectedDish.ingredients.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => {
                              const nonAdded = selectedDish.ingredients?.filter(ing => !addedIngMap[ing.name]).map(ing => ing.name) || [];
                              const currentNonAddedSelectedCount = selectedIngredients.filter(name => nonAdded.includes(name)).length;
                              if (currentNonAddedSelectedCount === nonAdded.length) {
                                // If all non-added are already selected, deselect them
                                setSelectedIngredients(prev => prev.filter(name => !nonAdded.includes(name)));
                              } else {
                                // Otherwise select all non-added
                                setSelectedIngredients(prev => {
                                  const base = prev.filter(name => !nonAdded.includes(name));
                                  return [...base, ...nonAdded];
                                });
                              }
                            }}
                            disabled={selectedDish.ingredients.every(ing => addedIngMap[ing.name])}
                            sx={{ textTransform: 'none', fontWeight: 800, fontSize: '0.75rem', color: '#8F4E00', minWidth: 0, px: 1 }}
                          >
                            {selectedDish.ingredients.every(ing => addedIngMap[ing.name]) 
                              ? '' 
                              : (selectedIngredients.filter(name => !addedIngMap[name]).length === selectedDish.ingredients.filter(ing => !addedIngMap[ing.name]).length)
                                ? 'Deselecteer alles'
                                : 'Selecteer alles'}
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<ShoppingCart size={14} />}
                            onClick={handleAddSelectedIngredients}
                            disabled={addingAllLoading || selectedIngredients.filter(name => !addedIngMap[name]).length === 0}
                            sx={{ textTransform: 'none', fontWeight: 850, borderRadius: '12px', boxShadow: 'none', px: 2 }}
                          >
                            {selectedIngredients.filter(name => !addedIngMap[name]).length === 0 
                              ? 'Alles toegevoegd' 
                              : `Voeg geselecteerde toe (${selectedIngredients.filter(name => !addedIngMap[name]).length})`}
                          </Button>
                        </Box>
                      )}
                    </Box>

                    {selectedDish.ingredients && selectedDish.ingredients.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {selectedDish.ingredients.map((ing, idx) => {
                          const isAlreadyAdded = !!addedIngMap[ing.name];
                          const isChecked = selectedIngredients.includes(ing.name);
                          return (
                            <Box
                              key={idx}
                              onClick={() => {
                                if (!isAlreadyAdded) {
                                  setSelectedIngredients(prev =>
                                    prev.includes(ing.name)
                                      ? prev.filter(name => name !== ing.name)
                                      : [...prev, ing.name]
                                  );
                                }
                              }}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                p: 1.2,
                                borderRadius: '12px',
                                border: '1px solid #F0E0D6',
                                backgroundColor: isAlreadyAdded 
                                  ? '#F2FFF0' 
                                  : isChecked 
                                    ? 'rgba(143, 78, 0, 0.03)' 
                                    : '#ffffff',
                                borderColor: isAlreadyAdded 
                                  ? '#A6EAA2' 
                                  : isChecked 
                                    ? '#8F4E00' 
                                    : '#F0E0D6',
                                cursor: isAlreadyAdded ? 'default' : 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  borderColor: isAlreadyAdded ? '#A6EAA2' : '#8F4E00',
                                  backgroundColor: isAlreadyAdded ? '#F2FFF0' : 'rgba(143, 78, 0, 0.05)'
                                }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Checkbox
                                  checked={isAlreadyAdded || isChecked}
                                  disabled={isAlreadyAdded}
                                  size="small"
                                  sx={{
                                    color: '#8F4E00',
                                    p: 0.5,
                                    '&.Mui-checked': {
                                      color: isAlreadyAdded ? '#2E7D32' : '#8F4E00',
                                    },
                                  }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#311300', textDecoration: isAlreadyAdded ? 'line-through' : 'none', opacity: isAlreadyAdded ? 0.6 : 1 }}>
                                  {ing.name}
                                </Typography>
                                {ing.amount && (
                                  <Chip
                                    label={ing.amount}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.7rem',
                                      fontWeight: 800,
                                      backgroundColor: 'rgba(143, 78, 0, 0.08)',
                                      color: '#8F4E00',
                                      opacity: isAlreadyAdded ? 0.6 : 1
                                    }}
                                  />
                                )}
                                <span style={{ fontSize: '0.72rem', color: '#8F4E00', opacity: isAlreadyAdded ? 0.4 : 0.8, marginLeft: '4px' }}>
                                  ({ing.category})
                                </span>
                              </Box>
                              
                              <Button
                                size="small"
                                variant="text"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent toggling the checkbox
                                  handleAddSingleIngredientItem(ing);
                                }}
                                disabled={isAlreadyAdded}
                                startIcon={isAlreadyAdded ? <Check size={14} /> : <Plus size={14} />}
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 800,
                                  color: isAlreadyAdded ? '#2E7D32' : 'primary.main',
                                }}
                              >
                                {isAlreadyAdded ? 'Toegevoegd' : 'Op lijstje'}
                              </Button>
                            </Box>
                          );
                        })}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        Geen ingrediëntenlijst geconfigureerd voor dit recept.
                      </Typography>
                    )}
                  </Box>

                  {/* Recipe text section */}
                  {selectedDish.recipe && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, color: '#8F4E00', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Recept & Bereiding
                      </Typography>
                      <Card variant="outlined" sx={{ p: 2.5, borderRadius: '16px', backgroundColor: '#FEF7F3', borderColor: '#F0E0D6', whiteSpace: 'pre-wrap', boxShadow: 'none' }}>
                        <Typography variant="body2" sx={{ lineHeight: 1.6, color: '#311300', fontSize: '0.9rem' }}>
                          {selectedDish.recipe}
                        </Typography>
                      </Card>
                    </Box>
                  )}

                  {/* Move cover image beautifully to bottom of left column */}
                  {selectedDish.imageUrl && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, color: '#8F4E00', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Afbeelding
                      </Typography>
                      <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: '16px', borderColor: '#F0E0D6', boxShadow: 'none', maxHeight: { xs: 200, sm: 280 } }}>
                        <CardMedia
                          component="img"
                          image={selectedDish.imageUrl}
                          alt={selectedDish.name}
                          sx={{ width: '100%', height: '100%', maxHeight: { xs: 200, sm: 280 }, objectFit: 'cover' }}
                        />
                      </Card>
                    </Box>
                  )}
                </Box>

                {/* Right Column: Rating Box, Rating Inputs & Family Votes */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                  {/* Dynamic stats overview card */}
                  <Box sx={{ p: 2.2, borderRadius: '16px', backgroundColor: '#FEF7F3', border: '1px solid #F0E0D6' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Gemiddelde Score</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8, mt: 0.5 }}>
                          <Star size={20} fill="#f1a80a" color="#f1a80a" />
                          <Typography variant="h4" sx={{ fontWeight: 900, color: '#311300' }}>
                            {getDishStats(selectedDish.id).average > 0 ? getDishStats(selectedDish.id).average.toFixed(1) : '-'}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650, fontSize: '0.72rem' }}>
                          uit {getDishStats(selectedDish.id).count} stemmen
                        </Typography>
                      </Box>
                      <Box sx={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#F0E0D6' }} />
                      <Box sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Ingevoerd door</Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 0.5, color: '#311300', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedDish.addedBy}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontSize: '0.72rem' }}>
                          <Calendar size={11} /> {new Date(selectedDish.createdAt).toLocaleDateString('nl-NL')}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Rate This Section (For Active Profile) */}
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, color: '#8F4E00', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Jouw rating als <span style={{ color: '#311300', fontWeight: 900 }}>{activeProfile}</span>
                    </Typography>
                    <Box
                      sx={{
                        p: 2.2,
                        borderRadius: '16px',
                        border: '1px solid #F0E0D6',
                        backgroundColor: '#ffffff',
                        boxShadow: '0px 2px 8px rgba(143, 78, 0, 0.02)',
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', mb: 1.5, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        {getActiveUserRating(selectedDish.id) > 0 ? 'Jouw Beoordeling (Aanpassen):' : 'Geef jouw Beoordeling:'}
                      </Typography>
                      <Box 
                        sx={{ 
                          display: 'grid', 
                          gridTemplateColumns: { xs: 'repeat(5, 1fr)', sm: 'repeat(10, 1fr)' }, 
                          gap: 1 
                        }}
                      >
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => {
                          const isSelected = getActiveUserRating(selectedDish.id) === score;
                          return (
                            <Button
                              key={score}
                              onClick={() => handleRate(selectedDish.id, score)}
                              sx={{
                                minWidth: 0,
                                width: '100%',
                                aspectRatio: '1',
                                borderRadius: '50%',
                                p: 0,
                                fontWeight: 900,
                                fontSize: '0.85rem',
                                backgroundColor: isSelected ? '#8F4E00' : 'rgba(143, 78, 0, 0.04)',
                                color: isSelected ? '#ffffff' : '#8F4E00',
                                border: isSelected ? '1px solid #8F4E00' : '1px solid #F0E0D6',
                                boxShadow: isSelected ? '0px 3px 8px rgba(143, 78, 0, 0.25)' : 'none',
                                '&:hover': {
                                  backgroundColor: isSelected ? '#8F4E00' : 'rgba(143, 78, 0, 0.12)',
                                  borderColor: '#8F4E00',
                                  transform: 'scale(1.1)'
                                },
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {score}
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  </Box>

                  {/* Breakdown Matrix of other family member ratings */}
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, color: '#8F4E00', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Familiestemmen
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      {members.map((member) => {
                        const subRatingList = ratingsMap[selectedDish.id] || [];
                        const rating = subRatingList.find(r => r.ratedBy.toLowerCase() === member.name.toLowerCase());

                        return (
                          <Box key={member.id}>
                            <Card
                              variant="outlined"
                              sx={{
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                px: 1.5,
                                py: 1,
                                backgroundColor: '#ffffff',
                                borderColor: 'rgba(0,0,0,0.06)'
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
                                }}
                              >
                                {(() => {
                                  const IconComp = member.avatarIcon ? avatarIconsMap[member.avatarIcon] : null;
                                  if (IconComp) {
                                    return <IconComp size={15} />;
                                  }
                                  return member.avatarLetter || member.name.charAt(0).toUpperCase();
                                })()}
                              </Avatar>
                              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#311300', fontSize: '0.82rem' }}>
                                  {member.name}
                                </Typography>
                                {rating ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                                    <Box sx={{
                                      px: 0.8,
                                      py: 0.15,
                                      borderRadius: '6px',
                                      backgroundColor: rating.score >= 8 ? '#E6F4EA' : rating.score >= 5 ? '#FEF7F3' : '#FCE8E6',
                                      color: rating.score >= 8 ? '#137333' : rating.score >= 5 ? '#8F4E00' : '#C5221F',
                                      fontWeight: '900',
                                      fontSize: '0.72rem',
                                      display: 'inline-block'
                                    }}>
                                      ★ {rating.score} / 10
                                    </Box>
                                  </Box>
                                ) : (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.7rem' }}>
                                    Nog niet gestemd
                                  </Typography>
                                )}
                              </Box>
                            </Card>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Box>

              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteConfirm}
        onClose={() => setOpenDeleteConfirm(false)}
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Gerecht verwijderen?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Weet je zeker dat je "<b>{selectedDish?.name}</b>" wilt verwijderen? Dit zal dit gerecht en alle gekoppelde ratings definitief wissen voor de hele familie.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setOpenDeleteConfirm(false)}
            variant="text"
            sx={{ color: 'text.secondary' }}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleDeleteDish}
            variant="contained"
            color="error"
          >
            Definitief Verwijderen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dish Dialog */}
      <Dialog
        open={isEditingDish}
        onClose={() => setIsEditingDish(false)}
        maxWidth="md"
        fullWidth
        scroll="paper"
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '24px',
            boxShadow: '0 12px 36px rgba(49, 19, 0, 0.12)',
            maxHeight: '92vh',
          }
        }}
      >
        <DialogTitle component="div" sx={{ fontWeight: 900, pb: 1, pr: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#311300' }}>
            Gerecht bewerken
          </Typography>
          <IconButton
            onClick={() => setIsEditingDish(false)}
            sx={{
              color: '#311300',
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.08)' }
            }}
            size="small"
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pb: 4, px: 3, overflowY: 'auto' }}>
          {editError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>
              {editError}
            </Alert>
          )}

          {editSuccess && (
            <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>
              Wijzigingen succesvol opgeslagen!
            </Alert>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: 3.5, mt: 1 }}>
            {/* Left side standard inputs */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                fullWidth
                required
                label="Naam van het gerecht"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Bijv. Spaghetti Bolognese"
                variant="outlined"
              />

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 800, mb: 1, color: '#8F4E00' }}>
                  Keuken / Type preset
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={editCuisine}
                    onChange={(e) => setEditCuisine(e.target.value)}
                    displayEmpty
                    sx={{ borderRadius: '12px' }}
                  >
                    <MenuItem value="">-- Selecteer keuken --</MenuItem>
                    {cuisinePresets.map((preset) => (
                      <MenuItem key={preset} value={preset}>
                        {preset}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <TextField
                fullWidth
                label="Bereidingstijd (in minuten)"
                type="number"
                value={editPrepTime}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setEditPrepTime('');
                  } else {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                      setEditPrepTime(parsed);
                    }
                  }
                }}
                placeholder="Bijv. 20, 45, 60..."
                slotProps={{
                  input: {
                    startAdornment: <Clock size={18} className="text-gray-400 mr-2" />,
                    endAdornment: <span className="text-gray-400 text-sm ml-1">minuten</span>,
                  }
                }}
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Beschrijving (over het gerecht)"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Bijv. Een klassiek Italiaans recept meegekregen van oma..."
              />

              <TextField
                fullWidth
                multiline
                rows={6}
                label="Recept, instructies & bereiding"
                value={editRecipe}
                onChange={(e) => setEditRecipe(e.target.value)}
                placeholder="Beschrijf hier de stappen om het gerecht klaar te maken..."
              />

              {/* Cover image upload / link */}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 800, mb: 1, color: '#8F4E00', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ImageIcon size={16} /> Foto van het gerecht
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    {/* Drag and Drop manual upload card slot */}
                    <Box
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          setEditCompressing(true);
                          setEditError('');
                          try {
                            const compressedDataUrl = await compressImage(file, 1024, 0.75);
                            setEditImageUrl(compressedDataUrl);
                          } catch (err) {
                            console.error(err);
                            setEditError('Fout bij het verwerken van de afbeelding.');
                          } finally {
                            setEditCompressing(false);
                          }
                        }
                      }}
                      sx={{
                        border: '2px dashed #F0E0D6',
                        borderRadius: '12px',
                        p: 2,
                        textAlign: 'center',
                        cursor: editCompressing ? 'not-allowed' : 'pointer',
                        backgroundColor: editImageUrl.startsWith('data:image/') ? 'rgba(143, 78, 0, 0.03)' : 'transparent',
                        '&:hover': { borderColor: '#8F4E00', backgroundColor: 'rgba(143, 78, 0, 0.02)' },
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 110,
                        position: 'relative'
                      }}
                      component="label"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        disabled={editCompressing}
                        onChange={handleEditImageUpload}
                      />
                      {editCompressing ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                          <CircularProgress size={20} sx={{ color: '#8F4E00' }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#8F4E00' }}>
                            Optimaliseren...
                          </Typography>
                        </Box>
                      ) : (
                        <>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: '#8F4E00', display: 'block', mb: 0.5 }}>
                            {editImageUrl.startsWith('data:image/') ? '✓ Foto geselecteerd' : 'Upload eigen foto'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            Kies bestand of sleep hierheen
                          </Typography>
                        </>
                      )}
                    </Box>

                    {/* Direct image link paste zone */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Of plak een afbeeldings-URL"
                        variant="outlined"
                        value={editImageUrl.startsWith('data:image/') ? '' : editImageUrl}
                        onChange={(e) => setEditImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                      />
                    </Box>
                  </Box>

                  {/* Preset Library for editing */}
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, mb: 1, color: '#311300', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                      Kies een foto uit bibliotheek
                    </Typography>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        gap: 1.2, 
                        overflowX: 'auto', 
                        pb: 1,
                        px: 0.2,
                        '&::-webkit-scrollbar': { height: '5px' },
                        '&::-webkit-scrollbar-track': { backgroundColor: '#f1f1f1', borderRadius: '10px' },
                        '&::-webkit-scrollbar-thumb': { backgroundColor: '#c1c1c1', borderRadius: '10px' }
                      }}
                    >
                      {DISH_IMAGE_PRESETS.map((preset, idx) => {
                        const isSelected = editImageUrl === preset.url;
                        return (
                          <Box
                            key={idx}
                            onClick={() => {
                              setEditImageUrl(preset.url);
                              if (!editCuisine) {
                                setEditCuisine(preset.category);
                              }
                            }}
                            sx={{
                              flex: '0 0 auto',
                              width: 65,
                              textAlign: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': { transform: 'translateY(-2px)' }
                            }}
                          >
                            <Box
                              sx={{
                                width: 50,
                                height: 50,
                                borderRadius: '12px',
                                overflow: 'hidden',
                                margin: '0 auto 4px',
                                border: isSelected ? '3px solid #8F4E00' : '1px solid #F0E0D6',
                                boxShadow: isSelected ? '0 0 0 2px rgba(143, 78, 0, 0.2)' : 'none',
                                position: 'relative'
                              }}
                            >
                              <img
                                src={preset.url}
                                alt={preset.label}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                referrerPolicy="no-referrer"
                              />
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: isSelected ? 800 : 600, color: isSelected ? '#8F4E00' : '#5c5c5c', fontSize: '0.65rem', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {preset.label}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>

                  {editImageUrl && (
                    <Box 
                      sx={{ 
                        p: 1.5, 
                        borderRadius: '12px', 
                        border: '1px solid #F0E0D6', 
                        backgroundColor: '#FAF7F5',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 2 
                      }}
                    >
                      <img
                        src={editImageUrl}
                        alt="Preview"
                        style={{ width: 85, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #F0E0D6' }}
                        referrerPolicy="no-referrer"
                      />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, flexGrow: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#311300' }}>
                          Geselecteerde afbeelding
                        </Typography>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() => setEditImageUrl('')}
                          sx={{ 
                            fontWeight: 800, 
                            textTransform: 'none', 
                            py: 0.2, 
                            px: 1,
                            mt: 0.5, 
                            fontSize: '0.72rem',
                            alignSelf: 'flex-start',
                            borderRadius: '6px',
                            borderColor: '#FFDCC0',
                            color: '#d32f2f',
                            '&:hover': {
                              backgroundColor: '#ffebee',
                              borderColor: '#d32f2f'
                            }
                          }}
                        >
                          Afbeelding verwijderen
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Right side ingredients & moments */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              {/* Suitable moments checklist */}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 800, mb: 1.5, color: '#8F4E00' }}>
                  Geschikte momenten
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {['Warm eten', 'Lunch', 'Ontbijt', 'Snack', 'Feestelijk'].map((moment) => {
                    const isActive = editSuitableMoments.includes(moment);
                    return (
                      <Chip
                        key={moment}
                        label={moment}
                        onClick={() => handleToggleEditMoment(moment)}
                        color={isActive ? 'primary' : 'default'}
                        sx={{
                          fontWeight: 800,
                          borderRadius: '100px',
                          cursor: 'pointer',
                          backgroundColor: isActive ? '#8F4E00' : 'rgba(0,0,0,0.04)',
                          color: isActive ? '#ffffff' : 'text.primary',
                          '&:hover': {
                            backgroundColor: isActive ? '#733e00' : 'rgba(0,0,0,0.08)',
                          }
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>

              {/* Sub-tags section */}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 800, mb: 1, color: '#8F4E00' }}>
                  Tags & Kenmerken
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Bijv. Snel, Vega, Slank"
                    value={editNewTagInput}
                    onChange={(e) => setEditNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEditTag();
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleAddEditTag}
                    sx={{ minWidth: 46, px: 0, borderRadius: '8px' }}
                  >
                    <Plus size={18} />
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {editTags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={() => handleRemoveEditTag(tag)}
                      size="small"
                      sx={{ fontWeight: 700, backgroundColor: '#FFDCC0', color: '#311300' }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Interactive Ingredients List */}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 800, mb: 1.5, color: '#8F4E00' }}>
                  Benodigde ingrediënten ({editIngredients.length})
                </Typography>

                <Box sx={{ p: 2, borderRadius: '16px', border: '1px solid #F0E0D6', backgroundColor: '#FEF7F3', display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Ingrediënt naam"
                    value={editIngName}
                    onChange={(e) => setEditIngName(e.target.value)}
                    placeholder="Bijv. Penne pasta, Tomatenblokjes"
                  />
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      label="Hoeveelheid"
                      value={editIngAmount}
                      onChange={(e) => setEditIngAmount(e.target.value)}
                      placeholder="Bijv. 500g, 1 blik"
                      sx={{ flex: 1.2 }}
                    />
                    <FormControl size="small" sx={{ flex: 1.8 }}>
                      <InputLabel id="edit-ing-cat-label">Categorie</InputLabel>
                      <Select
                        labelId="edit-ing-cat-label"
                        value={editIngCategory}
                        label="Categorie"
                        onChange={(e) => setEditIngCategory(e.target.value)}
                        sx={{ borderRadius: '8px' }}
                      >
                        {SH_CATEGORIES.map((cat) => (
                          <MenuItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant={editingEditIngredientIndex !== null ? "contained" : "outlined"}
                      size="small"
                      startIcon={editingEditIngredientIndex !== null ? <Check size={14} /> : <Plus size={14} />}
                      onClick={handleAddEditIngredient}
                      sx={{ 
                        flexGrow: 1,
                        textTransform: 'none', 
                        fontWeight: 800, 
                        borderRadius: '8px',
                        backgroundColor: editingEditIngredientIndex !== null ? '#8F4E00' : undefined,
                        color: editingEditIngredientIndex !== null ? '#ffffff' : undefined,
                        '&:hover': {
                          backgroundColor: editingEditIngredientIndex !== null ? '#703D00' : undefined,
                        }
                      }}
                    >
                      {editingEditIngredientIndex !== null ? 'Ingrediënt opslaan' : 'Ingrediënt toevoegen'}
                    </Button>
                    {editingEditIngredientIndex !== null && (
                      <Button
                        variant="outlined"
                        color="secondary"
                        size="small"
                        startIcon={<X size={14} />}
                        onClick={handleCancelEditEditIngredient}
                        sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '8px' }}
                      >
                        Annuleren
                      </Button>
                    )}
                  </Box>
                </Box>

                {/* Ingredients array outputs */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 220, overflowY: 'auto' }}>
                  {editIngredients.map((ing, idx) => {
                    const isEditingThisInList = editingEditIngredientIndex === idx;
                    return (
                      <Box
                        key={idx}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 1.2,
                          borderRadius: '10px',
                          border: isEditingThisInList ? '2px solid #8F4E00' : '1px solid #F0E0D6',
                          backgroundColor: isEditingThisInList ? 'rgba(143, 78, 0, 0.03)' : '#ffffff',
                          boxShadow: isEditingThisInList ? '0 2px 8px rgba(143, 78, 0, 0.1)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Box sx={{ minWidth: 0, flexGrow: 1, cursor: 'pointer' }} onClick={() => handleStartEditEditIngredient(idx)}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#311300' }}>
                            {ing.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {ing.amount || 'Naar smaak'} • {ing.category}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleStartEditEditIngredient(idx)}
                            sx={{ color: '#8F4E00' }}
                            title="Bewerken"
                          >
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveEditIngredient(idx)}
                            title="Verwijderen"
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Box>
                      </Box>
                    );
                  })}
                  {editIngredients.length === 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', pl: 1 }}>
                      Nog geen ingrediënten geconfigureerd.
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, borderTop: '1px solid #F0E0D6' }}>
          <Button
            onClick={() => setIsEditingDish(false)}
            variant="text"
            sx={{ textTransform: 'none', fontWeight: 800, color: 'text.secondary' }}
            disabled={editLoading}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleSaveEditDish}
            variant="contained"
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '100px', px: 3 }}
            disabled={editLoading}
          >
            {editLoading ? 'Opslaan...' : 'Gerecht opslaan'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
