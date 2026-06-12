/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  IconButton
} from '@mui/material';
import { Search, Calendar, User, Tag, Star, Trash2, X } from 'lucide-react';
import { Dish, Rating as RatingType, Member } from '../types';
import { MealDatabase } from '../lib/db';
import { getAvatarColor } from './ProfilePicker';

interface DishListProps {
  dishes: Dish[];
  ratingsMap: { [dishId: string]: RatingType[] };
  members: Member[];
  activeProfile: string;
}

type SortOption = 'rating' | 'date' | 'name';

export default function DishList({ dishes, ratingsMap, members, activeProfile }: DishListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);

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
        <Box sx={{ minWidth: { sm: 200 } }}>
          <FormControl fullWidth>
            <InputLabel id="sort-select-label">Sorteer op</InputLabel>
            <Select
              labelId="sort-select-label"
              value={sortBy}
              label="Sorteer op"
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              sx={{ borderRadius: '16px' }}
            >
              <MenuItem value="rating">Beste score ★</MenuItem>
              <MenuItem value="date">Nieuwste gerechten 📅</MenuItem>
              <MenuItem value="name">Alfabetische volgorde 🔤</MenuItem>
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

                    {dish.cuisine && (
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                        <Tag size={12} className="text-secondary-light" />
                        <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 700 }}>
                          {dish.cuisine}
                        </Typography>
                      </Box>
                    )}

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
        onClose={() => setSelectedDish(null)}
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
              onClick={() => setSelectedDish(null)}
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
            <DialogTitle sx={{ fontWeight: 900, pb: 1, pt: 3.5, px: 3, pr: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, color: '#311300', fontSize: { xs: '1.4rem', sm: '1.75rem' } }}>
                  {selectedDish.name}
                </Typography>
                {selectedDish.cuisine && (
                  <Chip
                    label={selectedDish.cuisine}
                    size="small"
                    sx={{ fontWeight: 700, backgroundColor: 'rgba(143, 78, 0, 0.08)', color: '#8F4E00' }}
                  />
                )}
              </Box>
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
                            {getDishStats(selectedDish.id).average > 0 ? getDishStats(selectedDish.id).average.toFixed(1) : '—'}
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
                                  backgroundColor: getAvatarColor(member.name),
                                  mr: 1.5,
                                }}
                              >
                                {member.name.charAt(0).toUpperCase()}
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
    </Box>
  );
}
