'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import FloatingNicknames from '@/components/floating-nicknames'

const DEFAULT_NICKS = [
  'paracetamolhaze', 'paracetamolHAZE', 'HAZE', 'r1ch_crazy', 'deluxe_2004',
  'yaTomal', 'habarhub', 'RinaMiura', 'm1llenn1ummm', 'txt_abloko',
  'txt_abloko2', 'gantitupik', 'kukushonoktv', 'Wiesal_t', 'lll_mommy',
  'Saint_ioannX', 'Juliebayy', 'tripleoff', 'zxckostik2010', 'sasavot',
  'evelone2004', 'kurokoken', 'egypop13', 'GolDi_21', 'STRYPOFF13', 'limonnub'
];

const PROJECTS = [
  {
    title: 'РОЗ',
    desc: 'Розыгрыши в чате твича',
    href: '/roz',
  },
  {
    title: 'КИНО',
    desc: 'Онлайн просмотр фильмов и таймингов',
    href: '/kino',
  },
  {
    title: 'ЧЕК',
    desc: 'Просмотр подписок пользователя twitch',
    href: '/check',
  },
  {
    title: 'ЛОТОМАЛЬ',
    desc: 'Многопользовательская игра в Лото',
    href: '/lotomal',
  },
  {
    title: 'ФейтОверлей',
    desc: 'Оверлеи с баллами твича',
    href: '/overlays',
  },
  {
    title: '67',
    desc: '67 на скорость',
    href: '/67',
  },
  {
    title: 'КиноКадр',
    desc: 'Угадай фильм по кадру',
    href: '/kinokadr',
  },
  {
    title: 'КИНОКВИЗ',
    desc: 'интерактив со зрителями',
    href: '/kinoquiz',
  },
  {
    title: 'Покер',
    desc: 'С вебкамерами',
    href: '/poker',
    disabled: true,
  },
  {
    title: 'Эмоджино',
    desc: 'Угадай фильм по эмоджи',
    href: '/emojino',
  },
]

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null)
  const ticking = useRef(false)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!ticking.current) {
      requestAnimationFrame(() => {
        const container = containerRef.current
        if (!container) return
        const centerX = window.innerWidth / 2
        const centerY = window.innerHeight / 2
        const offsetX = (e.clientX - centerX) / 80
        const offsetY = (e.clientY - centerY) / 80
        container.style.transform = `
          translateX(${offsetX}px)
          translateY(${offsetY}px)
          rotateX(${-offsetY / 8}deg)
          rotateY(${offsetX / 8}deg)
        `
        ticking.current = false
      })
      ticking.current = true
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    const container = containerRef.current
    if (container) {
      container.style.transform = 'none'
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [handleMouseMove, handleMouseLeave])

  const handleCardMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = (y - centerY) / 20
    const rotateY = (centerX - x) / 20
    card.style.transform = `
      perspective(1000px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      scale(1.03)
    `
  }, [])

  const handleCardMouseLeave = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)'
  }, [])

  return (
    <main className="paracetamol-body">
      <FloatingNicknames nicknames={DEFAULT_NICKS} />
      
      <div className="paracetamol-container" ref={containerRef}>
        {/* Subtitle */}
        <span className="paracetamol-subtitle">
          <span className="paracetamol-twitch-label">TWITCH:</span>
          <span className="paracetamol-twitch-name">TXT_ABLOKO</span>
        </span>

        {/* Main Word */}
        <div className="paracetamol-main-word">
          <span className="paracetamol-word-container">
            <span className="paracetamol-word-base">PARACETAMOL</span>
            <span className="paracetamol-di-highlight">
              <span className="paracetamol-di-letters">HAZE</span>
            </span>
          </span>
        </div>

        {/* Projects */}
        <div className="paracetamol-projects-section">
          <div className="paracetamol-projects-title">ОНЛАЙН ПРОЕКТЫ</div>
          <div className="paracetamol-projects-grid">
            {PROJECTS.map((project) => (
              <a
                key={project.title}
                href={project.disabled ? undefined : project.href}
                className={`paracetamol-project-card ${project.disabled ? 'is-disabled' : ''}`}
                onMouseMove={handleCardMouseMove}
                onMouseLeave={handleCardMouseLeave}
              >
                <div className="paracetamol-project-title">{project.title}</div>
                {project.desc && <div className="paracetamol-project-desc">{project.desc}</div>}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom Line */}
        <div className="paracetamol-bottom-line">
          <span className="paracetamol-bottom-left">Offline</span>
          <span className="paracetamol-bottom-right">online</span>
        </div>
      </div>
    </main>
  )
}
