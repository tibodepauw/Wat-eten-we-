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
  IconButton
} from '@mui/material';
import { Plus, Tag, Link as LinkIcon, FileText, ChefHat, Trash2, ShoppingBag } from 'lucide-react';
import { MealDatabase } from '../lib/db';
import { Ingredient } from '../types';

interface AddDishFormProps {
  activeProfile: string;
  onSuccess: () => void;
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
  
  // Ingredients management
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIngName, setNewIngName] = useState('');
  const [newIngAmount, setNewIngAmount] = useState('');
  const [newIngCategory, setNewIngCategory] = useState('Groenten & Fruit');

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAddIngredient = () => {
    const trimmed = newIngName.trim();
    if (!trimmed) return;
    
    // Prevent duplicate ingredient names
    if (ingredients.some(ing => ing.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorText('Dit ingrediënt staat al in de lijst!');
      return;
    }

    setIngredients([
      ...ingredients,
      {
        name: trimmed,
        amount: newIngAmount.trim() || undefined,
        category: newIngCategory
      }
    ]);
    
    setNewIngName('');
    setNewIngAmount('');
    setErrorText('');
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1200000) {
      setErrorText('De geselecteerde afbeelding is groter dan 1MB. Selecteer een kleiner bestand!');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
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
                <Button
                  variant="contained"
                  onClick={handleAddIngredient}
                  sx={{
                    height: 40,
                    borderRadius: '12px',
                    textTransform: 'none',
                    fontWeight: 800,
                  }}
                >
                  Voeg toe
                </Button>
              </Box>

              {/* Added ingredients list */}
              {ingredients.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {ingredients.map((ing, idx) => {
                    const catLabel = SH_CATEGORIES.find(c => c.value === ing.category)?.label || ing.category;
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
                          backgroundColor: '#ffffff',
                          border: '1px solid #F0E0D6',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveIngredient(idx)}
                        >
                          <Trash2 size={16} />
                        </IconButton>
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

            {/* File Upload óf Link */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary' }}>
                Afbeelding uploaden of link plakken
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                {/* Drag and Drop manual upload card slot */}
                <Box
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      if (file.size > 1200000) {
                        setErrorText('Foto is te groot! Selecteer een bestand kleiner dan 1MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => setImageUrl(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  sx={{
                    border: '2px dashed #F0E0D6',
                    borderRadius: '16px',
                    p: 2.5,
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: imageUrl.startsWith('data:image/') ? 'rgba(143, 78, 0, 0.03)' : 'transparent',
                    '&:hover': { borderColor: '#8F4E00', backgroundColor: 'rgba(143, 78, 0, 0.02)' },
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  component="label"
                >
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleImageUpload}
                  />
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#8F4E00', display: 'block', mb: 0.5 }}>
                    {imageUrl.startsWith('data:image/') ? '✓ Foto geselecteerd' : 'Kies bestand of sleep hierheen'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Max. 1MB (PNG, JPG, WEBP)
                  </Typography>
                </Box>

                {/* Direct image link paste zone */}
                <Box>
                  <TextField
                    fullWidth
                    label="Of plak een directe URL link"
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
                </Box>
              </Box>

              {imageUrl && (
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <img
                    src={imageUrl}
                    alt="Preview"
                    style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #F0E0D6' }}
                    referrerPolicy="no-referrer"
                  />
                  <Button
                    size="small"
                    color="error"
                    variant="text"
                    onClick={() => setImageUrl('')}
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Afbeelding verwijderen
                  </Button>
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
