/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  Card,
  IconButton,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Volume2, VolumeX, ChefHat, Calendar, Sparkles, Clock } from 'lucide-react';
import { Dish, Rating, PlannedMeal } from '../types';

interface SpinWheelProps {
  dishes: Dish[];
  ratingsMap: { [dishId: string]: Rating[] };
  plannedMeals: PlannedMeal[];
  onCelebrate: (dish: Dish, selectedDateStr?: string, mealTime?: string) => void;
}

// Slice color palette (playful, appetizing, high-contrast)
const sliceColors = [
  '#8F4E00', // Warm Bronze/Amber
  '#5a7862', // Sage Green
  '#f2d06b', // Muted Banana
  '#f28f3b', // Muted Apricot
  '#a36a5a', // Warm Cocoa
  '#d6b896', // Sand Rose
  '#395240', // Deep Forest Green
  '#cf735c', // Pale Terracotta
];

const DUTCH_DAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const DUTCH_MONTHS = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'
];

const mapMomentToSlot = (moment: string): string => {
  switch (moment) {
    case 'Ontbijt':
      return 'ontbijt';
    case 'Koud eten':
      return 'middag';
    case 'Warm eten':
      return 'avond';
    case 'Vieruurtje':
    case 'Voorgerecht':
    case 'Aperitief':
    default:
      return 'tussendoor';
  }
};

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

// Lazy-initialized shared AudioContext
let sharedAudioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(e => console.warn("AudioContext resume failed", e));
  }
  return sharedAudioCtx;
};

