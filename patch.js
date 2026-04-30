const fs = require('fs');
const file = 'src/app/roz/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const chatRef = useRef<HTMLDivElement>(null)",
  `const [spinOffset, setSpinOffset] = useState(0)
  const spinList = participants.length > 0 ? Array(15).fill(participants).flat() : []
  const chatRef = useRef<HTMLDivElement>(null)
  const seenUsersRef = useRef<Set<string>>(new Set())`
);

content = content.replace(
  "setChatMessages([])",
  `setChatMessages([])\n    seenUsersRef.current.clear()`
);

content = content.replace(
  "setTotalMessages(prev => prev + 1)\n\n        if (text === currentKeyword || text.startsWith(currentKeyword + ' ')) {\n          setParticipants(prev => {\n            if (prev.some(p => p.username === login)) return prev\n            return [...prev, {\n              username: m[1],\n              color: getRandomColor(),\n              joinedAt: Date.now()\n            }]\n          })",
  `if (text === currentKeyword || text.startsWith(currentKeyword + ' ')) {
          if (!seenUsersRef.current.has(login)) {
            seenUsersRef.current.add(login)
            setTotalMessages(prev => prev + 1)
            setParticipants(prev => [...prev, {
              username: m[1],
              color: getRandomColor(),
              joinedAt: Date.now()
            }])
          }`
);

content = content.replace(
  "setChatMessages(prev => [...prev.slice(-50), msg])",
  "setChatMessages(prev => [...prev.slice(-500), msg])"
);

content = content.replace(
  "setSpinWinner(null)\n    setIsSpinning(false)\n  }",
  "setSpinOffset(0)\n    setSpinWinner(null)\n    setIsSpinning(false)\n  }"
);

content = content.replace(
  /setTimeout\(\(\) => \{[\s\S]*?\}, 3000\)/,
  `const loops = 5
    const targetIdx = participants.length * loops + winnerIdx
    setSpinOffset(-(targetIdx * 128))

    setTimeout(() => {
      setSpinWinner(w)
      setWinner(w)
      setIsSpinning(false)
    }, 5100)`
);

content = content.replace(
  "/* ─── Vase ─── */",
  `useEffect(() => {
    if (!rouletteOpen) {
      setSpinOffset(0)
      setSpinWinner(null)
      setIsSpinning(false)
    }
  }, [rouletteOpen])

  /* ─── Vase ─── */`
);

content = content.replace(
  "{chatMessages.length === 0 ? (",
  `{(() => {
                const displayedMessages = winner 
                  ? chatMessages.filter(m => m.username === winner.username)
                  : chatMessages;
                return displayedMessages.length === 0 ? (`
);

content = content.replace(
  /<div className="space-y-2">\s*\{chatMessages\.map\(\(msg\) => \(/,
  `<div className="space-y-2">
                  {displayedMessages.map((msg) => (`
);

content = content.replace(
  `</div>\n              )}`,
  `</div>\n                )\n              })()}`
);

const uiOld = /{*[^{]*Roulette Wheel[^{]*}*[\s\S]*?(?={\/\* Controls \*\/)/;
const uiNew = `{/* Roulette Wheel */}
          <div className="relative bg-[#1a1a1a] mx-2 sm:mx-6 rounded-xl overflow-hidden h-36 border border-[#333]">
            {/* Pointer */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
              <ArrowDown className="w-6 h-6 text-yellow-500 drop-shadow-md" />
            </div>
            
            <div 
              className="flex items-center h-full transition-transform duration-[5000ms] ease-[cubic-bezier(0.15,0.85,0.3,1)]"
              style={{ transform: \`translateX(calc(50% - 64px + \${spinOffset}px))\` }}
            >
               {spinList.map((p, i) => (
                 <div key={i} className="shrink-0 flex flex-col items-center justify-center border-r border-[#333] last:border-none relative" style={{ width: 128, height: '100%' }}>
                   <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold mb-2 shadow-lg" style={{ backgroundColor: p.color }}>
                      {p.username.charAt(0).toUpperCase()}
                   </div>
                   <span className="text-xs font-semibold text-white truncate w-24 text-center">{p.username}</span>
                 </div>
               ))}
            </div>
          </div>

          {/* Winner Display */}
          {spinWinner && (
            <div className="mx-6 mt-4 bg-[#1a1a1a] border border-purple-500/30 rounded-xl p-6 text-center shadow-[0_0_15px_rgba(168,85,247,0.15)] flex flex-col items-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-purple-500/30 mb-3" style={{ background: spinWinner.color }}>
                {spinWinner.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-3xl font-bold drop-shadow-md winner-glow" style={{ color: spinWinner.color }}>
                {spinWinner.username}
              </div>
              <div className="text-sm text-gray-400 mt-2">Поздравляем с победой в розыгрыше!</div>
            </div>
          )}

          `;

content = content.replace(uiOld, uiNew);

fs.writeFileSync(file, content);
console.log('Patch complete.');
