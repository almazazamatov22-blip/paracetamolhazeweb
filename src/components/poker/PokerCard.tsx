'use client'

import { motion } from 'framer-motion'
import { memo } from 'react'
import { Trophy } from 'lucide-react'

interface CardProps {
  suit: string // 'H' | 'D' | 'C' | 'S'
  value: string // '2'-'9', 'T', 'J', 'Q', 'K', 'A'
  isFlipped?: boolean
  className?: string
}

const PokerCard = memo(({ suit, value, isFlipped = false, className = "" }: CardProps) => {
  // Graceful handling of missing/invalid data
  if (!suit || !value || suit === 'X') {
    isFlipped = true;
  }

  // Mapping engine values to file names
  const fileName = `${value === 'T' ? '10' : value}${suit}.svg`;
  const cardSrc = `/poker/cards/${fileName}`;

  return (
    <motion.div
      initial={false}
      animate={{ rotateY: isFlipped ? 180 : 0 }}
      transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
      className={`relative w-16 h-24 md:w-20 md:h-28 cursor-pointer ${className}`}
      style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
    >
      {/* Front Side (Face) */}
      <div 
        className="absolute inset-0 rounded-xl border border-white/10 shadow-2xl overflow-hidden flex items-center justify-center bg-white"
        style={{ 
            backfaceVisibility: 'hidden', 
            WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {/* SVG Card Face */}
        <img 
            src={cardSrc} 
            alt={`${value}${suit}`} 
            className="w-full h-full object-contain scale-[3.2]"
            onError={(e) => {
                console.error('Card Image Load Error:', cardSrc);
                e.currentTarget.style.display = 'none';
            }}
        />
        {/* Subtle glare */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/10 to-transparent" />
      </div>

      {/* Back Side (The shirt / Rubashka) - OUR CUSTOM DESIGN */}
      <div 
        className="absolute inset-0 rounded-xl border-2 border-white/20 shadow-2xl overflow-hidden"
        style={{ 
            backfaceVisibility: 'hidden', 
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        }}
      >
        {/* Patterned Background */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_2px_2px,_white_1px,_transparent_0)] bg-[length:8px_8px]" />
        
        {/* Trophy Logo */}
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm">
                <Trophy className="text-white/20 w-6 h-6 md:w-8 md:h-8" />
            </div>
        </div>

        {/* Glossy Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/10" />
      </div>
    </motion.div>
  )
})

PokerCard.displayName = 'PokerCard'

export default PokerCard

