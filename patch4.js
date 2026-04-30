const fs = require('fs');
const file = 'src/app/roz/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("import { motion } from 'framer-motion'")) {
  content = content.replace(
    "import { Button } from '@/components/ui/button'",
    "import { motion } from 'framer-motion'\nimport { Button } from '@/components/ui/button'"
  );
}

const listOld = "const spinList = participants.length > 0 ? Array(15).fill(participants).flat() : []";
const listNew = "const spinList = participants.length > 0 ? Array(30).fill(participants).flat() : []";
content = content.replace(listOld, listNew);

const spinActionOld = `const handleSpinRoulette = () => {
    setIsSpinning(true)
    
    setTimeout(() => {
      const winnerIdx = Math.floor(Math.random() * participants.length)
      const w = participants[winnerIdx]
      
      const loops = 5
      const targetIdx = participants.length * loops + winnerIdx
      setSpinOffset(-(targetIdx * 128))

      setTimeout(() => {
        setSpinWinner(w)
        setWinner(w)
        setIsSpinning(false)
      }, 5100)
    }, 50)
  }`;

const spinActionNew = `const handleSpinRoulette = () => {
    setIsSpinning(true)
    const winnerIdx = Math.floor(Math.random() * participants.length)
    const w = participants[winnerIdx]
    
    const loops = 10
    const targetIdx = participants.length * loops + winnerIdx
    setSpinOffset(-(targetIdx * 128))

    setTimeout(() => {
      setSpinWinner(w)
      setWinner(w)
      setIsSpinning(false)
    }, 5500)
  }`;
content = content.replace(spinActionOld, spinActionNew);

const oldWheel = `<div 
              className="flex items-center h-full"
              style={{ 
                 transform: \`translateX(calc(50% - 64px + \${spinOffset}px))\`,
                 transition: isSpinning ? 'transform 5.1s cubic-bezier(0.15, 0.85, 0.3, 1)' : 'none'
              }}
            >
               {spinList.map((p, i) => (`;

const newWheel = `<motion.div 
              className="flex items-center h-full"
              initial={{ x: "calc(50% - 64px)" }}
              animate={{ x: \`calc(50% - \${64 - spinOffset}px)\` }}
              transition={{ duration: 5.4, ease: [0.15, 0.85, 0.3, 1] }}
            >
               {spinList.map((p, i) => (`;

content = content.replace(oldWheel, newWheel);
const closerOld = `               ))}
            </div>
          </div>`;
const closerNew = `               ))}
            </motion.div>
          </div>`;
content = content.replace(closerOld, closerNew);

fs.writeFileSync(file, content);
console.log("Patch4 complete!");
