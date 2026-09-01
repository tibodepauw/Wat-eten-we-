/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  Snackbar,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  IconButton,
  CircularProgress
} from '@mui/material';
import { Plus, Tag, Link as LinkIcon, FileText, ChefHat, Trash2, ShoppingBag, Clock, Pencil, X, Image as ImageIcon } from 'lucide-react';
import { MealDatabase } from '../lib/db';
import { Ingredient } from '../types';
import { compressImage, DISH_IMAGE_PRESETS } from '../lib/imageUtils';

interface AddDishFormProps {
  activeProfile: string;
  onSuccess: () => void;
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

export default function AddDishForm({ activeProfile, onSuccess }: AddDishFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [recipe, setRecipe] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [suitableMoments, setSuitableMoments] = useState<string[]>(['Warm eten']);
  const [prepTime, setPrepTime] = useState<number | ''>('');
  
  // Ingredients management
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIngName, setNewIngName] = useState('');
  const [newIngAmount, setNewIngAmount] = useState('');
  const [newIngCategory, setNewIngCategory] = useState('Groenten & Fruit');
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAddIngredient = () => {
    const trimmed = newIngName.trim();
    if (!trimmed) return;
    
    // Prevent duplicate ingredient names
    const isDuplicate = ingredients.some((ing, idx) => 
      idx !== editingIngredientIndex && ing.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setErrorText('Dit ingrediënt staat al in de lijst!');
      return;
    }

    if (editingIngredientIndex !== null) {
      const updated = [...ingredients];
      updated[editingIngredientIndex] = {
        name: trimmed,
        amount: newIngAmount.trim() || undefined,
        category: newIngCategory
      };
      setIngredients(updated);
      setEditingIngredientIndex(null);
    } else {
      setIngredients([
        ...ingredients,
        {
          name: trimmed,
          amount: newIngAmount.trim() || undefined,
          category: newIngCategory
        }
      ]);
    }
    
    setNewIngName('');
    setNewIngAmount('');
    setErrorText('');
  };

  const handleStartEditIngredient = (index: number) => {
    const ing = ingredients[index];
    setNewIngName(ing.name);
    setNewIngAmount(ing.amount || '');
    setNewIngCategory(ing.category || 'Groenten & Fruit');
    setEditingIngredientIndex(index);
    setErrorText('');
  };

  const handleCancelEditIngredient = () => {
    setNewIngName('');
    setNewIngAmount('');
    setNewIngCategory('Groenten & Fruit');
    setEditingIngredientIndex(null);
    setErrorText('');
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
    if (editingIngredientIndex === index) {
      handleCancelEditIngredient();
    } else if (editingIngredientIndex !== null && editingIngredientIndex > index) {
      setEditingIngredientIndex(editingIngredientIndex - 1);
    }
  };

  const handleToggleMoment = (moment: string) => {
    if (suitableMoments.includes(moment)) {
      if (suitableMoments.length > 1) {
        setSuitableMoments(suitableMoments.filter(m => m !== moment));
      }
    } else {
      setSuitableMoments([...suitableMoments, moment]);
    }
  };

