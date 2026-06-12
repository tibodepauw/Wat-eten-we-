/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  Avatar,
  Divider,
} from '@mui/material';
import { ChevronLeft, ChevronRight, Trash2, Plus, Calendar as CalendarIcon, AlertCircle, Sparkles } from 'lucide-react';
import { Dish, PlannedMeal } from '../types';
import { MealDatabase } from '../lib/db';

interface CalendarViewProps {
  dishes: Dish[];
  plannedMeals: PlannedMeal[];
  activeProfile: string;
  onAddPlannedMeal?: (meal: Omit<PlannedMeal, 'id' | 'createdAt'>) => Promise<string>;
  onDeletePlannedMeal?: (id: string) => Promise<void>;
  initialFocusDate?: string | null;
  highlightedSlot?: { date: string; slot: string } | null;
  onClearHighlight?: () => void;
}

// Dutch names for days & months
const DUTCH_DAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const DUTCH_MONTHS = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'
];

const CALENDAR_SLOTS = [
  { key: 'ontbijt', label: 'Ontbijt', color: '#FF9800', lightColor: '#FFF3E0' },
  { key: 'middag', label: 'Middag', color: '#4CAF50', lightColor: '#E8F5E9' },
  { key: 'avond', label: 'Avond', color: '#8F4E00', lightColor: '#FEF7F3', highlight: true },
  { key: 'tussendoor', label: 'Tussendoor', color: '#E91E63', lightColor: '#FCE4EC' },
];

