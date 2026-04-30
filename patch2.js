const fs = require('fs');
const file = 'src/app/roz/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add userColorsRef & participantsSet
content = content.replace(
  "const seenUsersRef = useRef<Set<string>>(new Set())",
  `const userColorsRef = useRef<Map<string, string>>(new Map())
  const participantsSet = useRef<Set<string>>(new Set())`
);

// 2. Clear both on connect
content = content.replace(
  "seenUsersRef.current.clear()",
  `userColorsRef.current.clear()
    participantsSet.current.clear()`
);

// 3. Update websocket processing
const wsOld = `if (text === currentKeyword || text.startsWith(currentKeyword + ' ')) {
          if (!seenUsersRef.current.has(login)) {
            seenUsersRef.current.add(login)
            setTotalMessages(prev => prev + 1)
            setParticipants(prev => [...prev, {
              username: m[1],
              color: getRandomColor(),
              joinedAt: Date.now()
            }])
          }

          const msg: ChatMessage = {
            id: \`\${Date.now()}-\${Math.random()}\`,
            username: m[1],
            color: getRandomColor(),
            text: textRaw,
            timestamp: Date.now(),
          }
          setChatMessages(prev => [...prev.slice(-500), msg])
        }`

const wsNew = `let userColor = userColorsRef.current.get(login)
        if (!userColor) {
          userColor = getRandomColor()
          userColorsRef.current.set(login, userColor)
        }

        if (text === currentKeyword || text.startsWith(currentKeyword + ' ')) {
          if (!participantsSet.current.has(login)) {
            participantsSet.current.add(login)
            setTotalMessages(prev => prev + 1)
            setParticipants(prev => [...prev, {
              username: m[1],
              color: userColor,
              joinedAt: Date.now()
            }])
          }
        }

        const msg: ChatMessage = {
          id: \`\${Date.now()}-\${Math.random()}\`,
          username: m[1],
          color: userColor,
          text: textRaw,
          timestamp: Date.now(),
        }
        setChatMessages(prev => [...prev.slice(-500), msg])`

content = content.replace(wsOld, wsNew);

// 4. Fix Roulette animation inline classes
const uiAnimOld = `className="flex items-center h-full transition-transform duration-[5000ms] ease-[cubic-bezier(0.15,0.85,0.3,1)]"
              style={{ transform: \`translateX(calc(50% - 64px + \${spinOffset}px))\` }}`;

const uiAnimNew = `className="flex items-center h-full"
              style={{ 
                 transform: \`translateX(calc(50% - 64px + \${spinOffset}px))\`,
                 transition: isSpinning ? 'transform 5.1s cubic-bezier(0.15, 0.85, 0.3, 1)' : 'none'
              }}`;

content = content.replace(uiAnimOld, uiAnimNew);

fs.writeFileSync(file, content);
console.log('Patch2 complete.');