  const handlePresetClick = (preset: string) => {
    setCuisine(preset);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    setErrorText('');
    try {
      const compressedDataUrl = await compressImage(file, 1024, 0.75);
      const serverImageUrl = await MealDatabase.uploadImage(compressedDataUrl);
      setImageUrl(serverImageUrl);
    } catch (err: any) {
      console.error(err);
      setErrorText('Er is een fout opgetreden bij het verwerken van de afbeelding.');
    } finally {
      setCompressing(false);
    }
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      if (trimmed.length > 20) {
        setErrorText('Tag is te lang! Maximaal 20 tekens.');
        return;
      }
      setTags([...tags, trimmed]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorText('Voer ten minste een naam in voor het gerecht!');
      return;
    }

    if (trimmedName.length > 80) {
      setErrorText('Naam van het gerecht is te lang!');
      return;
    }

    setLoading(true);
    setErrorText('');

    try {
      const addedDishId = await MealDatabase.addDish({
        name: trimmedName,
        description: description.trim() || undefined,
        cuisine: cuisine.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        prepTime: prepTime !== '' ? Number(prepTime) : undefined,
        recipe: recipe.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        suitableMoments: suitableMoments,
        ingredients: ingredients.length > 0 ? ingredients : undefined,
        addedBy: activeProfile
      });

      // Automatically rate 10 stars (on the 10-star system) for the person adding their own yummy dish!
      await MealDatabase.rateDish(addedDishId, activeProfile, 10);

      setShowSuccess(true);
      
      // Delay redirect to let toast be noticed
      setTimeout(() => {
        onSuccess();
        // Reset state
        setName('');
        setDescription('');
        setCuisine('');
        setImageUrl('');
        setPrepTime('');
        setRecipe('');
        setTags([]);
        setIngredients([]);
        setSuitableMoments(['Warm eten']);
      }, 1500);

    } catch (err: any) {
      setErrorText('Er is een fout opgetreden bij het toevoegen. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', py: 1, px: 1 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, px: 1 }}>
        Nieuw gerecht toevoegen
      </Typography>

      <Card sx={{ border: '1px solid #F0E0D6' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Voeg een nieuw gezinsgerecht toe. Deze verschijnt daarna meteen op het Rad van Inspiratie van de familie!
          </Typography>

          {errorText && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>
              {errorText}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Dish Name */}
            <Box>
              <TextField
                fullWidth
                required
                label="Naam van het gerecht"
                variant="outlined"
                value={name}
                onChange={(e) => {
                  if (e.target.value.length <= 80) {
                    setName(e.target.value);
                    setErrorText('');
                  }
                }}
                placeholder="Bijv. Lasagne Bolognese, Asperges Flamande..."
              />
            </Box>

            {/* Preset Cuisine Chips */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tag size={16} /> Keuken of Categorie (sjabloon)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {cuisinePresets.map((preset) => (
                  <Chip
                    key={preset}
                    label={preset}
                    onClick={() => handlePresetClick(preset)}
                    variant={cuisine === preset ? 'filled' : 'outlined'}
                    color={cuisine === preset ? 'primary' : 'default'}
                    sx={{
                      fontWeight: 650,
                      px: 0.5,
                      py: 2,
                      borderRadius: '12px',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'scale(1.04)',
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Custom Cuisine input if not using presets */}
            <Box>
              <TextField
                fullWidth
                label="Of kies een eigen categorie/keuken"
                variant="outlined"
                value={cuisine}
                onChange={(e) => {
                  if (e.target.value.length <= 30) {
                    setCuisine(e.target.value);
                  }
                }}
                placeholder="Bijv. Tapas, Barbecue, Snel..."
              />
            </Box>

            {/* Bereidingstijd */}
            <Box>
              <TextField
                fullWidth
                label="Bereidingstijd (in minuten)"
                variant="outlined"
                type="number"
                value={prepTime}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setPrepTime('');
                  } else {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                      setPrepTime(parsed);
                    }
                  }
                }}
                placeholder="Bijv. 20, 30, 45..."
                slotProps={{
                  input: {
                    startAdornment: <Clock size={18} className="text-gray-400 mr-2" />,
                    endAdornment: <span className="text-gray-400 text-sm ml-1">minuten</span>,
                  }
                }}
              />
            </Box>

            {/* Suitable moments selection */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#8F4E00', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.8rem' }}>
                Geschikt voor welke momenten? (Selecteer één of meerdere)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {['Ontbijt', 'Warm eten', 'Koud eten', 'Vieruurtje', 'Voorgerecht', 'Aperitief'].map((moment) => {
                  const isSelected = suitableMoments.includes(moment);
                  return (
                    <Chip
                      key={moment}
                      label={moment}
                      onClick={() => handleToggleMoment(moment)}
                      variant={isSelected ? 'filled' : 'outlined'}
                      color={isSelected ? 'primary' : 'default'}
                      sx={{
                        fontWeight: 700,
                        px: 0.5,
                        py: 2,
                        borderRadius: '12px',
                        transition: 'all 0.15s ease',
                        border: isSelected ? '1px solid #8F4E00' : '1px solid #F0E0D6',
                        backgroundColor: isSelected ? '#8F4E00' : 'transparent',
                        color: isSelected ? '#ffffff' : '#8F4E00',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          backgroundColor: isSelected ? '#703D00' : 'rgba(143, 78, 0, 0.06)',
                          borderColor: '#8F4E00',
                        }
                      }}
                    />
                  );
                })}
              </Box>
            </Box>

            {/* Tags area */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary' }}>
                Tags los van de keukens (voor kenmerken)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
                <TextField
                  size="small"
                  label="Nieuwe tag typen"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Bijv. Kindvriendelijk, Vegetarisch, Zomer, Snel"
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  onClick={handleAddTag}
                  sx={{
                    height: 40,
                    borderRadius: '12px',
                    borderColor: '#F0E0D6',
                    textTransform: 'none',
                    fontWeight: 800,
                    color: 'primary.main',
                  }}
                >
                  Voeg toe
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {tags.map((tg) => (
                  <Chip
                    key={tg}
                    label={tg}
                    onDelete={() => handleRemoveTag(tg)}
                    sx={{
                      fontWeight: 700,
                      backgroundColor: '#FFDCC0',
                      color: '#311300',
                      border: '1px solid #F0E0D6',
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Ingredients Section */}
            <Box sx={{ border: '1px solid #F0E0D6', borderRadius: '16px', p: 3, backgroundColor: '#FAF7F5' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1, color: '#311300', display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShoppingBag size={18} className="text-amber-700" /> Ingrediënten (voor op de boodschappenlijst)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Voeg hier ingrediënten toe. Gezinsleden kunnen deze later met één klik toevoegen aan het gezamenlijk boodschappenlijstje!
              </Typography>
              
              {/* Add form */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1.5fr auto' }, gap: 1.5, alignItems: 'flex-start', mb: 2.5 }}>
                <TextField
                  size="small"
                  label="Ingrediënt naam"
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  placeholder="Bijv. Kipfilet, Tomaat"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddIngredient();
                    }
                  }}
                  sx={{ backgroundColor: '#ffffff', borderRadius: '8px' }}
                />
                <TextField
                  size="small"
                  label="Hoeveelheid"
                  value={newIngAmount}
                  onChange={(e) => setNewIngAmount(e.target.value)}
                  placeholder="Bijv. 400g, 3 stuks"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddIngredient();
                    }
                  }}
                  sx={{ backgroundColor: '#ffffff', borderRadius: '8px' }}
                />
                <FormControl size="small" fullWidth>
                  <InputLabel id="ing-cat-label">Categorie</InputLabel>
                  <Select
                    labelId="ing-cat-label"
                    value={newIngCategory}
                    label="Categorie"
                    onChange={(e) => setNewIngCategory(e.target.value)}
                    sx={{ borderRadius: '12px', backgroundColor: '#ffffff' }}
                  >
                    {SH_CATEGORIES.map((cat) => (
                      <MenuItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                  <Button
                    variant="contained"
                    onClick={handleAddIngredient}
                    sx={{
                      height: 40,
                      borderRadius: '12px',
                      textTransform: 'none',
                      fontWeight: 800,
                      flex: 1,
                      backgroundColor: editingIngredientIndex !== null ? '#8F4E00' : undefined,
                      '&:hover': {
                        backgroundColor: editingIngredientIndex !== null ? '#703D00' : undefined,
                      }
                    }}
                  >
                    {editingIngredientIndex !== null ? 'Opslaan' : 'Voeg toe'}
                  </Button>
                  {editingIngredientIndex !== null && (
                    <IconButton
                      color="secondary"
                      onClick={handleCancelEditIngredient}
                      sx={{
                        height: 40,
                        width: 40,
                        borderRadius: '12px',
                        border: '1px solid currentColor',
                        p: 0
                      }}
                      title="Annuleren"
                    >
                      <X size={18} />
                    </IconButton>
                  )}
                </Box>
              </Box>

              {/* Added ingredients list */}
              {ingredients.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {ingredients.map((ing, idx) => {
                    const catLabel = SH_CATEGORIES.find(c => c.value === ing.category)?.label || ing.category;
                    const isEditingThis = editingIngredientIndex === idx;
                    return (
                      <Box
                        key={idx}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 2,
                          py: 1,
                          borderRadius: '12px',
                          backgroundColor: isEditingThis ? 'rgba(143, 78, 0, 0.03)' : '#ffffff',
                          border: isEditingThis ? '2px solid #8F4E00' : '1px solid #F0E0D6',
                          boxShadow: isEditingThis ? '0 2px 8px rgba(143, 78, 0, 0.1)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', flexGrow: 1 }} onClick={() => handleStartEditIngredient(idx)}>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#311300' }}>
                            {ing.name}
                          </Typography>
                          {ing.amount && (
                            <Chip
                              label={ing.amount}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor: 'rgba(143, 78, 0, 0.08)',
                                color: '#8F4E00',
                              }}
                            />
                          )}
                          <Chip
                              label={catLabel}
                              size="small"
                              variant="outlined"
                              sx={{
                                height: 20,
                                fontSize: '0.72rem',
                                borderColor: '#F0E0D6'
                              }}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          <IconButton
                            size="small"
                            onClick={() => handleStartEditIngredient(idx)}
                            sx={{ color: '#8F4E00' }}
                            title="Bewerken"
                          >
                            <Pencil size={15} />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveIngredient(idx)}
                            title="Verwijderen"
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 1 }}>
                  Nog geen ingrediënten toegevoegd aan dit gerecht.
                </Typography>
              )}
            </Box>

            {/* Description (details) */}
            <Box>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Korte omschrijving of geheim ingrediënt"
                variant="outlined"
                value={description}
                onChange={(e) => {
                  if (e.target.value.length <= 600) {
                    setDescription(e.target.value);
                  }
                }}
                placeholder="Bijv. Met extra veel kaas of Papa's geheime sausje..."
                slotProps={{
                  input: {
                    startAdornment: <FileText size={18} style={{ alignSelf: 'flex-start', marginTop: '12px' }} className="text-gray-400 mr-2" />,
                  }
                }}
              />
            </Box>

            {/* Paste Recipie */}
            <Box>
              <TextField
                fullWidth
                multiline
                rows={5}
                label="Plak hier het recept of bereiding"
                variant="outlined"
                value={recipe}
                onChange={(e) => setRecipe(e.target.value)}
                placeholder="Plak het volledige recept of stappenplan hier..."
                slotProps={{
                  input: {
                    startAdornment: <FileText size={18} style={{ alignSelf: 'flex-start', marginTop: '12px' }} className="text-gray-400 mr-2" />,
                  }
                }}
              />
            </Box>

            {/* File Upload, Link óf Preset */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: '#8F4E00', display: 'flex', alignItems: 'center', gap: 1 }}>
                <ImageIcon size={16} /> Foto van het gerecht
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Kies een foto om het gerecht extra smakelijk te presenteren! Upload een eigen foto (wordt automatisch geoptimaliseerd) of kies een prachtige foto uit de bibliotheek.
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, mb: 3.5 }}>
                {/* Drag and Drop manual upload card slot */}
                <Box
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      setCompressing(true);
                      setErrorText('');
                      try {
                        const compressedDataUrl = await compressImage(file, 1024, 0.75);
                        setImageUrl(compressedDataUrl);
                      } catch (err) {
                        console.error(err);
                        setErrorText('Fout bij het verwerken van de afbeelding.');
                      } finally {
                        setCompressing(false);
                      }
                    }
                  }}
                  sx={{
                    border: '2px dashed #F0E0D6',
                    borderRadius: '16px',
                    p: 3,
                    textAlign: 'center',
                    cursor: compressing ? 'not-allowed' : 'pointer',
                    backgroundColor: imageUrl.startsWith('data:image/') ? 'rgba(143, 78, 0, 0.03)' : 'transparent',
                    '&:hover': { borderColor: '#8F4E00', backgroundColor: 'rgba(143, 78, 0, 0.02)' },
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 120,
                    position: 'relative'
                  }}
                  component="label"
                >
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={compressing}
                    onChange={handleImageUpload}
                  />
                  {compressing ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={24} sx={{ color: '#8F4E00' }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#8F4E00' }}>
                        Afbeelding optimaliseren...
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#8F4E00', display: 'block', mb: 0.5 }}>
                        {imageUrl.startsWith('data:image/') ? '✓ Eigen foto geselecteerd' : 'Upload eigen foto'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Kies bestand, sleep hierheen of maak een foto. Elk formaat is toegestaan!
                      </Typography>
                    </>
                  )}
                </Box>

                {/* Direct image link paste zone */}
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <TextField
                    fullWidth
                    label="Of plak een directe afbeeldings-URL"
                    variant="outlined"
                    value={imageUrl.startsWith('data:image/') ? '' : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    slotProps={{
                      input: {
                        startAdornment: <LinkIcon size={18} className="text-gray-400 mr-2" />,
                      }
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, pl: 0.5 }}>
                    Handig als je een link hebt van bijvoorbeeld Google of een receptenwebsite.
                  </Typography>
                </Box>
              </Box>

              {/* Preset Gallery Selector */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: '#311300', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Snelle fotobibliotheek
                </Typography>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    gap: 1.5, 
                    overflowX: 'auto', 
                    pb: 1.5,
                    px: 0.5,
                    '&::-webkit-scrollbar': { height: '6px' },
                    '&::-webkit-scrollbar-track': { backgroundColor: '#f1f1f1', borderRadius: '10px' },
                    '&::-webkit-scrollbar-thumb': { backgroundColor: '#c1c1c1', borderRadius: '10px' }
                  }}
                >
                  {DISH_IMAGE_PRESETS.map((preset, idx) => {
                    const isSelected = imageUrl === preset.url;
                    return (
                      <Box
                        key={idx}
                        onClick={() => {
                          setImageUrl(preset.url);
                          if (!cuisine) {
                            setCuisine(preset.category);
                          }
                        }}
                        sx={{
                          flex: '0 0 auto',
                          width: 90,
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': { transform: 'translateY(-2px)' }
                        }}
                      >
                        <Box
                          sx={{
                            width: 70,
                            height: 70,
                            borderRadius: '16px',
                            overflow: 'hidden',
                            margin: '0 auto 6px',
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
                          {isSelected && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(143, 78, 0, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Box sx={{ backgroundColor: '#8F4E00', color: '#ffffff', borderRadius: '50%', p: 0.2, display: 'flex' }}>
                                <Plus size={12} style={{ transform: 'rotate(45deg)', color: '#ffffff' }} />
                              </Box>
                            </Box>
                          )}
                        </Box>
                        <Typography variant="caption" sx={{ fontWeight: isSelected ? 800 : 650, color: isSelected ? '#8F4E00' : '#5c5c5c', fontSize: '0.72rem', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {preset.label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {imageUrl && (
                <Box 
                  sx={{ 
                    mt: 2, 
                    mb: 1,
                    p: 2, 
                    borderRadius: '16px', 
                    border: '1px solid #F0E0D6', 
                    backgroundColor: '#FAF7F5',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2.5 
                  }}
                >
                  <img
                    src={imageUrl}
                    alt="Geselecteerde preview"
                    style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 12, border: '1px solid #F0E0D6' }}
                    referrerPolicy="no-referrer"
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#311300' }}>
                      Geselecteerde afbeelding
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {imageUrl.startsWith('data:image/') ? 'Geüpload vanaf apparaat (lokaal gecomprimeerd)' : 'Geselecteerd uit de bibliotheek / externe URL'}
                    </Typography>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => setImageUrl('')}
                      sx={{ 
                        fontWeight: 800, 
                        textTransform: 'none', 
                        mt: 1, 
                        alignSelf: 'flex-start',
                        borderRadius: '8px',
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

            {/* Submit panel */}
            <Box sx={{ mt: 1 }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={loading || showSuccess}
                startIcon={<Plus size={20} />}
                sx={{
                  py: 1.8,
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  borderRadius: '100px',
                  boxShadow: '0px 6px 16px rgba(143, 78, 0, 0.15)',
                }}
              >
                {loading ? 'Toevoegen...' : 'GERECHT TOEVOEGEN'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Success Banner pop-up */}
      <Snackbar
        open={showSuccess}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 90, sm: 24 } }}
      >
        <Alert severity="success" sx={{ width: '100%', borderRadius: '12px', fontWeight: 700, boxShadow: '0px 4px 12px rgba(0,0,0,0.1)' }}>
          Hiep hiep hoera! Gerecht succesvol toegevoegd 🎉
        </Alert>
      </Snackbar>
    </Box>
  );
}
