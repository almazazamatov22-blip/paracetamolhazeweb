const fs = require('fs');
const file = 'src/app/roz/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix vase winner logic
const vaseOld = `const handleStartVase = () => {
    if (participants.length < 2) return
    const shuffled = [...participants].sort(() => Math.random() - 0.5).slice(0, 9)
    setVasePlayers(shuffled)
    setVaseWinnerIdx(Math.floor(Math.random() * 9))
    setVaseBroken([])
    setVaseOpen(true)
  }`;

const vaseNew = `const handleStartVase = () => {
    if (participants.length < 2) return
    const shuffled = [...participants].sort(() => Math.random() - 0.5).slice(0, 9)
    setVasePlayers(shuffled)
    setVaseWinnerIdx(Math.floor(Math.random() * shuffled.length))
    setVaseBroken([])
    setVaseOpen(true)
  }`;

content = content.replace(vaseOld, vaseNew);

// Fix roulette spin transition jump issue
const spinOld = `const handleSpinRoulette = () => {
    setIsSpinning(true)
    const loops = 5
    const targetIdx = participants.length * loops + winnerIdx
    setSpinOffset(-(targetIdx * 128))

    setTimeout(() => {
      setSpinWinner(w)
      setWinner(w)
      setIsSpinning(false)
    }, 5100)
  }`;

// Actually I need to match the real method:
const realSpinOld = `const handleSpinRoulette = () => {
    setIsSpinning(true)
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
  }`;

const realSpinNew = `const handleSpinRoulette = () => {
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

content = content.replace(realSpinOld, realSpinNew);

fs.writeFileSync(file, content);
console.log('Patch3 complete.');