export default function SpinWheel({ dishes, ratingsMap, plannedMeals, onCelebrate }: SpinWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const isSpinningRef = useRef(false);
  const [openWinnerModal, setOpenWinnerModal] = useState(false);
  const [winner, setWinner] = useState<Dish | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedMoment, setSelectedMoment] = useState<string>('Warm eten');
  const [maxPrepTime, setMaxPrepTime] = useState<number | 'all'>('all');

  // Date selection states
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Winner planning selection states
  const [winnerPlannedDate, setWinnerPlannedDate] = useState<string>('');
  const [winnerMealTime, setWinnerMealTime] = useState<string>('avond');

  // Synchronization hook to pre-populate selection in winner dialog
  useEffect(() => {
    if (openWinnerModal) {
      setWinnerPlannedDate(selectedDate);
      setWinnerMealTime(mapMomentToSlot(selectedMoment === 'all' ? 'Warm eten' : selectedMoment));
    }
  }, [openWinnerModal, selectedDate, selectedMoment]);

  // Target needle wiggle refs and dynamics
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 340, height: 340 });

  // Physics and Animation values (stored in refs to avoid React re-render lag)
  const rotationRef = useRef(0);
  const angularVelocityRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);
  
  // Track needle wiggle for tick satisfaction
  const [needleWiggle, setNeedleWiggle] = useState(0);
  const lastPegIndexRef = useRef<number>(-1);

  // Confetti particles array
  const confettiRef = useRef<ConfettiParticle[]>([]);

  // Check 7 days range logic in SpinWheel
  const isDishEligible = (dishId: string, targetDateStr: string): boolean => {
    const targetDate = new Date(targetDateStr + 'T12:00:00');
    for (const meal of plannedMeals) {
      if (meal.dishId === dishId) {
        const plannedDate = new Date(meal.plannedDate + 'T12:00:00');
        const diffTime = Math.abs(targetDate.getTime() - plannedDate.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
          return false;
        }
      }
    }
    return true;
  };

  const isDishMatchingMoment = (dish: Dish, momentFilter: string): boolean => {
    if (momentFilter === 'all') return true;
    const moments = dish.suitableMoments || [];
    if (moments.length === 0) {
      return momentFilter === 'Warm eten';
    }
    return moments.includes(momentFilter);
  };

  const isDishMatchingPrepTime = (dish: Dish, maxPrep: number | 'all'): boolean => {
    if (maxPrep === 'all') return true;
    const pTime = dish.prepTime;
    if (pTime === undefined || pTime === null) return false;
    return pTime <= maxPrep;
  };

  const activeDishesForWheel = dishes
    .filter(d => isDishEligible(d.id, selectedDate))
    .filter(d => isDishMatchingMoment(d, selectedMoment))
    .filter(d => isDishMatchingPrepTime(d, maxPrepTime));

  const lockedDishes = dishes
    .filter(d => !isDishEligible(d.id, selectedDate))
    .filter(d => isDishMatchingMoment(d, selectedMoment))
    .filter(d => isDishMatchingPrepTime(d, maxPrepTime));

  // Resize handler using standard ResizeObserver as mandated in guidelines
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        let size = Math.min(entry.contentRect.width - 24, 380);
        if (size < 280) size = 280;
        setDimensions({ width: size, height: size });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute weights for the dishes (using average scores on 1-10 scale)
  const getDishWeightAndScore = (dish: Dish) => {
    const dishRatings = ratingsMap[dish.id] || [];
    if (dishRatings.length === 0) {
      return { score: 'Geen ratings', weight: 5, numScore: 5 }; // default is 5 (middle score of 1-10)
    }
    const sum = dishRatings.reduce((acc, r) => acc + r.score, 0);
    const avg = sum / dishRatings.length;
    return { score: avg.toFixed(1) + ' / 10', weight: avg, numScore: avg };
  };

  const weightedDishes = activeDishesForWheel.map((dish) => {
    const { score, weight, numScore } = getDishWeightAndScore(dish);
    return {
      dish,
      weight,
      scoreText: score,
      numScore
    };
  });

  const totalWeight = weightedDishes.reduce((acc, curr) => acc + curr.weight, 0);

  // Synthesize custom synth tick sound for peg crossings (Veblen acoustics)
  const playTickSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = getAudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, audioCtx.currentTime); // Crisp high pitch tick
      osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.04);
      
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
      // Ignore blocked audio contexts
    }
  };

  // Upgraded custom ascending arpeggio for victory chime!
  const playVictorySound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = getAudioContext();
      const now = audioCtx.currentTime;
      
      const playTone = (freq: number, start: number, duration: number, type: 'sine' | 'triangle' | 'sawtooth' = 'sine', volume = 0.1) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0.0, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };

      // Play beautiful game-show arpeggio
      const v = 0.08;
      playTone(261.63, now, 0.35, 'triangle', v); // C4
      playTone(329.63, now + 0.12, 0.35, 'triangle', v); // E4
      playTone(392.00, now + 0.24, 0.35, 'triangle', v); // G4
      playTone(523.25, now + 0.36, 0.7, 'sine', v * 1.5); // C5 silver bell
      playTone(659.25, now + 0.48, 0.9, 'sine', v * 1.2); // E5 sparkles
    } catch (e) {
      console.warn("Victory sound playing failed:", e);
    }
  };

  // Redraw the wheel canvas whenever dimensions or selection variables change
  useEffect(() => {
    drawWheel();
  }, [dimensions, dishes, ratingsMap, selectedDate, plannedMeals, selectedMoment, maxPrepTime]);

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = dimensions.width;
    const height = dimensions.height;
    
    // Scale for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;

    ctx.clearRect(0, 0, width, height);

    if (dishes.length === 0) {
      // Draw placeholder
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 15, 0, 2 * Math.PI);
      ctx.fillStyle = '#FEF7F3';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#8F4E00';
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#a36a5a';
      ctx.font = 'bold 15px "Outfit"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Voeg gerechten toe', centerX, centerY - 10);
      ctx.fillText('om aan het rad te draaien!', centerX, centerY + 15);
      return;
    }

    if (activeDishesForWheel.length === 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 15, 0, 2 * Math.PI);
      ctx.fillStyle = '#FEF7F3';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#d32f2f';
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#d32f2f';
      ctx.font = 'bold 13px "Outfit"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Geen gerechten over!', centerX, centerY - 15);
      ctx.fillText('Alles gepland binnen 7 dagen.', centerX, centerY + 5);
      ctx.fillText('Kies een andere datum.', centerX, centerY + 25);
      return;
    }

    // Outer shadow ring
    ctx.shadowColor = 'rgba(46, 30, 26, 0.12)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2e1e1a';
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(143, 78, 0, 0.25)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 6, 0, 2 * Math.PI);
    ctx.stroke();

    // Slices drawing
    let currentAngle = rotationRef.current;

    weightedDishes.forEach((item, index) => {
      const sliceAngle = (item.weight / totalWeight) * 2 * Math.PI;
      const endAngle = currentAngle + sliceAngle;
      const color = sliceColors[index % sliceColors.length];

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius - 8, currentAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.stroke();

      // Text labels inside slices
      const numDishes = weightedDishes.length;
      const shouldDrawText = numDishes <= 36;
      let fontSize = 13;
      if (numDishes > 24) {
        fontSize = 8;
      } else if (numDishes > 16) {
        fontSize = 10;
      } else if (numDishes > 10) {
        fontSize = 12;
      }

      if (shouldDrawText) {
        ctx.save();
        ctx.translate(centerX, centerY);
        const labelAngle = currentAngle + sliceAngle / 2;
        ctx.rotate(labelAngle);

        ctx.fillStyle = index % sliceColors.length === 2 ? '#2e1e1a' : '#ffffff';
        ctx.font = `bold ${fontSize}px "Outfit"`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        const maxTextWidth = radius * 0.65;
        let text = item.dish.name;
        if (ctx.measureText(text).width > maxTextWidth) {
          while (ctx.measureText(text + '...').width > maxTextWidth) {
            text = text.slice(0, -1);
          }
          text = text + '...';
        }

        ctx.fillText(text, radius - 20, 0);
        ctx.restore();
      }

      currentAngle = endAngle;
    });

    // Gold outer pegs at partition boundaries
    let pegAngle = rotationRef.current;
    weightedDishes.forEach((item) => {
      const sliceAngle = (item.weight / totalWeight) * 2 * Math.PI;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(pegAngle);
      
      ctx.beginPath();
      ctx.arc(radius - 12, 0, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffdf7a';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#2e1e1a';
      ctx.stroke();
      
      ctx.restore();
      pegAngle += sliceAngle;
    });

    // Center Golden Hub buttons
    ctx.beginPath();
    ctx.arc(centerX, centerY, 24, 0, 2 * Math.PI);
    ctx.fillStyle = '#2e1e1a';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 18, 0, 2 * Math.PI);
    ctx.fillStyle = '#8F4E00';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Render Confetti Particles on top!
    if (confettiRef.current.length > 0) {
      confettiRef.current.forEach((p) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });
      ctx.globalAlpha = 1.0;
    }
  };

  const animateWheel = () => {
    // Satisfying slow dampening decay curve
    angularVelocityRef.current *= 0.984;
    
    const prevRot = rotationRef.current;
    rotationRef.current += angularVelocityRef.current;
    const currRot = rotationRef.current;

    // Needle pointer tick check using precise mathematical floor-crossing at the pointer (1.5 * Math.PI)
    let crossed = false;
    
    let currentAccumAngle = 0;
    for (let index = 0; index < weightedDishes.length; index++) {
      const sliceAngle = (weightedDishes[index].weight / totalWeight) * 2 * Math.PI;
      const pegOffset = currentAccumAngle;
      
      const prevCrossCount = Math.floor((prevRot + pegOffset - 1.5 * Math.PI) / (2 * Math.PI));
      const currCrossCount = Math.floor((currRot + pegOffset - 1.5 * Math.PI) / (2 * Math.PI));
      
      if (currCrossCount > prevCrossCount) {
        crossed = true;
      }
      currentAccumAngle += sliceAngle;
    }

    if (crossed) {
      playTickSound();
      // Elastic peg contact force proportional to spin speed
      setNeedleWiggle(Math.min(22, 6 + angularVelocityRef.current * 35));
    } else {
      // Underdamped pendulum spring decay
      setNeedleWiggle(prev => {
        // Stop wiggling when the values are sub-pixel/sub-degree tiny
        if (Math.abs(prev) < 0.05) return 0;
        return prev * -0.76;
      });
    }

    // safety wrap wrapped rotation
    rotationRef.current %= 2 * Math.PI;

    // Update active confetti particles
    if (confettiRef.current.length > 0) {
      confettiRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gravity factor
        p.vx *= 0.98; // air resistance
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.011; // slow fading rate
      });
      confettiRef.current = confettiRef.current.filter(p => p.opacity > 0);
    }

    drawWheel();

    if (angularVelocityRef.current < 0.001) {
      // Spinning finished
      const wasSpinning = isSpinningRef.current;
      if (wasSpinning) {
        setIsSpinning(false);
        isSpinningRef.current = false;
        angularVelocityRef.current = 0;
        
        // Populate brilliant exploding particles
        triggerBurstConfetti();
        playVictorySound();
      }

      // If confetti is still rendering, continue the loop
      if (confettiRef.current.length > 0) {
        animationFrameIdRef.current = requestAnimationFrame(animateWheel);
      } else {
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
      }

      if (wasSpinning) {
        // Calculate the winner position
        const normalizedRot = rotationRef.current % (2 * Math.PI);
        let targetLocal = (1.5 * Math.PI - normalizedRot) % (2 * Math.PI);
        if (targetLocal < 0) targetLocal += 2 * Math.PI;

        let cumulative = 0;
        let winningWrap = weightedDishes[0];
        for (let i = 0; i < weightedDishes.length; i++) {
          const sliceAngle = (weightedDishes[i].weight / totalWeight) * 2 * Math.PI;
          if (targetLocal >= cumulative && targetLocal < cumulative + sliceAngle) {
            winningWrap = weightedDishes[i];
            break;
          }
          cumulative += sliceAngle;
        }
        setWinner(winningWrap.dish);
        setOpenWinnerModal(true);
      }
    } else {
      animationFrameIdRef.current = requestAnimationFrame(animateWheel);
    }
  };

  const triggerBurstConfetti = () => {
    const colors = ['#FF6B6B', '#4D96FF', '#6BCB77', '#FFD93D', '#FF8B13', '#E04DB0', '#9A0680', '#FF55BB'];
    const pArray: ConfettiParticle[] = [];
    const count = 120;
    const canvasW = dimensions.width;
    const canvasH = dimensions.height;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const speed = Math.random() * 7 + 3.5;
      pArray.push({
        x: canvasW / 2,
        y: canvasH / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5, // explosion boost
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 7 + 4.5,
        rotation: Math.random() * 2 * Math.PI,
        rotationSpeed: Math.random() * 0.16 - 0.08,
        opacity: 1.0
      });
    }
    confettiRef.current = pArray;
  };

  const startSpin = () => {
    if (activeDishesForWheel.length === 0 || isSpinningRef.current) return;
    
    // Resume audio context safely on click event
    getAudioContext();

    setIsSpinning(true);
    isSpinningRef.current = true;
    confettiRef.current = []; // Clear old confetti
    
    // Satisfying strong initial kick
    angularVelocityRef.current = Math.random() * 0.15 + 0.46; 
    lastPegIndexRef.current = -1;
    
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    animationFrameIdRef.current = requestAnimationFrame(animateWheel);
  };



  const handleConfirmWinner = () => {
    if (winner) {
      onCelebrate(winner, winnerPlannedDate, winnerMealTime);
    }
    setOpenWinnerModal(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 1, gap: 2 }}>
      
      {/* Sound selector & Headings */}
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
          Rad van inspiratie
        </Typography>
        <IconButton
          onClick={() => setSoundEnabled(!soundEnabled)}
          sx={{
            backgroundColor: soundEnabled ? 'rgba(143,78,0,0.06)' : 'rgba(0,0,0,0.04)',
            color: 'primary.main',
            '&:hover': { backgroundColor: 'rgba(143,78,0,0.12)' },
            transition: 'all 0.15s ease'
          }}
          size="small"
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </IconButton>
      </Box>

      {/* Moment Selector */}
      <Box sx={{ width: '100%', px: 2, backgroundColor: '#ffffff', border: '1px solid #F0E0D6', py: 2, borderRadius: '16px' }}>
        <Typography variant="body2" sx={{ fontWeight: 800, color: '#8F4E00', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.75rem' }}>
          Waarvoor wil je aan het rad draaien?
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {[
            { value: 'Warm eten', label: 'Warm eten' },
            { value: 'Ontbijt', label: 'Ontbijt' },
            { value: 'Koud eten', label: 'Lunch / Koud' },
            { value: 'Vieruurtje', label: 'Vieruurtje' },
            { value: 'Voorgerecht', label: 'Voorgerecht' },
            { value: 'Aperitief', label: 'Aperitief' },
            { value: 'all', label: 'Alles' }
          ].map((moment) => {
            const isSelected = selectedMoment === moment.value;
            return (
              <Chip
                key={moment.value}
                label={moment.label}
                onClick={() => {
                  if (!isSpinning) {
                    setSelectedMoment(moment.value);
                  }
                }}
                disabled={isSpinning}
                variant={isSelected ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 750,
                  fontSize: '0.8rem',
                  borderRadius: '12px',
                  px: 0.5,
                  py: 1.8,
                  transition: 'all 0.15s ease',
                  border: isSelected ? '1px solid #8F4E00' : '1px solid #F0E0D6',
                  backgroundColor: isSelected ? '#8F4E00' : 'transparent',
                  color: isSelected ? '#ffffff' : '#8F4E00',
                  '&:hover': {
                    backgroundColor: isSelected ? '#703D00' : 'rgba(143, 78, 0, 0.06)',
                    borderColor: '#8F4E00',
                    transform: 'scale(1.03)'
                  },
                  '&.Mui-disabled': {
                    opacity: 0.6,
                    color: isSelected ? '#ffffff' : '#8F4E00',
                    backgroundColor: isSelected ? '#8F4E00' : 'transparent'
                  }
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Maximale Bereidingstijd Selector */}
      <Box sx={{ width: '100%', px: 2, backgroundColor: '#ffffff', border: '1px solid #F0E0D6', py: 2, borderRadius: '16px' }}>
        <Typography variant="body2" sx={{ fontWeight: 800, color: '#8F4E00', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.75rem' }}>
          <Clock size={16} /> Maximale bereidingstijd
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {[
            { value: 'all', label: 'Alle tijden' },
            { value: 15, label: 'Snel (<= 15 min)' },
            { value: 30, label: 'Gemiddeld (<= 30 min)' },
            { value: 45, label: 'Uitgebreid (<= 45 min)' },
            { value: 60, label: 'Feestelijk (<= 60 min)' }
          ].map((item) => {
            const isSelected = maxPrepTime === item.value;
            return (
              <Chip
                key={String(item.value)}
                label={item.label}
                onClick={() => {
                  if (!isSpinning) {
                    setMaxPrepTime(item.value as number | 'all');
                  }
                }}
                disabled={isSpinning}
                variant={isSelected ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 750,
                  fontSize: '0.8rem',
                  borderRadius: '12px',
                  px: 0.5,
                  py: 1.8,
                  transition: 'all 0.15s ease',
                  border: isSelected ? '1px solid #8F4E00' : '1px solid #F0E0D6',
                  backgroundColor: isSelected ? '#8F4E00' : 'transparent',
                  color: isSelected ? '#ffffff' : '#8F4E00',
                  '&:hover': {
                    backgroundColor: isSelected ? '#703D00' : 'rgba(143, 78, 0, 0.06)',
                    borderColor: '#8F4E00',
                    transform: 'scale(1.03)'
                  },
                  '&.Mui-disabled': {
                    opacity: 0.6,
                    color: isSelected ? '#ffffff' : '#8F4E00',
                    backgroundColor: isSelected ? '#8F4E00' : 'transparent'
                  }
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Date select wrapper */}
      <Box sx={{ width: '100%', px: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2, backgroundColor: '#ffffff', border: '1px solid #F0E0D6', py: 2, borderRadius: '16px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Calendar size={18} style={{ color: '#8F4E00' }} />
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Datum selecteren voor planning:
          </Typography>
        </Box>
        <TextField
          type="date"
          value={selectedDate}
          onChange={(e) => {
            if (!isSpinning) {
              setSelectedDate(e.target.value);
            }
          }}
          disabled={isSpinning}
          size="small"
          slotProps={{ htmlInput: { style: { fontWeight: 700, color: '#311300' } } }}
          sx={{
            width: { xs: '100%', sm: 180 },
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
            }
          }}
        />
      </Box>

      {/* Wheel Stage Area container with premium pulsing layout background glow */}
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pt: 2.5, // 20px top padding to accommodate the needle rotation wiggles without clipping
        }}
      >
        {/* Top Peg Pointer Needle */}
        <Box
          sx={{
            position: 'absolute',
            top: '6px', // position the pivot pin exactly 1px inside the canvas perimeter for natural wheel physics
            left: '50%',
            transform: `translateX(-50%) rotate(${needleWiggle}deg)`,
            transformOrigin: '50% 15px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <svg width="36" height="46" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M18 42L4 16C4 16 5.33333 7.66667 10 5H26C30.6667 7.66667 32 16 32 16L18 42Z"
              fill="#8F4E00"
              stroke="#2e1e1a"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <circle cx="18" cy="15" r="4.5" fill="#ffdf7a" stroke="#2e1e1a" strokeWidth="2" />
          </svg>
        </Box>

        {/* The beautiful canvas wheel itself */}
        <Box
          sx={{
            borderRadius: '50%',
            boxShadow: isSpinning ? 'none' : '0 0 24px rgba(143, 78, 0, 0.08)',
            transition: 'box-shadow 0.3s ease',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: dimensions.width,
              height: dimensions.height,
              display: 'block',
              cursor: isSpinning ? 'not-allowed' : 'pointer',
            }}
            onClick={startSpin}
          />
        </Box>
      </Box>

      {/* Trigger Button spinner */}
      <Button
        variant="contained"
        color="primary"
        size="large"
        fullWidth
        disabled={isSpinning || activeDishesForWheel.length === 0}
        onClick={startSpin}
        sx={{
          maxWidth: 320,
          py: 1.7,
          fontSize: '1.1rem',
          fontWeight: 900,
          borderRadius: '100px',
          boxShadow: isSpinning ? 'none' : '0px 8px 24px rgba(143, 78, 0, 0.2)',
          transition: 'all 0.2s ease',
          '&:active': {
            transform: 'scale(0.96)',
          },
        }}
      >
        {isSpinning ? 'SPANNEND...' : 'LAAT HET RAD BESLISSEN!'}
      </Button>

      {/* Restricted dishes lists */}
      {lockedDishes.length > 0 && (
        <Box sx={{ width: '100%', px: 2, mt: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Tijdelijk uitgesloten ({lockedDishes.length}) - Al gepland binnen 7 dagen:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {lockedDishes.map((ld) => {
              const matchedMeal = plannedMeals.find(pm => pm.dishId === ld.id);
              const formattedDateStr = matchedMeal ? new Date(matchedMeal.plannedDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '';
              return (
                <Chip
                  key={ld.id}
                  label={`${ld.name} (${formattedDateStr})`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(0,0,0,0.04)',
                    textDecoration: 'line-through',
                    color: 'text.secondary',
                    fontWeight: 600,
                    fontSize: '0.75rem'
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {dishes.length === 0 ? (
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary', textAlign: 'center' }}>
          Vul de Dishes-lijst om het rad te voeden!
        </Typography>
      ) : activeDishesForWheel.length === 0 ? (
        <Typography variant="body2" sx={{ mt: 2, color: 'error.main', fontWeight: 600, textAlign: 'center' }}>
          Geen gerechten beschikbaar voor deze datum binnen de 7-dagen regel.
        </Typography>
      ) : (
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', fontSize: '0.8rem' }}>
          * Segmenten zijn groter voor gerechten met hogere scores!
        </Typography>
      )}

      {/* WINNER CELEBRATION MODAL */}
      <Dialog
        open={openWinnerModal}
        onClose={() => setOpenWinnerModal(false)}
        maxWidth="xs"
        fullWidth
        transitionDuration={400}
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 12px 36px rgba(143, 78, 0, 0.16)'
          }
        }}
      >
        <DialogContent sx={{ textAlign: 'center', pt: 2.5, pb: 1, px: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" color="primary" sx={{ fontWeight: 900, mb: 1, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <Sparkles size={14} /> WE HEBBEN EEN WINNAAR! <Sparkles size={14} />
          </Typography>
          
          <Typography variant="h3" sx={{ fontWeight: 950, mb: 1, color: '#311300', letterSpacing: '-0.02em', px: 1, fontSize: { xs: '1.4rem', sm: '1.75rem' } }}>
            {winner?.name}
          </Typography>

          {winner?.cuisine && (
            <Chip
              label={winner.cuisine}
              size="small"
              sx={{ mb: 1.25, fontWeight: 850, backgroundColor: 'rgba(143, 78, 0, 0.08)', color: '#8F4E00', px: 1 }}
            />
          )}

          {winner?.description && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontStyle: 'italic', px: 2, lineHeight: 1.3, fontSize: '0.85rem' }}>
              {winner.description}
            </Typography>
          )}

          <Card variant="outlined" sx={{ py: 1.2, px: 1.5, borderRadius: '12px', backgroundColor: '#FEF7F3', borderColor: '#F0E0D6', mb: 1.5, boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                  Gemid. score
                </Typography>
                <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 900, mt: 0.2, fontSize: '1.1rem' }}>
                  {winner ? getDishWeightAndScore(winner).score : '-'}
                </Typography>
              </Box>
              <Box sx={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#F0E0D6' }} />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                  Ingevoerd door
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#311300', mt: 0.2, fontSize: '1.1rem' }}>
                  {winner?.addedBy}
                </Typography>
              </Box>
            </Box>
          </Card>

          {/* Quick planning in the winner modal */}
          <Box sx={{ mt: 1.5, p: 1.5, border: '1px solid #F0E0D6', borderRadius: '12px', backgroundColor: '#ffffff', textAlign: 'left' }}>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#8F4E00', mb: 1, display: 'flex', alignItems: 'center', gap: 1, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.75rem' }}>
              Wanneer wil je dit inplannen?
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
              {/* Date selection dropdown */}
              <FormControl fullWidth size="small">
                <InputLabel id="winner-date-select-label">Kies datum</InputLabel>
                <Select
                  labelId="winner-date-select-label"
                  value={winnerPlannedDate}
                  label="Kies datum"
                  onChange={(e) => setWinnerPlannedDate(e.target.value as string)}
                  sx={{ borderRadius: '12px' }}
                >
                  {(() => {
                    const options = [];
                    const today = new Date();
                    for (let i = 0; i < 7; i++) {
                      const d = new Date();
                      d.setDate(today.getDate() + i);
                      const year = d.getFullYear();
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const dayVal = String(d.getDate()).padStart(2, '0');
                      const dateStr = `${year}-${month}-${dayVal}`;
                      
                      const dayOfWeekName = DUTCH_DAYS[d.getDay()];
                      const monthName = DUTCH_MONTHS[d.getMonth()];
                      let label = `${dayOfWeekName} (${d.getDate()} ${monthName})`;
                      if (i === 0) {
                        label = `Vandaag (${d.getDate()} ${monthName})`;
                      } else if (i === 1) {
                        label = `Morgen (${d.getDate()} ${monthName})`;
                      }
                      options.push(
                        <MenuItem key={dateStr} value={dateStr}>
                          {label}
                        </MenuItem>
                      );
                    }
                    return options;
                  })()}
                </Select>
              </FormControl>

              {/* Meal slot dropdown */}
              <FormControl fullWidth size="small">
                <InputLabel id="winner-slot-select-label">Maaltijd moment</InputLabel>
                <Select
                  labelId="winner-slot-select-label"
                  value={winnerMealTime}
                  label="Maaltijd moment"
                  onChange={(e) => setWinnerMealTime(e.target.value as string)}
                  sx={{ borderRadius: '12px' }}
                >
                  <MenuItem value="ontbijt">Ontbijt</MenuItem>
                  <MenuItem value="middag">Middag</MenuItem>
                  <MenuItem value="avond">Avond</MenuItem>
                  <MenuItem value="tussendoor">Tussendoor</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2.5, px: { xs: 2, sm: 3 }, pt: 1, gap: 1.5 }}>
          <Button
            onClick={() => setOpenWinnerModal(false)}
            variant="outlined"
            size="large"
            sx={{
              borderColor: '#F0E0D6',
              color: 'text.secondary',
              flex: 1,
              borderRadius: '12px',
              py: 1,
              fontWeight: 750,
              fontSize: '0.9rem',
              whiteSpace: 'nowrap',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'rgba(143,78,0,0.02)',
              }
            }}
          >
            Opnieuw
          </Button>
          <Button
            onClick={handleConfirmWinner}
            variant="contained"
            color="primary"
            size="large"
            sx={{
              flex: 1.4,
              borderRadius: '12px',
              py: 1,
              fontWeight: 900,
              fontSize: '0.95rem',
              whiteSpace: 'nowrap',
              boxShadow: '0px 6px 18px rgba(143, 78, 0, 0.2)',
            }}
          >
            Koken
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