export default function CalendarView({
  dishes,
  plannedMeals,
  activeProfile,
  onAddPlannedMeal,
  onDeletePlannedMeal,
  initialFocusDate,
  highlightedSlot,
  onClearHighlight
}: CalendarViewProps) {
  // Current day reference for start of week view
  const today = new Date();
  
  // Set to current week's Monday
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
  });

  // Focus and scroll to the scheduled date of the meal
  useEffect(() => {
    if (initialFocusDate) {
      const d = new Date(initialFocusDate + 'T12:00:00');
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const targetMonday = new Date(d.setDate(diff));
      
      setCurrentWeekStart(targetMonday);

      if (highlightedSlot) {
        const timer = setTimeout(() => {
          const element = document.getElementById(`slot-${initialFocusDate}-${highlightedSlot.slot}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 350); // Allow render settlement
        return () => clearTimeout(timer);
      }
    }
  }, [initialFocusDate, highlightedSlot]);

  // Modal actions and state tracking
  const [openModal, setOpenModal] = useState(false);
  const [targetDateStr, setTargetDateStr] = useState('');
  const [targetMealTime, setTargetMealTime] = useState<string>('avond');
  const [selectedDishId, setSelectedDishId] = useState('');
  const [restrictionError, setRestrictionError] = useState<string | null>(null);

  // Custom delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mealIdToDelete, setMealIdToDelete] = useState<string | null>(null);

  // Generate date list for the 7 days of this week view
  const getWeekDates = (start: Date): Date[] => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const nextDate = new Date(start);
      nextDate.setDate(start.getDate() + i);
      dates.push(nextDate);
    }
    return dates;
  };

  const weekDates = getWeekDates(currentWeekStart);

  // Navigation handlers
  const handlePrevWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const handleNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const handleCurrentWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // monday
    setCurrentWeekStart(new Date(d.setDate(diff)));
  };

  // Convert date to YYYY-MM-DD
  const formatDateString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 7-day rule check
  const checkSevenDayRestriction = (dishId: string, proposedDateStr: string): { holds: boolean; reason?: string } => {
    const proposedDate = new Date(proposedDateStr + 'T12:00:00');
    
    for (const meal of plannedMeals) {
      if (meal.dishId === dishId) {
        // Calculate dynamic diff days
        const mealPlannedDate = new Date(meal.plannedDate + 'T12:00:00');
        const diffTime = Math.abs(proposedDate.getTime() - mealPlannedDate.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 7) {
          const matchedDish = dishes.find(d => d.id === dishId);
          const dishName = matchedDish ? matchedDish.name : 'Dit gerecht';
          const formattedDateLocale = mealPlannedDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
          return {
            holds: false,
            reason: `"${dishName}" is al gepland op ${formattedDateLocale} (en dat is binnen 7 dagen van je gekozen datum). Kies een ander gezond gerecht of andere datum!`
          };
        }
      }
    }
    return { holds: true };
  };

  // Open planning modal
  const handleOpenPlanModalForSlot = (dateStr: string, slotKey: string) => {
    setTargetDateStr(dateStr);
    setTargetMealTime(slotKey);
    setSelectedDishId('');
    setRestrictionError(null);
    setOpenModal(true);
  };

  // Save selection
  const handleSavePlanning = async () => {
    if (!selectedDishId) return;

    // Check restriction
    const check = checkSevenDayRestriction(selectedDishId, targetDateStr);
    if (!check.holds) {
      setRestrictionError(check.reason || 'Systeem fout: Kan dit gerecht niet plannen binnen 7 dagen.');
      return;
    }

    try {
      if (onAddPlannedMeal) {
        await onAddPlannedMeal({
          dishId: selectedDishId,
          plannedDate: targetDateStr,
          mealTime: targetMealTime
        });
      } else {
        await MealDatabase.addPlannedMeal({
          dishId: selectedDishId,
          plannedDate: targetDateStr,
          mealTime: targetMealTime
        });
      }
      setOpenModal(false);
    } catch (e) {
      setRestrictionError('Mogelijk geen rechten of netwerk error bij het opslaan.');
    }
  };

  // Delete planning click handler
  const handleDeletePlanningClick = (id: string) => {
    setMealIdToDelete(id);
    setDeleteConfirmOpen(true);
  };

  // Confirm delete handler
  const handleConfirmDelete = async () => {
    if (mealIdToDelete) {
      try {
        if (onDeletePlannedMeal) {
          await onDeletePlannedMeal(mealIdToDelete);
        } else {
          await MealDatabase.deletePlannedMeal(mealIdToDelete);
        }
      } catch (e) {
        console.error('Fout bij het verwijderen:', e);
      } finally {
        setMealIdToDelete(null);
        setDeleteConfirmOpen(false);
      }
    }
  };

  // Format header strings
  const formatDateHeader = (d: Date): string => {
    return `${d.getDate()} ${DUTCH_MONTHS[d.getMonth()]}`;
  };

  const weekStartStr = formatDateHeader(weekDates[0]);
  const weekEndStr = formatDateHeader(weekDates[6]);

  return (
    <Box sx={{ width: '100%', py: 1, px: 1 }}>
      
      {/* Calendar Header Row */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2, mb: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Weekplanner
        </Typography>

        {/* Calendar Controllers */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Button
            size="small"
            variant="text"
            onClick={handleCurrentWeek}
            sx={{ fontWeight: 800, textTransform: 'none', color: '#8F4E00', backgroundColor: 'rgba(143,78,0,0.05)', px: 2 }}
          >
            Deze week
          </Button>
          <IconButton onClick={handlePrevWeek} size="small" sx={{ color: '#8F4E00' }}>
            <ChevronLeft size={20} />
          </IconButton>
          <IconButton onClick={handleNextWeek} size="small" sx={{ color: '#8F4E00' }}>
            <ChevronRight size={20} />
          </IconButton>
        </Box>
      </Box>

      {/* Week Title Range display */}
      <Typography variant="h6" sx={{ mb: 3, textAlign: 'center', fontWeight: '800', color: '#8F4E00' }}>
        {weekStartStr} t/m {weekEndStr}
      </Typography>

      {/* Weekly Grid container mapping */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {weekDates.map((date) => {
          const formattedDateStr = formatDateString(date);
          const mealsForDay = plannedMeals.filter((meal) => meal.plannedDate === formattedDateStr);
          
          const isDayToday = formatDateString(today) === formattedDateStr;
          const dayOfWeekName = DUTCH_DAYS[date.getDay()];
          const formattedDutchDate = `${date.getDate()} ${DUTCH_MONTHS[date.getMonth()]}`;

          return (
            <Box key={formattedDateStr}>
              <Card
                sx={{
                  border: isDayToday ? '2px solid #8F4E00' : '1px solid #F0E0D6',
                  backgroundColor: isDayToday ? '#FEF7F3' : '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: '0px 4px 12px rgba(143, 78, 0, 0.05)',
                  },
                }}
              >
                <CardContent sx={{ p: '16px !important' }}>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'flex-start' }, gap: 2 }}>
                    
                    {/* Day description label */}
                    <Box
                      sx={{
                        width: { xs: '100%', md: '20%' },
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: { xs: 'row', md: 'column' },
                        alignItems: { xs: 'center', md: 'flex-start' },
                        justifyContent: 'space-between',
                        pr: { md: 2 },
                        borderRight: { md: '1px solid #F0E0D6' },
                        pb: { xs: 1, md: 0 },
                        borderBottom: { xs: '1px solid #F0E0D6', md: 'none' }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: isDayToday ? '#8F4E00' : '#311300', fontSize: '1.15rem' }}>
                          {dayOfWeekName}
                        </Typography>
                        {isDayToday && (
                          <Chip
                            label="Vandaag"
                            size="small"
                            sx={{
                              height: 18,
                              fontWeight: 800,
                              backgroundColor: '#FFDCC0',
                              color: '#8F4E00',
                              fontSize: '0.65rem',
                            }}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#8F4E00' }}>
                        {formattedDutchDate}
                      </Typography>
                    </Box>

                    {/* Meal planned slots column */}
                    <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {CALENDAR_SLOTS.map((slot) => {
                        const meal = mealsForDay.find((m) => (m.mealTime || 'avond') === slot.key);
                        const dishPlanned = meal ? dishes.find((d) => d.id === meal.dishId) : null;
                        const isHighlighted = initialFocusDate === formattedDateStr && highlightedSlot?.slot === slot.key;

                        if (dishPlanned) {
                          return (
                            <Box
                              component={motion.div}
                              id={`slot-${formattedDateStr}-${slot.key}`}
                              key={slot.key}
                              initial={isHighlighted ? { scale: 0.95, boxShadow: '0, 0, 0, 0 rgba(143, 78, 0, 0)' } : undefined}
                              animate={isHighlighted ? {
                                scale: [0.95, 1.03, 1.0, 1.03, 1.0],
                                borderColor: ['#8F4E00', '#ffdf7a', '#8F4E00', '#ffdf7a', '#8F4E00'],
                                backgroundColor: ['#FEF7F3', '#FFDCC0', '#FEF7F3', '#FFDCC0', '#FEF7F3'],
                                boxShadow: [
                                  '0px 0px 0px rgba(143, 78, 0, 0)',
                                  '0px 0px 18px rgba(143, 78, 0, 0.4)',
                                  '0px 0px 0px rgba(143, 78, 0, 0)',
                                  '0px 0px 18px rgba(143, 78, 0, 0.4)',
                                  '0px 0px 0px rgba(143, 78, 0, 0)'
                                ]
                              } : undefined}
                              transition={isHighlighted ? { duration: 2.2, ease: 'easeInOut' } : undefined}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                p: 1.2,
                                borderRadius: '12px',
                                border: isHighlighted
                                  ? '2px solid #8F4E00'
                                  : `1px solid ${slot.highlight ? 'rgba(143, 78, 0, 0.18)' : 'rgba(0,0,0,0.06)'}`,
                                backgroundColor: isHighlighted ? '#FFF0E5' : (slot.highlight ? '#FEF7F3' : '#ffffff'),
                                transition: 'border-color 0.15s ease, background-color 0.15s ease'
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                                {/* Slot Type Label badge */}
                                <Chip
                                  label={slot.label}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.7rem',
                                    fontWeight: 900,
                                    backgroundColor: slot.lightColor,
                                    color: slot.color,
                                    border: `1px solid rgba(${parseInt(slot.color.slice(1,3), 16)}, ${parseInt(slot.color.slice(3,5), 16)}, ${parseInt(slot.color.slice(5,7), 16)}, 0.12)`,
                                    flexShrink: 0
                                  }}
                                />

                                {dishPlanned.imageUrl ? (
                                  <Avatar
                                    src={dishPlanned.imageUrl}
                                    variant="rounded"
                                    sx={{ width: 40, height: 40, borderRadius: '8px', border: '1px solid #F0E0D6' }}
                                  />
                                ) : (
                                  <Avatar
                                    variant="rounded"
                                    sx={{ width: 40, height: 40, borderRadius: '8px', backgroundColor: '#FFDCC0', color: '#8F4E00', fontSize: '0.8rem', fontWeight: 900 }}
                                  >
                                    {dishPlanned.name.substring(0, 2).toUpperCase()}
                                  </Avatar>
                                )}

                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#311300', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {dishPlanned.name}
                                  </Typography>
                                  {dishPlanned.cuisine && (
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.7rem', display: 'block' }}>
                                      {dishPlanned.cuisine}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>

                              <IconButton
                                color="error"
                                onClick={() => handleDeletePlanningClick(meal!.id)}
                                size="small"
                                sx={{
                                  backgroundColor: 'rgba(211, 47, 47, 0.04)',
                                  '&:hover': { backgroundColor: 'rgba(211, 47, 47, 0.12)' },
                                  p: 0.6
                                }}
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            </Box>
                          );
                        } else {
                          // Unplanned empty slot
                          return (
                            <Box
                              key={slot.key}
                              onClick={() => handleOpenPlanModalForSlot(formattedDateStr, slot.key)}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                p: 1,
                                px: 1.5,
                                borderRadius: '12px',
                                border: `1px dashed ${slot.highlight ? 'rgba(143, 78, 0, 0.22)' : 'rgba(0,0,0,0.08)'}`,
                                backgroundColor: slot.highlight ? 'rgba(143, 78, 0, 0.01)' : 'rgba(0,0,0,0.01)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  borderColor: slot.color,
                                  backgroundColor: slot.lightColor,
                                  transform: 'translateX(4px)'
                                }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 900, color: slot.color, width: 80, display: 'inline-block' }}>
                                  {slot.label}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem', fontStyle: 'italic', fontWeight: 600 }}>
                                  + Inplannen...
                                </Typography>
                              </Box>
                              <Plus size={14} style={{ color: slot.color, opacity: 0.8 }} />
                            </Box>
                          );
                        }
                      })}
                    </Box>

                  </Box>
                </CardContent>
              </Card>
            </Box>
          );
        })}
      </Box>

      {/* ADD MEAL TO CALENDAR MODAL DIALOG */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="xs"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '24px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1, textTransform: 'uppercase', fontSize: '1rem', letterSpacing: '0.05em', color: '#8F4E00' }}>
          Gerecht Inplannen
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Kies een lekker gerecht uit de kookboeken om te maken voor de gekozen datum.
          </Typography>

          {restrictionError && (
            <Alert severity="error" icon={<AlertCircle size={18} />} sx={{ mb: 3, borderRadius: '12px' }}>
              {restrictionError}
            </Alert>
          )}

          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel id="select-slot-label">Maaltijd moment</InputLabel>
            <Select
              labelId="select-slot-label"
              value={targetMealTime}
              label="Maaltijd moment"
              onChange={(e) => {
                setTargetMealTime(e.target.value);
              }}
              sx={{ borderRadius: '12px' }}
            >
              <MenuItem value="ontbijt">Ontbijt</MenuItem>
              <MenuItem value="middag">Middag</MenuItem>
              <MenuItem value="avond">Avond</MenuItem>
              <MenuItem value="tussendoor">Tussendoor</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="select-dish-label">Selecteer maaltijd</InputLabel>
            <Select
              labelId="select-dish-label"
              value={selectedDishId}
              label="Selecteer maaltijd"
              onChange={(e) => {
                setSelectedDishId(e.target.value);
                setRestrictionError(null);
              }}
              sx={{ borderRadius: '12px' }}
            >
              {dishes.length === 0 ? (
                <MenuItem disabled value="">
                  Geen gerechten toegevoegd
                </MenuItem>
              ) : (
                dishes.map((dish) => (
                  <MenuItem key={dish.id} value={dish.id}>
                    {dish.name} {dish.cuisine ? `(${dish.cuisine})` : ''}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setOpenModal(false)}
            variant="text"
            sx={{ color: 'text.secondary', fontWeight: 700 }}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleSavePlanning}
            variant="contained"
            color="primary"
            disabled={!selectedDishId}
            sx={{ borderRadius: '12px', px: 3, fontWeight: 800 }}
          >
            Inplannen
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE MEAL CONFIRMATION DIALOG */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '24px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1, textTransform: 'uppercase', fontSize: '1rem', letterSpacing: '0.05em', color: '#8F4E00' }}>
          Gerecht Verwijderen
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Weet je zeker dat je deze maaltijd planning wilt verwijderen van de kalender?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setDeleteConfirmOpen(false)}
            variant="text"
            sx={{ color: 'text.secondary', fontWeight: 700 }}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            sx={{ borderRadius: '12px', px: 3, fontWeight: 800 }}
          >
            Verwijderen
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
