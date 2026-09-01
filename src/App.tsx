/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  IconButton,
  Chip,
  Avatar,
  CssBaseline,
  Alert,
  Snackbar,
} from '@mui/material';
import { ChefHat, List, Plus, Settings, UserCheck, Calendar as CalendarIcon, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { appTheme } from './theme';
import { MealDatabase } from './lib/db';
import { Dish, Rating, Member, TabValue, PlannedMeal } from './types';

// Child components
import ProfilePicker, { getAvatarColor, avatarIconsMap } from './components/ProfilePicker';
import SpinWheel from './components/SpinWheel';
import DishList from './components/DishList';
import AddDishForm from './components/AddDishForm';
import SettingsPanel from './components/SettingsPanel';
import CalendarView from './components/CalendarView';
import ShoppingList from './components/ShoppingList';

export default function App() {
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>('home');

  // Highlight and focus states for Calendar redirects
  const [calendarFocusDate, setCalendarFocusDate] = useState<string | null>(null);
  const [calendarHighlightSlot, setCalendarHighlightSlot] = useState<{ date: string; slot: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Unified global shared datastore state
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ratingsMap, setRatingsMap] = useState<{ [dishId: string]: Rating[] }>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);

  // Check LocalStorage for active user on boot
  useEffect(() => {
    const savedUser = localStorage.getItem('we_active_user');
    if (savedUser) {
      setActiveProfile(savedUser);
    }
  }, []);

  // Set active user profile and persist in LocalStorage
  const handleSelectProfile = (name: string) => {
    setActiveProfile(name);
    localStorage.setItem('we_active_user', name);
  };

  const handleLogout = () => {
    setActiveProfile(null);
    localStorage.removeItem('we_active_user');
    setActiveTab('home');
  };

  // Real-time synchronization subscriptions
  useEffect(() => {
    if (!activeProfile) return;

    // Subscriptions to live models
    const unsubDishes = MealDatabase.subscribeDishes((fetchedDishes) => {
      setDishes(fetchedDishes);
    });

    const unsubRatings = MealDatabase.subscribeAllRatings((fetchedRatings) => {
      setRatingsMap(fetchedRatings);
    });

    const unsubMembers = MealDatabase.subscribeMembers((fetchedMembers) => {
      setMembers(fetchedMembers);
    });

    const unsubPlanned = MealDatabase.subscribePlannedMeals((fetchedPlanned) => {
      setPlannedMeals(fetchedPlanned);
    });

    return () => {
      unsubDishes();
      unsubRatings();
      unsubMembers();
      unsubPlanned();
    };
  }, [activeProfile]);

  // Hook triggered when a dish is decided by the wheel to immediately shift tab focus and celebrate
  const handleWinnerCelebrated = async (dish: Dish, selectedDateStr?: string, mealTime?: string) => {
    if (selectedDateStr) {
      try {
        const id = await MealDatabase.addPlannedMeal({
          dishId: dish.id,
          plannedDate: selectedDateStr,
          mealTime: mealTime || 'avond'
        });
        setPlannedMeals(prev => {
          if (prev.some(p => p.id === id)) return prev;
          return [...prev, {
            id,
            dishId: dish.id,
            plannedDate: selectedDateStr,
            mealTime: mealTime || 'avond',
            createdAt: new Date()
          }];
        });

        // Trigger toast and set focus on calendar for highlight
        const d = new Date(selectedDateStr + 'T12:00:00');
        const dutchWeekDays = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
        const weekDay = dutchWeekDays[d.getDay()];
        
        setToastMessage(`"${dish.name}" ingepland op ${weekDay}`);
        setCalendarFocusDate(selectedDateStr);
        setCalendarHighlightSlot({ date: selectedDateStr, slot: mealTime || 'avond' });
      } catch (err) {
        console.error("Error creating auto plan:", err);
      }
    }
    // Jump to the calendar tab to show scheduled dinner
    setActiveTab('calendar');
  };

  // Profile picker full-screen shield
  if (!activeProfile) {
    return (
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <ProfilePicker
          onSelectProfile={handleSelectProfile}
          activeProfile={activeProfile}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: 'background.default',
          pb: 11, // space for fixed bottom bar
        }}
      >
        {/* Dynamic header navigation */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #F0E0D6',
            color: 'text.primary',
          }}
        >
          <Container maxWidth="md">
            <Toolbar disableGutters sx={{ justifyContent: 'space-between', px: 1 }}>
              {/* Logo branding brand */}
              <Box
                onClick={() => setActiveTab('home')}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 0, sm: 1.5 },
                  cursor: 'pointer',
                  '&:active': { transform: 'scale(0.975)' },
                  transition: 'transform 0.1s ease',
                }}
              >
                <Box
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1,
                    borderRadius: 3,
                    backgroundColor: '#FFDCC0',
                    color: '#8F4E00',
                  }}
                >
                  <ChefHat size={22} strokeWidth={2.5} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif', fontSize: { xs: '1.25rem', sm: '1.55rem' }, letterSpacing: '-0.04em', color: '#8F4E00' }}>
                  Wat eten we?
                </Typography>
              </Box>

              {/* Profile Pill & Settings Action Button */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(() => {
                  const activeMemberObj = members.find(m => m.name.toLowerCase() === activeProfile?.toLowerCase());
                  const IconComp = activeMemberObj?.avatarIcon ? avatarIconsMap[activeMemberObj.avatarIcon] : null;
                  const bgColor = activeMemberObj?.avatarColor || (activeProfile ? getAvatarColor(activeProfile) : '#8F4E00');
                  
                  return (
                    <Chip
                      avatar={
                        <Avatar
                          sx={{
                            backgroundColor: bgColor,
                            color: '#ffffff !important',
                            fontWeight: 'bold',
                            width: 24,
                            height: 24,
                            fontSize: '0.65rem'
                          }}
                        >
                          {IconComp ? (
                            <IconComp size={12} strokeWidth={2.5} />
                          ) : (
                            activeMemberObj?.avatarLetter || activeProfile?.charAt(0).toUpperCase()
                          )}
                        </Avatar>
                      }
                      label={
                        <Box component="span">
                          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Aan tafel: </Box>
                          {activeProfile}
                        </Box>
                      }
                      sx={{
                        fontWeight: 700,
                        backgroundColor: '#FFDCC0',
                        border: '1px solid #F0E0D6',
                        color: '#311300',
                        display: 'flex',
                        alignItems: 'center',
                        pl: 0.5
                      }}
                    />
                  );
                })()}
                
                <IconButton
                  onClick={() => setActiveTab('settings')}
                  sx={{
                    backgroundColor: activeTab === 'settings' ? '#FFDCC0' : 'transparent',
                    color: activeTab === 'settings' ? '#8F4E00' : 'text.secondary',
                    '&:hover': { backgroundColor: '#FFDCC0', opacity: 0.85 },
                    border: '1px solid #F0E0D6',
                  }}
                  size="small"
                >
                  <Settings size={18} />
                </IconButton>
              </Box>
            </Toolbar>
          </Container>
        </AppBar>

        {/* Tab view containers with transition animations */}
        <Container maxWidth="md" sx={{ mt: 3, px: 2 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
            >
              <Box sx={{ pb: 3 }}>
                {activeTab === 'home' && (
                  <SpinWheel
                    dishes={dishes}
                    ratingsMap={ratingsMap}
                    plannedMeals={plannedMeals}
                    onCelebrate={handleWinnerCelebrated}
                  />
                )}
                {activeTab === 'dishes' && (
                  <DishList
                    dishes={dishes}
                    ratingsMap={ratingsMap}
                    members={members}
                    activeProfile={activeProfile}
                  />
                )}
                {activeTab === 'calendar' && (
                  <CalendarView
                    dishes={dishes}
                    plannedMeals={plannedMeals}
                    activeProfile={activeProfile || ''}
                    initialFocusDate={calendarFocusDate}
                    highlightedSlot={calendarHighlightSlot}
                    onClearHighlight={() => {
                      setCalendarFocusDate(null);
                      setCalendarHighlightSlot(null);
                    }}
                    onAddPlannedMeal={async (meal) => {
                      const id = await MealDatabase.addPlannedMeal(meal);
                      setPlannedMeals(prev => {
                        if (prev.some(p => p.id === id)) return prev;
                        return [...prev, {
                          id,
                          ...meal,
                          createdAt: new Date()
                        }];
                      });

                      // Trigger toast for manual calendar adds
                      const targetDish = dishes.find(d => d.id === meal.dishId);
                      const d = new Date(meal.plannedDate + 'T12:00:00');
                      const dutchWeekDays = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
                      const weekDay = dutchWeekDays[d.getDay()];
                      const dishName = targetDish ? targetDish.name : 'Gerecht';
                      
                      setToastMessage(`"${dishName}" ingepland op ${weekDay}`);
                      setCalendarFocusDate(meal.plannedDate);
                      setCalendarHighlightSlot({ date: meal.plannedDate, slot: meal.mealTime });
                      return id;
                    }}
                    onDeletePlannedMeal={async (id) => {
                      await MealDatabase.deletePlannedMeal(id);
                      setPlannedMeals(prev => prev.filter(m => m.id !== id));
                    }}
                  />
                )}
                {activeTab === 'add' && (
                  <AddDishForm
                    activeProfile={activeProfile}
                    onSuccess={() => setActiveTab('dishes')}
                  />
                )}
                {activeTab === 'shopping' && (
                  <ShoppingList
                    activeProfile={activeProfile || 'Gast'}
                  />
                )}
                {activeTab === 'settings' && (
                  <SettingsPanel
                    activeProfile={activeProfile}
                    members={members}
                    onSwitchProfile={handleSelectProfile}
                    onLogout={handleLogout}
                  />
                )}
              </Box>
            </motion.div>
          </AnimatePresence>
        </Container>

        {/* Fixed Bottom Navigation Area */}
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            boxShadow: '0px -4px 20px rgba(46, 30, 26, 0.03)',
            borderRadius: '24px 24px 0 0',
            overflow: 'hidden',
          }}
          elevation={3}
        >
          <BottomNavigation
            value={activeTab === 'settings' ? false : activeTab}
            onChange={(event, newValue: TabValue) => {
              setActiveTab(newValue);
              if (newValue !== 'calendar') {
                setCalendarFocusDate(null);
                setCalendarHighlightSlot(null);
              }
            }}
            showLabels
          >
            <BottomNavigationAction
              label="Rad"
              value="home"
              icon={<ChefHat size={20} />}
            />
            <BottomNavigationAction
              label="Gerechten"
              value="dishes"
              icon={<List size={20} />}
            />
            <BottomNavigationAction
              label="Kalender"
              value="calendar"
              icon={<CalendarIcon size={20} />}
            />
            <BottomNavigationAction
              label="Lijstje"
              value="shopping"
              icon={<ShoppingBag size={20} />}
            />
            <BottomNavigationAction
              label="Voeg toe"
              value="add"
              icon={<Plus size={20} />}
            />
          </BottomNavigation>
        </Paper>

        {/* Global Success Toast Notification */}
        <Snackbar
          open={Boolean(toastMessage)}
          autoHideDuration={4500}
          onClose={() => setToastMessage(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{ zIndex: 1400 }}
        >
          <Alert 
            onClose={() => setToastMessage(null)} 
            severity="success" 
            variant="filled"
            sx={{ 
              width: '100%', 
              borderRadius: '16px', 
              fontWeight: 800, 
              backgroundColor: '#8F4E00', 
              color: '#ffffff', 
              boxShadow: '0px 8px 24px rgba(143, 78, 0, 0.25)' 
            }}
          >
            {toastMessage}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
